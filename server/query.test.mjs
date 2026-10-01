import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@libsql/client";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RESOURCES } from "./resources.mjs";
import { create, update } from "./query.mjs";

// `vi.mock` factories are hoisted above the rest of the file, so the mocks
// they reference must be created via `vi.hoisted` (see
// https://vitest.dev/api/vi.html#vi-hoisted) — matches the pattern used in
// providers/turso/authProvider.test.ts.
const mockExecute = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());
const mockTxExecute = vi.hoisted(() => vi.fn());
const mockCommit = vi.hoisted(() => vi.fn());
const mockRollback = vi.hoisted(() => vi.fn());
const tableColumnsFixture = vi.hoisted(() => ({}));
const requiredColumnsFixture = vi.hoisted(() => ({}));

vi.mock("./db.mjs", () => ({
  db: { execute: mockExecute, transaction: mockTransaction },
  tableColumns: tableColumnsFixture,
  requiredColumns: requiredColumnsFixture,
}));

const cfg = RESOURCES.contact_notes;

describe("query.mjs required-column validation", () => {
  beforeEach(() => {
    mockExecute.mockReset();
    // Mirrors contact_notes: contact_id is NOT NULL with no DEFAULT, every
    // other column is nullable or defaulted (see db/schema.sql).
    tableColumnsFixture[cfg.table] = [
      "id",
      "contact_id",
      "text",
      "date",
      "sales_id",
      "status",
      "attachments",
    ];
    requiredColumnsFixture[cfg.table] = ["contact_id"];
    tableColumnsFixture.contacts = ["id", "last_seen", "status"];
    requiredColumnsFixture.contacts = [];
    tableColumnsFixture.tasks = [
      "id",
      "contact_id",
      "type",
      "text",
      "due_date",
      "done_date",
      "sales_id",
    ];
    requiredColumnsFixture.tasks = ["contact_id"];
    tableColumnsFixture.configuration = ["id", "config"];
    requiredColumnsFixture.configuration = [];
    mockTxExecute.mockReset();
    mockCommit.mockReset();
    mockRollback.mockReset();
    mockTransaction.mockReset().mockResolvedValue({
      execute: mockTxExecute,
      commit: mockCommit,
      rollback: mockRollback,
    });
  });

  describe("create()", () => {
    it("throws before inserting when a required column is missing", async () => {
      // Arrange / Act / Assert
      await expect(create(cfg, { data: { text: "hello" } })).rejects.toThrow(
        "contact_id is required",
      );
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it("throws before inserting when a required column is explicitly null", async () => {
      // Arrange / Act / Assert
      await expect(
        create(cfg, { data: { contact_id: null, text: "hello" } }),
      ).rejects.toThrow("contact_id is required");
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it("inserts when the required column is present", async () => {
      // Arrange
      mockExecute.mockResolvedValue({
        columns: ["id", "contact_id"],
        rows: [[1, 5]],
      });

      // Act
      const { data } = await create(cfg, {
        data: { contact_id: 5, text: "hello" },
      });

      // Assert
      expect(data).toEqual({ id: 1, contact_id: 5 });
      expect(mockExecute).toHaveBeenCalledTimes(2); // 1 INSERT + 1 logHistory
    });

    it("accepts a nullable/defaulted column omitted from the payload", async () => {
      // Arrange
      mockExecute.mockResolvedValue({
        columns: ["id", "contact_id"],
        rows: [[1, 5]],
      });

      // Act / Assert: `text`, `date`, `status`, `attachments` are all
      // omitted here and none of them are required.
      await expect(
        create(cfg, { data: { contact_id: 5 } }),
      ).resolves.toBeDefined();
      expect(mockExecute).toHaveBeenCalledTimes(2); // 1 INSERT + 1 logHistory
    });
  });

  describe("update()", () => {
    it("rejects a required column explicitly cleared to null", async () => {
      // Arrange / Act / Assert
      await expect(
        update(cfg, { id: 1, data: { contact_id: null } }),
      ).rejects.toThrow("contact_id is required");
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it("allows a partial update that simply omits the required column", async () => {
      // Arrange
      mockExecute.mockResolvedValue({
        columns: ["id", "contact_id", "text"],
        rows: [[1, 5, "updated"]],
      });

      // Act
      const { data } = await update(cfg, {
        id: 1,
        data: { text: "updated" },
      });

      // Assert
      expect(data).toEqual({ id: 1, contact_id: 5, text: "updated" });
      expect(mockExecute).toHaveBeenCalledTimes(2); // 1 UPDATE + 1 logHistory
    });
  });

  describe("create() with transient next_action", () => {
    const note = {
      contact_id: 5,
      text: "Appel avec le juge arbitre",
      sales_id: 2,
      status: "active",
      next_action: {
        mode: "create",
        text: "Envoyer le devis",
        due_date: "2026-10-05",
      },
    };

    it.each([
      [{ ...note, next_action: null }, "next_action is invalid"],
      [
        {
          ...note,
          next_action: { mode: "create", text: " ", due_date: "2026-10-05" },
        },
        "next_action create requires",
      ],
      [
        {
          ...note,
          next_action: { mode: "create", text: "OK", due_date: "2026-02-30" },
        },
        "next_action create requires",
      ],
      [
        {
          ...note,
          next_action: {
            mode: "create",
            text: "OK",
            due_date: "2026-10-05",
            extra: true,
          },
        },
        "next_action create requires",
      ],
      [
        { ...note, next_action: { mode: "existing", task_id: "nope" } },
        "next_action existing requires",
      ],
    ])(
      "rejects invalid action payloads before starting a transaction",
      async (data, message) => {
        await expect(create(cfg, { data })).rejects.toThrow(message);
        expect(mockTransaction).not.toHaveBeenCalled();
        expect(mockExecute).not.toHaveBeenCalled();
      },
    );

    it("creates a note and task, updates the contact, and audits all writes in one transaction", async () => {
      mockTxExecute.mockImplementation(async ({ sql }) => {
        if (sql.includes('FROM "contacts"')) {
          return { columns: ["id"], rows: [[5]] };
        }
        if (sql.startsWith('INSERT INTO "contact_notes"')) {
          return {
            columns: ["id", "contact_id", "text", "sales_id", "status"],
            rows: [[11, 5, note.text, 2, "active"]],
          };
        }
        if (sql.startsWith('INSERT INTO "tasks"')) {
          return {
            columns: [
              "id",
              "contact_id",
              "type",
              "text",
              "due_date",
              "done_date",
              "sales_id",
            ],
            rows: [[12, 5, "none", "Envoyer le devis", "2026-10-05", null, 2]],
          };
        }
        if (sql.startsWith('UPDATE "contacts"')) {
          return {
            columns: ["id", "last_seen", "status"],
            rows: [[5, "now", "active"]],
          };
        }
        return { columns: [], rows: [] };
      });

      const result = await create(cfg, { data: note });

      expect(result.data).toEqual({
        id: 11,
        contact_id: 5,
        text: note.text,
        sales_id: 2,
        status: "active",
      });
      expect(mockTransaction).toHaveBeenCalledWith("write");
      expect(mockTxExecute).toHaveBeenCalledTimes(7); // contact read, 3 writes, 3 audits
      const noteInsert = mockTxExecute.mock.calls.find(([arg]) =>
        arg.sql.startsWith('INSERT INTO "contact_notes"'),
      )[0];
      expect(noteInsert.sql).not.toContain("next_action");
      expect(noteInsert.args).not.toContain(note.next_action);
      const taskInsert = mockTxExecute.mock.calls.find(([arg]) =>
        arg.sql.startsWith('INSERT INTO "tasks"'),
      )[0];
      expect(taskInsert.args).toEqual([
        5,
        "none",
        "Envoyer le devis",
        "2026-10-05",
        null,
        2,
      ]);
      expect(mockCommit).toHaveBeenCalledOnce();
      expect(mockRollback).not.toHaveBeenCalled();
    });

    it("reuses a selected task only when it belongs to the contact and is open", async () => {
      mockTxExecute.mockImplementation(async ({ sql }) => {
        if (sql.includes('FROM "contacts"'))
          return { columns: ["id"], rows: [[5]] };
        if (sql.includes('FROM "tasks"')) {
          return {
            columns: ["id", "contact_id", "text", "due_date", "done_date"],
            rows: [[9, 5, "Relancer", "2026-10-05", null]],
          };
        }
        if (sql.startsWith('INSERT INTO "contact_notes"')) {
          return {
            columns: ["id", "contact_id", "text"],
            rows: [[11, 5, note.text]],
          };
        }
        if (sql.startsWith('UPDATE "contacts"'))
          return { columns: ["id", "last_seen"], rows: [[5, "now"]] };
        return { columns: [], rows: [] };
      });

      await create(cfg, {
        data: {
          ...note,
          next_action: { mode: "existing", task_id: 9 },
          status: undefined,
        },
      });

      expect(
        mockTxExecute.mock.calls.some(([arg]) =>
          arg.sql.startsWith('INSERT INTO "tasks"'),
        ),
      ).toBe(false);
      const contactUpdate = mockTxExecute.mock.calls.find(([arg]) =>
        arg.sql.startsWith('UPDATE "contacts"'),
      )[0];
      expect(contactUpdate.sql).not.toContain('"status"');
      expect(mockCommit).toHaveBeenCalledOnce();
    });

    it.each([
      ["task insert", 'INSERT INTO "tasks"'],
      ["contact update", 'UPDATE "contacts"'],
      ["audit insert", 'INSERT INTO "record_history"'],
    ])("rolls back when the %s fails", async (_label, failingSql) => {
      mockTxExecute.mockImplementation(async ({ sql }) => {
        if (sql.includes('FROM "contacts"'))
          return { columns: ["id"], rows: [[5]] };
        if (sql.startsWith('INSERT INTO "contact_notes"')) {
          return {
            columns: ["id", "contact_id", "text"],
            rows: [[11, 5, note.text]],
          };
        }
        if (sql.startsWith(failingSql)) throw new Error("injected failure");
        if (sql.startsWith('INSERT INTO "tasks"')) {
          return {
            columns: [
              "id",
              "contact_id",
              "type",
              "text",
              "due_date",
              "done_date",
              "sales_id",
            ],
            rows: [[12, 5, "none", "Envoyer le devis", "2026-10-05", null, 2]],
          };
        }
        if (sql.startsWith('UPDATE "contacts"'))
          return {
            columns: ["id", "last_seen", "status"],
            rows: [[5, "now", "active"]],
          };
        return { columns: [], rows: [] };
      });

      await expect(create(cfg, { data: note })).rejects.toThrow(
        "injected failure",
      );
      expect(mockCommit).not.toHaveBeenCalled();
      expect(mockRollback).toHaveBeenCalledOnce();
    });

    it("commits note, task, contact update, and audit together on SQLite", async () => {
      const directory = await mkdtemp(join(tmpdir(), "atomic-query-"));
      const sqlite = createClient({
        url: `file:${join(directory, "query.db")}`,
        intMode: "number",
      });
      try {
        await sqlite.executeMultiple(`
          CREATE TABLE contacts (id INTEGER PRIMARY KEY, last_seen TEXT, status TEXT);
          CREATE TABLE contact_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, contact_id INTEGER NOT NULL, text TEXT, date TEXT, sales_id INTEGER, status TEXT, attachments TEXT);
          CREATE TABLE tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, contact_id INTEGER NOT NULL, type TEXT, text TEXT, due_date TEXT, done_date TEXT, sales_id INTEGER);
          CREATE TABLE record_history (id INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT NOT NULL, record_id TEXT NOT NULL, action TEXT NOT NULL, data TEXT);
          INSERT INTO contacts (id, status) VALUES (5, 'lead');
        `);
        mockTransaction.mockImplementation(() => sqlite.transaction("write"));

        const timestampNote = {
          ...note,
          next_action: {
            ...note.next_action,
            due_date: "2026-10-05T12:30:00.000Z",
          },
        };
        await create(cfg, { data: timestampNote });

        const rows = await sqlite.execute(`
          SELECT (SELECT count(*) FROM contact_notes) AS notes,
                 (SELECT count(*) FROM tasks) AS tasks,
                 (SELECT count(*) FROM record_history) AS audits,
                 (SELECT status FROM contacts WHERE id = 5) AS status,
                 (SELECT due_date FROM tasks WHERE id = 1) AS due_date
        `);
        expect(rows.rows[0].notes).toBe(1);
        expect(rows.rows[0].tasks).toBe(1);
        expect(rows.rows[0].audits).toBe(3);
        expect(rows.rows[0].status).toBe("active");
        expect(rows.rows[0].due_date).toBe("2026-10-05T12:30:00.000Z");
      } finally {
        await sqlite.close();
        await rm(directory, { recursive: true, force: true });
      }
    });

    it("rolls back all SQLite writes when a later audit insert fails", async () => {
      const directory = await mkdtemp(join(tmpdir(), "atomic-query-"));
      const sqlite = createClient({
        url: `file:${join(directory, "query.db")}`,
        intMode: "number",
      });
      try {
        await sqlite.executeMultiple(`
          CREATE TABLE contacts (id INTEGER PRIMARY KEY, last_seen TEXT, status TEXT);
          CREATE TABLE contact_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, contact_id INTEGER NOT NULL, text TEXT, date TEXT, sales_id INTEGER, status TEXT, attachments TEXT);
          CREATE TABLE tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, contact_id INTEGER NOT NULL, type TEXT, text TEXT, due_date TEXT, done_date TEXT, sales_id INTEGER);
          CREATE TABLE record_history (id INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT NOT NULL, record_id TEXT NOT NULL, action TEXT NOT NULL, data TEXT);
          INSERT INTO contacts (id, status) VALUES (5, 'lead');
          CREATE TRIGGER fail_task_audit BEFORE INSERT ON record_history
          WHEN NEW.table_name = 'tasks'
          BEGIN SELECT RAISE(ABORT, 'audit failure'); END;
        `);
        mockTransaction.mockImplementation(() => sqlite.transaction("write"));

        await expect(create(cfg, { data: note })).rejects.toThrow(
          "audit failure",
        );

        const rows = await sqlite.execute(`
          SELECT (SELECT count(*) FROM contact_notes) AS notes,
                 (SELECT count(*) FROM tasks) AS tasks,
                 (SELECT count(*) FROM record_history) AS audits,
                 (SELECT status FROM contacts WHERE id = 5) AS status
        `);
        expect(rows.rows[0].notes).toBe(0);
        expect(rows.rows[0].tasks).toBe(0);
        expect(rows.rows[0].audits).toBe(0);
        expect(rows.rows[0].status).toBe("lead");
      } finally {
        await sqlite.close();
        await rm(directory, { recursive: true, force: true });
      }
    });
  });

  describe("client checklist write validation", () => {
    it.each([null, ["id", " "], ["same", "same"]])(
      "rejects invalid contact checklist values",
      async (client_checklist) => {
        await expect(
          create(RESOURCES.contacts, { data: { client_checklist } }),
        ).rejects.toThrow("client_checklist");
        expect(mockExecute).not.toHaveBeenCalled();
      },
    );

    it.each([
      null,
      [{ value: "step", label: " " }],
      [
        { value: "same", label: "One" },
        { value: "same", label: "Two" },
      ],
    ])("rejects invalid configured checklist values", async (items) => {
      await expect(
        update(RESOURCES.configuration, {
          id: 1,
          data: { config: { clientChecklist: items } },
        }),
      ).rejects.toThrow("clientChecklist");
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it("accepts an explicitly empty checklist", async () => {
      mockExecute.mockImplementation(async () => ({
        columns: ["id", "config"],
        rows: [[1, JSON.stringify({ clientChecklist: [] })]],
      }));

      await expect(
        update(RESOURCES.configuration, {
          id: 1,
          data: { config: { clientChecklist: [] } },
        }),
      ).resolves.toMatchObject({ data: { config: { clientChecklist: [] } } });
    });
  });
});
