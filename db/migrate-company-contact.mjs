// CREATE TABLE IF NOT EXISTS does not add columns to an existing table.
export async function migrateCompanyContact(client) {
  const { rows: tables } = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'companies'",
  );
  if (!tables.length) return;

  const { rows: columns } = await client.execute(
    'PRAGMA table_info("companies")',
  );
  const names = new Set(columns.map((column) => column.name));
  if (!names.has("email")) {
    await client.execute("ALTER TABLE companies ADD COLUMN email TEXT");
  }
  if (!names.has("social_links")) {
    await client.execute("ALTER TABLE companies ADD COLUMN social_links TEXT");
  }
}
