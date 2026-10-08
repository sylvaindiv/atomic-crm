import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import {
  planImport,
  applyPlan,
  readSnapshot,
  mergeSources,
  assertReviewedPlan,
} from "./import-tenup.mjs";

const club = { club_id: "001", nom: "Club A" };
const judge = {
  juge_id: "tenup:007",
  id_tenup: "007",
  prenom: "Émilie",
  nom: "De Test",
  email: "e@example.org",
  telephone: "0612345678",
};
const sources = {
  clubs: [club],
  judges: [judge],
  links: [
    { club_id: "001", juge_id: judge.juge_id, tournoi_id: "A" },
    { club_id: "001", juge_id: judge.juge_id, tournoi_id: "B" },
  ],
};
const snapshot = {
  companies: [],
  contacts: [],
  sales: [{ id: 1, first_name: "Sylvain" }],
};
describe("TenUp import", () => {
  it("runs the multi-source CLI, refuses stale dry-runs and never writes twice", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tenup-cli-"));
    const db = createClient({ url: `file:${dir}/test.db` });
    try {
      await db.executeMultiple(
        readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"),
      );
      await db.execute(
        "INSERT INTO sales(id,first_name,email,disabled) VALUES(1,'Sylvain','s@example.org',0)",
      );
      const args = [];
      for (const [index, row] of [
        club,
        { club_id: "002", nom: "Club B" },
      ].entries()) {
        const sourceDir = join(dir, String(index));
        mkdirSync(sourceDir);
        for (const [filename, rows] of [
          ["clubs.csv", [row]],
          ["juges_arbitres.csv", [judge]],
          [
            "club_juge_tournois.csv",
            [{ club_id: row.club_id, juge_id: judge.juge_id, tournoi_id: "A" }],
          ],
        ])
          writeFileSync(
            join(sourceDir, filename),
            Papa.unparse(rows, { delimiter: ";" }),
          );
        args.push("--source", sourceDir);
      }
      const report = join(dir, "report.json");
      const run = (...extra) =>
        spawnSync(
          process.execPath,
          [
            fileURLToPath(new URL("./import-tenup.mjs", import.meta.url)),
            ...args,
            "--report",
            report,
            ...extra,
          ],
          {
            env: {
              ...process.env,
              TURSO_DATABASE_URL: `file:${dir}/test.db`,
              TURSO_AUTH_TOKEN: "",
            },
            encoding: "utf8",
          },
        );
      expect(run().status).toBe(0);
      await db.execute(
        "INSERT INTO companies(name) VALUES('Concurrent change')",
      );
      const stale = run("--apply", "--expected-report", report);
      expect(stale.status).toBe(1);
      expect(stale.stderr).toContain("changed");
      expect(
        (await db.execute("SELECT count(*) n FROM contacts")).rows[0].n,
      ).toBe(0);
      expect(run().status).toBe(0);
      await db.execute(
        "CREATE TRIGGER reject_import BEFORE INSERT ON contacts BEGIN SELECT RAISE(ABORT, 'injected failure'); END",
      );
      const failed = run("--apply", "--expected-report", report);
      expect(failed.status).toBe(1);
      expect(failed.stderr).toContain("injected failure");
      expect(
        (await db.execute("SELECT count(*) n FROM companies")).rows[0].n,
      ).toBe(1);
      expect(
        (await db.execute("SELECT count(*) n FROM record_history")).rows[0].n,
      ).toBe(0);
      const backup = JSON.parse(readFileSync(report + ".backup.json", "utf8"));
      expect(backup.tables.companies).toHaveLength(1);
      expect(backup.tables.contacts).toHaveLength(0);
      await db.execute("DROP TRIGGER reject_import");
      rmSync(report + ".backup.json");
      mkdirSync(report + ".applied.json");
      const applied = run("--apply", "--expected-report", report);
      expect(applied.stderr).toContain(
        "Import committed; could not save applied report",
      );
      expect(applied.status).toBe(0);
      expect(
        (await db.execute("SELECT company_ids FROM contacts")).rows[0]
          .company_ids,
      ).toBe("[2,3]");
      expect(
        (await db.execute("SELECT count(*) n FROM record_history")).rows[0].n,
      ).toBe(3);
      const repeated = run("--apply", "--expected-report", report);
      expect(repeated.status).toBe(1);
      expect(
        (await db.execute("SELECT count(*) n FROM record_history")).rows[0].n,
      ).toBe(3);
      expect(run().status).toBe(0);
      expect(
        JSON.parse(readFileSync(report, "utf8")).counts.modifications,
      ).toBe(0);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("merges departments by textual ID, retaining all clubs and source origins", () => {
    const other = { club_id: "002", nom: "Club B" };
    const combined = mergeSources([
      { ...sources, directory: "/11" },
      {
        clubs: [other],
        judges: [{ ...judge, email: "" }],
        links: [{ club_id: "002", juge_id: judge.juge_id, tournoi_id: "C" }],
        directory: "/81",
      },
    ]);
    expect(combined.judges).toHaveLength(1);
    expect(combined.judges[0].email).toBe(judge.email);
    expect(combined.judges[0].origins).toHaveLength(2);
    const report = planImport(snapshot, combined, 1);
    expect(report.counts).toMatchObject({
      clubsCreated: 2,
      judgesCreated: 1,
      pairs: 2,
    });
    expect(
      report.actions.find((a) => a.table === "contacts").data.company_ids,
    ).toEqual([1, 2]);
    expect(() =>
      mergeSources([
        sources,
        { ...sources, judges: [{ ...judge, nom: "Different" }] },
      ]),
    ).toThrow(/Conflicting/);
    expect(() =>
      mergeSources([{ ...sources, judges: [{ ...judge, id_tenup: "008" }] }]),
    ).toThrow(/juge_id/);
    expect(() =>
      mergeSources([
        {
          ...sources,
          links: [
            { club_id: "missing", juge_id: judge.juge_id, tournoi_id: "A" },
          ],
        },
      ]),
    ).toThrow(/reference/);
  });
  it("uses approved source-ID mappings and preserves existing names", () => {
    const data = {
      ...snapshot,
      companies: [{ id: 116, name: "Old club" }],
      contacts: [
        {
          id: 638,
          first_name: "Old",
          last_name: "Name",
          phone_jsonb: [{ number: judge.telephone }],
        },
      ],
    };
    const mappings = { clubs: { "001": 116 }, judges: { "007": 638 } };
    const report = planImport(data, sources, 1, { mappings });
    expect(report.counts).toMatchObject({
      clubsCreated: 0,
      judgesCreated: 0,
      ambiguities: 0,
    });
    expect(
      report.actions.find((a) => a.table === "contacts").data.first_name,
    ).toBeUndefined();
    expect(
      report.actions.find((a) => a.table === "contacts").data.company_ids,
    ).toEqual([116]);
    expect(
      planImport(data, sources, 1, { mappings: { clubs: { "001": 999 } } })
        .ambiguities.length,
    ).toBeGreaterThan(0);
  });
  it("holds email identity conflicts and likely phone duplicates but allows distinct users of a shared club phone", () => {
    const contact = {
      id: 10,
      first_name: "Emilie",
      last_name: "Old Name",
      email_jsonb: [{ email: judge.email }],
    };
    expect(
      planImport({ ...snapshot, contacts: [contact] }, sources, 1).ambiguities,
    ).toHaveLength(1);
    contact.email_jsonb = [];
    contact.phone_jsonb = [{ number: "+33 6 12 34 56 78" }];
    expect(
      planImport({ ...snapshot, contacts: [contact] }, sources, 1).ambiguities,
    ).toHaveLength(1);
    contact.first_name = "PADEL";
    contact.last_name = "TOLOSA";
    expect(
      planImport({ ...snapshot, contacts: [contact] }, sources, 1).counts,
    ).toMatchObject({ judgesCreated: 1, ambiguities: 0 });
  });
  it("rejects stale reviewed actions, source files and mappings", () => {
    const options = { now: "2026-10-08T20:00:00.000Z" };
    const report = planImport(snapshot, sources, 1, options);
    expect(() =>
      assertReviewedPlan(report, planImport(snapshot, sources, 1, options)),
    ).not.toThrow();
    const changed = planImport(
      { ...snapshot, companies: [{ id: 1, name: "Club A" }] },
      sources,
      1,
      options,
    );
    expect(() => assertReviewedPlan(report, changed)).toThrow(/changed/);
    expect(() =>
      assertReviewedPlan(report, {
        ...report,
        sources: { ...sources, manifests: ["changed"] },
      }),
    ).toThrow(/changed/);
    expect(() =>
      assertReviewedPlan(report, {
        ...report,
        mappings: { judges: { "007": 10 } },
      }),
    ).toThrow(/changed/);
  });
  it("reuses name variants, preserves existing memberships/status and ignores shared phone as identity", () => {
    const contacts = [
      {
        id: 1,
        first_name: "EMILIE",
        last_name: "DE-TEST",
        status: "mort",
        company_id: 8,
        company_ids: [8],
        phone_jsonb: [],
      },
      {
        id: 2,
        first_name: "Other",
        last_name: "Person",
        phone_jsonb: [{ number: "0612345678" }],
      },
    ];
    const report = planImport({ ...snapshot, contacts }, sources, 1);
    expect(report.counts).toMatchObject({
      judgesCreated: 0,
      judgesReused: 1,
      pairs: 1,
      ambiguities: 0,
    });
    const patch = report.actions.find((a) => a.table === "contacts").data;
    expect(patch.company_ids).toEqual([8, 1]);
    expect(patch.status).toBeUndefined();
    expect(patch.first_name).toBeUndefined();
    expect(report.divergences.some((d) => d.field === "shared_phone")).toBe(
      true,
    );
  });
  it("stops homonyms and conflicting email/name matches", () => {
    const contacts = [
      { id: 1, first_name: "Emilie", last_name: "De Test" },
      { id: 2, first_name: "Emilie", last_name: "De Test" },
    ];
    expect(
      planImport({ ...snapshot, contacts }, sources, 1).counts.ambiguities,
    ).toBe(1);
    contacts[1] = {
      id: 2,
      first_name: "Other",
      last_name: "Person",
      email_jsonb: [{ email: judge.email }],
    };
    expect(
      planImport({ ...snapshot, contacts }, sources, 1).counts.ambiguities,
    ).toBe(1);
  });
  it("excludes identities missing from source and applies only the approved Vanessa correction", () => {
    const vanessa = { ...judge, prenom: "Vanessa", nom: "POURIN" };
    const data = {
      ...sources,
      judges: [vanessa, { ...judge, juge_id: "unknown", prenom: "", nom: "" }],
    };
    const report = planImport(
      {
        ...snapshot,
        contacts: [
          {
            id: 494,
            first_name: "Vanessa",
            last_name: "Old",
            status: "mort",
            company_ids: [8],
          },
        ],
      },
      data,
      1,
    );
    expect(report.exclusions).toHaveLength(1);
    expect(
      report.actions.find((a) => a.table === "contacts").data,
    ).toMatchObject({ last_name: "POURIN", company_ids: [8, 1] });
    expect(
      report.actions.find((a) => a.table === "contacts").data.status,
    ).toBeUndefined();
  });
  it("applies atomically with audit, textual IDs and a second run with zero modifications", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tenup-test-"));
    const db = createClient({ url: `file:${dir}/test.db` });
    await db.executeMultiple(
      readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"),
    );
    await db.execute(
      "INSERT INTO sales(id,first_name,email) VALUES(1,'Sylvain','s@example.org')",
    );
    const tx = await db.transaction("write");
    const report = planImport(await readSnapshot(tx), sources, 1);
    await applyPlan(tx, report);
    expect(planImport(await readSnapshot(tx), sources, 1).actions).toEqual([]);
    expect(
      (await tx.execute("SELECT count(*) n FROM record_history")).rows[0].n,
    ).toBe(2);
    expect(
      (await tx.execute("SELECT tenup_id FROM contacts")).rows[0].tenup_id,
    ).toBe("007");
    await tx.rollback();
    expect(
      (await db.execute("SELECT count(*) n FROM contacts")).rows[0].n,
    ).toBe(0);
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
