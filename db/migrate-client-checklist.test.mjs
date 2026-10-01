import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";

import { migrateClientChecklist } from "./migrate-client-checklist.mjs";

let client;

afterEach(() => client?.close());

describe("migrateClientChecklist", () => {
  it("adds the column to an old database and preserves contact data", async () => {
    client = createClient({ url: ":memory:" });
    await client.execute(
      "CREATE TABLE contacts (id INTEGER PRIMARY KEY, first_name TEXT)",
    );
    await client.execute(
      "INSERT INTO contacts (id, first_name) VALUES (1, 'Ada')",
    );

    await migrateClientChecklist(client);
    await migrateClientChecklist(client);

    const { rows } = await client.execute(
      "SELECT id, first_name, client_checklist FROM contacts",
    );
    expect(rows).toEqual([
      { id: 1, first_name: "Ada", client_checklist: "[]" },
    ]);
  });

  it("preserves existing checklist values on repeated runs", async () => {
    client = createClient({ url: ":memory:" });
    await client.execute(
      "CREATE TABLE contacts (id INTEGER PRIMARY KEY, client_checklist TEXT NOT NULL DEFAULT '[]')",
    );
    await client.execute({
      sql: "INSERT INTO contacts (id, client_checklist) VALUES (1, ?)",
      args: ['["first-tournament"]'],
    });

    await migrateClientChecklist(client);
    await migrateClientChecklist(client);

    const { rows } = await client.execute(
      "SELECT client_checklist FROM contacts WHERE id = 1",
    );
    expect(rows[0].client_checklist).toBe('["first-tournament"]');
  });

  it("leaves a fresh database ready for schema provisioning", async () => {
    client = createClient({ url: ":memory:" });
    await migrateClientChecklist(client);
    await client.execute(
      "CREATE TABLE contacts (id INTEGER PRIMARY KEY, client_checklist TEXT NOT NULL DEFAULT '[]')",
    );

    const { rows } = await client.execute('PRAGMA table_info("contacts")');
    expect(
      rows.filter((column) => column.name === "client_checklist"),
    ).toHaveLength(1);
  });
});
