import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { migrateCompanyContact } from "./migrate-company-contact.mjs";

describe("migrateCompanyContact", () => {
  it("provisions a fresh database, reads new fields, and survives a rerun", async () => {
    const client = createClient({ url: ":memory:" });
    try {
      await migrateCompanyContact(client);
      await client.executeMultiple(
        readFileSync(new URL("./schema.sql", import.meta.url), "utf8"),
      );
      await client.execute({
        sql: "INSERT INTO companies (name, email, social_links) VALUES (?, ?, ?)",
        args: ["A", "a@example.org", '["https://example.org"]'],
      });
      await client.execute(
        "INSERT INTO contacts (company_id, contact_type) VALUES (1, 'partner'), (1, 'referee')",
      );
      await migrateCompanyContact(client);
      await client.executeMultiple(
        readFileSync(new URL("./schema.sql", import.meta.url), "utf8"),
      );
      const { rows } = await client.execute(
        "SELECT email, social_links, nb_contacts FROM companies_summary",
      );
      expect(rows).toEqual([
        {
          email: "a@example.org",
          social_links: '["https://example.org"]',
          nb_contacts: 1,
        },
      ]);
    } finally {
      client.close();
    }
  });

  it("migrates an existing club without losing data or adding columns twice", async () => {
    const client = createClient({ url: ":memory:" });
    try {
      await client.execute(
        "CREATE TABLE companies (id INTEGER PRIMARY KEY, name TEXT)",
      );
      await client.execute("INSERT INTO companies (name) VALUES ('Existing')");
      await migrateCompanyContact(client);
      await client.execute({
        sql: "UPDATE companies SET email = ?, social_links = ? WHERE id = 1",
        args: ["club@example.org", '["https://social.example.org"]'],
      });
      await migrateCompanyContact(client);
      const { rows } = await client.execute(
        "SELECT name, email, social_links FROM companies",
      );
      expect(rows).toEqual([
        {
          name: "Existing",
          email: "club@example.org",
          social_links: '["https://social.example.org"]',
        },
      ]);
    } finally {
      client.close();
    }
  });
});
