import { readFileSync } from "node:fs";

// Rebuild only contacts: changing ON DELETE must preserve its children and IDs.
export async function migrateMultiClubs(client) {
  const { rows } = await client.execute("PRAGMA table_info(contacts)");
  if (!rows.length || rows.some((r) => r.name === "company_ids")) return;
  const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  const definition = schema.match(
    /CREATE TABLE IF NOT EXISTS contacts \([\s\S]*?\n\);/,
  )[0];
  const columns = rows.map((r) => `"${r.name}"`).join(",");
  const views = (
    await client.execute(
      "SELECT name, sql FROM sqlite_master WHERE type='view'",
    )
  ).rows;
  const indexes = (
    await client.execute(
      "SELECT sql FROM sqlite_master WHERE type IN ('index','trigger') AND tbl_name='contacts' AND sql IS NOT NULL",
    )
  ).rows;
  try {
    await client.executeMultiple(`
      PRAGMA foreign_keys = OFF;
      BEGIN IMMEDIATE;
      ${views.map((v) => `DROP VIEW "${v.name}";`).join("\n")}
      CREATE TEMP TABLE migration_contacts_sequence AS SELECT seq FROM sqlite_sequence WHERE name='contacts';
      ${definition.replace("IF NOT EXISTS contacts", "contacts_multi")}
      INSERT INTO contacts_multi (${columns}, company_ids)
        SELECT ${columns}, CASE WHEN company_id IS NULL THEN '[]' ELSE json_array(company_id) END FROM contacts;
      DROP TABLE contacts;
      ALTER TABLE contacts_multi RENAME TO contacts;
      UPDATE sqlite_sequence SET seq = max(seq, coalesce((SELECT seq FROM migration_contacts_sequence), 0)) WHERE name='contacts';
      DROP TABLE migration_contacts_sequence;
      ALTER TABLE companies ADD COLUMN tenup_id TEXT;
      ${indexes.map((r) => r.sql + ";").join("\n")}
      ${views.map((v) => v.sql + ";").join("\n")}
      CREATE TEMP TABLE migration_integrity (violations INTEGER CHECK (violations = 0));
      INSERT INTO migration_integrity SELECT count(*) FROM pragma_foreign_key_check;
      DROP TABLE migration_integrity;
      COMMIT;
      PRAGMA foreign_keys = ON;
    `);
  } catch (error) {
    try {
      await client.executeMultiple("ROLLBACK; PRAGMA foreign_keys = ON;");
    } catch {
      /* Keep the migration error. */
    }
    throw error;
  }
}
