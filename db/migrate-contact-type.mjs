// CREATE TABLE IF NOT EXISTS never adds columns to an existing SQLite table.
// Run this before applying schema.sql, which recreates contacts_summary and
// creates the contact_type index. Re-running it leaves every row untouched.
export async function migrateContactType(client) {
  const { rows: tables } = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'contacts'",
  );
  if (tables.length === 0) return;

  const { rows: columns } = await client.execute(
    'PRAGMA table_info("contacts")',
  );
  if (columns.some((column) => column.name === "contact_type")) return;

  await client.execute(
    "ALTER TABLE contacts ADD COLUMN contact_type TEXT NOT NULL DEFAULT 'referee' CHECK (contact_type IN ('referee', 'partner'))",
  );
}
