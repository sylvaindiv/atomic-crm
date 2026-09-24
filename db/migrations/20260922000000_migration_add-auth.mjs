// Deploy-time additive migration for private authentication tables.
// Usage: node --env-file=.env db/migrations/20260922000000_migration_add-auth.mjs
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error(
    "TURSO_DATABASE_URL is not set (use --env-file=.env or export it).",
  );
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
await client.executeMultiple(`
CREATE TABLE IF NOT EXISTS auth_credentials (
    sales_id INTEGER PRIMARY KEY REFERENCES sales(id) ON DELETE CASCADE,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    must_change_password INTEGER NOT NULL DEFAULT 1,
    temporary_expires_at TEXT,
    credential_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    sales_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    credential_version INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS auth_login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL COLLATE NOCASE,
    remote_address TEXT NOT NULL,
    attempted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS auth_sessions_sales_id_idx ON auth_sessions (sales_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions (expires_at);
CREATE INDEX IF NOT EXISTS auth_login_attempts_email_idx ON auth_login_attempts (email, attempted_at);
CREATE INDEX IF NOT EXISTS auth_login_attempts_address_idx ON auth_login_attempts (remote_address, attempted_at);
`);
client.close();
process.stdout.write("Created private authentication tables\n");
