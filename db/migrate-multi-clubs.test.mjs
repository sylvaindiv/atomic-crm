import { describe, it, expect } from "vitest";
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { migrateMultiClubs } from "./migrate-multi-clubs.mjs";
import { prepareContactClubs } from "../server/contact-clubs.mjs";

const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
describe("multi-clubs integrity", () => {
  it("migrates twice without losing contacts, children or memberships; deleting a club detaches", async () => {
    const db = createClient({ url: "file::memory:" });
    const old = schema
      .replaceAll("    tenup_id       TEXT,\n", "")
      .replace("    company_ids    TEXT NOT NULL DEFAULT '[]',\n", "")
      .replace(
        "company_id     INTEGER REFERENCES companies(id) ON UPDATE CASCADE ON DELETE SET NULL",
        "company_id     INTEGER REFERENCES companies(id) ON UPDATE CASCADE ON DELETE CASCADE",
      )
      .split("CREATE UNIQUE INDEX IF NOT EXISTS companies_tenup_id_idx")[0];
    await db.executeMultiple(old);
    await db.executeMultiple(
      "INSERT INTO companies(id,name) VALUES (1,'A'),(2,'B'); INSERT INTO contacts(id,company_id,status) VALUES (1,1,'mort'); INSERT INTO contact_notes(id,contact_id,text) VALUES(1,1,'history'); INSERT INTO tasks(id,contact_id,text) VALUES(1,1,'keep');",
    );
    await migrateMultiClubs(db);
    await db.executeMultiple(schema);
    await migrateMultiClubs(db);
    expect(
      (await db.execute("SELECT company_ids,status FROM contacts")).rows[0],
    ).toMatchObject({ company_ids: "[1]", status: "mort" });
    await db.execute("UPDATE contacts SET company_ids='[1,2]'");
    expect(
      (await db.execute("SELECT nb_contacts FROM companies_summary")).rows.map(
        (r) => r.nb_contacts,
      ),
    ).toEqual([1, 1]);
    await db.execute("DELETE FROM companies WHERE id=1");
    expect(
      (await db.execute("SELECT company_id,company_ids FROM contacts")).rows[0],
    ).toMatchObject({ company_id: 2, company_ids: "[2]" });
    expect(
      (await db.execute("SELECT count(*) n FROM contact_notes")).rows[0].n,
    ).toBe(1);
    expect((await db.execute("SELECT count(*) n FROM tasks")).rows[0].n).toBe(
      1,
    );
    expect((await db.execute("PRAGMA foreign_key_check")).rows).toEqual([]);
    db.close();
  });
  it("preserves secondary clubs for legacy writes, rejects invalid lists and partner multiplicity", async () => {
    const db = createClient({ url: "file::memory:" });
    await db.executeMultiple(schema);
    await db.execute(
      "INSERT INTO companies(id,name) VALUES(1,'A'),(2,'B'),(3,'C')",
    );
    expect(
      await prepareContactClubs({ company_id: 3 }, { company_ids: [1, 2] }, db),
    ).toMatchObject({ company_id: 3, company_ids: [3, 2] });
    expect(
      await prepareContactClubs(
        { company_id: null },
        { company_ids: [1, 2] },
        db,
      ),
    ).toMatchObject({ company_id: 2, company_ids: [2] });
    for (const ids of [[1, 1], ["1"], [4], [-1], null])
      await expect(
        prepareContactClubs({ company_ids: ids }, null, db),
      ).rejects.toThrow();
    await expect(
      prepareContactClubs(
        { company_ids: [1, 2], contact_type: "partner" },
        null,
        db,
      ),
    ).rejects.toThrow("only one");
    db.close();
  });
});
