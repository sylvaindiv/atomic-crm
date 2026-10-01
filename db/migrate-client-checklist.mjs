// CREATE TABLE IF NOT EXISTS does not add columns to an existing SQLite table.
// Run before schema.sql refreshes contacts_summary, without changing existing rows.
export async function migrateClientChecklist(client) {
  const { rows: tables } = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'contacts'",
  );
  if (tables.length === 0) return;

  const { rows: columns } = await client.execute(
    'PRAGMA table_info("contacts")',
  );
  if (columns.some((column) => column.name === "client_checklist")) return;

  await client.execute(
    "ALTER TABLE contacts ADD COLUMN client_checklist TEXT NOT NULL DEFAULT '[]'",
  );
}
