// Deploy-time migration: adds the `record_history` audit-log table.
// Brings a live Turso database in sync with the `db/schema.sql` delta —
// an append-only log of create/update writes, populated by
// server/query.mjs (see logHistory()), consumed by the hidden /logs page
// (src/components/atomic-crm/logs/LogsPage.tsx).
//
// Usage:
//   node --env-file=.env db/migrations/20260826101013_cec4d43d_migration_add-record-history.mjs
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error(
    "TURSO_DATABASE_URL is not set (use --env-file=.env or export it).",
  );
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

// Statements mirror db/schema.sql verbatim.
await client.executeMultiple(`
CREATE TABLE IF NOT EXISTS record_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name  TEXT NOT NULL,
    record_id   TEXT NOT NULL,
    action      TEXT NOT NULL CHECK (action IN ('create', 'update')),
    data        TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS record_history_table_record_idx ON record_history (table_name, record_id);
CREATE INDEX IF NOT EXISTS record_history_created_at_idx   ON record_history (created_at);
`);

// This is a CLI tool: its whole job is to report progress to stdout. ESLint's
// no-console rule only permits warn/error, so write to stdout directly.
process.stdout.write("Created record_history table\n");

client.close();
process.stdout.write(`Migration applied to ${url}\n`);
