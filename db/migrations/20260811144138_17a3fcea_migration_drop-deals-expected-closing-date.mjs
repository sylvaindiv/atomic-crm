// Deploy-time migration for session 17a3fcea (deal form cleanup). Brings a
// live Turso database in sync with the `db/schema.sql` delta:
//   - deals.expected_closing_date dropped (field removed from the form/type;
//     deals now use a mandatory "next action" instead)
//
// `amount` becoming optional in the TS type needs no DDL: the column was
// already nullable (`amount INTEGER`, no NOT NULL) in db/schema.sql.
//
// SQLite's `ALTER TABLE ... DROP COLUMN` has no `IF EXISTS` clause, so
// idempotency is enforced in JS via `pragma_table_info`, mirroring
// db/migrations/20260804141928_7eef2240_migration_judge-club-status-pipeline.mjs.
// No view selects `expected_closing_date`, so nothing else needs recreating.
//
// Usage:
//   node --env-file=.env db/migrations/20260811144138_17a3fcea_migration_drop-deals-expected-closing-date.mjs
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error(
    "TURSO_DATABASE_URL is not set (use --env-file=.env or export it).",
  );
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

// This is a CLI tool: its whole job is to report progress to stdout. ESLint's
// no-console rule only permits warn/error, so write to stdout directly.
const print = (s) => process.stdout.write(s + "\n");

/** Returns true if `table` already has a column named `column`. */
async function hasColumn(table, column) {
  const { rows } = await client.execute(`PRAGMA table_info(${table})`);
  return rows.some((row) => row.name === column);
}

if (await hasColumn("deals", "expected_closing_date")) {
  await client.execute("ALTER TABLE deals DROP COLUMN expected_closing_date");
  print("Dropped deals.expected_closing_date");
} else {
  print("Skipped deals.expected_closing_date (already absent)");
}

client.close();
print(`Migration applied to ${url}`);
