import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { planImport, applyPlan, readSnapshot } from "./import-tenup.mjs";

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
