import { createClient } from "@libsql/client";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { migrateClubClientChecklists } from "./migrate-club-client-checklists.mjs";

describe("migrateClubClientChecklists", () => {
  it("runs against a fresh schema and remains a no-op after the first run", async () => {
    const directory = await mkdtemp(join(tmpdir(), "crm-club-fresh-"));
    const client = createClient({ url: `file:${join(directory, "test.db")}` });
    try {
      await client.executeMultiple(
        readFileSync(new URL("./schema.sql", import.meta.url), "utf8"),
      );
      expect(await migrateClubClientChecklists(client)).toEqual({
        migrated: true,
        orphaned: [],
      });
      expect(await migrateClubClientChecklists(client)).toEqual({
        migrated: false,
        orphaned: [],
      });
      const { rows } = await client.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'club_referees'",
      );
      expect(rows).toHaveLength(1);
    } finally {
      client.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("moves old selections to independent club/referee progress and is one-time", async () => {
    const directory = await mkdtemp(join(tmpdir(), "crm-club-migration-"));
    const client = createClient({ url: `file:${join(directory, "test.db")}` });
    try {
      await client.executeMultiple(`
        CREATE TABLE companies (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE contacts (id INTEGER PRIMARY KEY, contact_type TEXT, company_id INTEGER, status TEXT, client_checklist TEXT);
        CREATE TABLE configuration (id INTEGER PRIMARY KEY, config TEXT NOT NULL);
        INSERT INTO companies (id, name) VALUES (1, 'Club A'), (2, 'Club B');
        INSERT INTO contacts VALUES (1, 'referee', 1, 'client', '["stripe-connected","mouja-installed","first-tournament","custom"]');
        INSERT INTO contacts VALUES (2, 'referee', 1, 'prospect', '["advantage-system-configured","mouja-installed"]');
        INSERT INTO contacts VALUES (3, 'referee', NULL, 'client', '["stripe-connected"]');
        INSERT INTO configuration VALUES (1, '{"clientChecklist":[{"value":"mouja-installed","label":"MOJA"},{"value":"stripe-connected","label":"Stripe"},{"value":"custom","label":"Étape perso"}]}');
      `);
      const first = await migrateClubClientChecklists(client);
      expect(first).toEqual({ migrated: true, orphaned: [3] });
      const { rows: companies } = await client.execute(
        "SELECT id, is_client, client_checklist FROM companies ORDER BY id",
      );
      expect(companies).toEqual([
        {
          id: 1,
          is_client: 1,
          client_checklist:
            '["stripe-connected","advantage-system-configured"]',
        },
        { id: 2, is_client: 0, client_checklist: "[]" },
      ]);
      const { rows: links } = await client.execute(
        "SELECT company_id, contact_id, client_checklist FROM club_referees ORDER BY contact_id",
      );
      expect(links).toEqual([
        {
          company_id: 1,
          contact_id: 1,
          client_checklist: '["mouja-installed","first-tournament","custom"]',
        },
        {
          company_id: 1,
          contact_id: 2,
          client_checklist: '["mouja-installed"]',
        },
      ]);
      const { rows: config } = await client.execute(
        "SELECT config FROM configuration WHERE id = 1",
      );
      expect(JSON.parse(config[0].config)).toEqual({
        clientChecklist: [
          { value: "mouja-installed", label: "MOJA" },
          { value: "stripe-connected", label: "Stripe" },
          { value: "custom", label: "Étape perso" },
        ],
        clubChecklist: [{ value: "stripe-connected", label: "Stripe" }],
        refereeChecklist: [
          { value: "mouja-installed", label: "MOJA" },
          { value: "custom", label: "Étape perso" },
        ],
      });
      await client.execute("UPDATE companies SET is_client = 0 WHERE id = 1");
      await migrateClubClientChecklists(client);
      const { rows: rerun } = await client.execute(
        "SELECT is_client FROM companies WHERE id = 1",
      );
      expect(rerun[0].is_client).toBe(0);
    } finally {
      client.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
