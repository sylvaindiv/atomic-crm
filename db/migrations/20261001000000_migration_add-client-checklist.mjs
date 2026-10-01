// Adds per-contact client checklist progress to an existing database.
// Usage: node --env-file=.env db/migrations/20261001000000_migration_add-client-checklist.mjs
import { createClient } from "@libsql/client";
import { migrateClientChecklist } from "../migrate-client-checklist.mjs";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error(
    "TURSO_DATABASE_URL is not set (use --env-file=.env or export it).",
  );
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

try {
  await migrateClientChecklist(client);
  process.stdout.write("Added contacts.client_checklist if missing\n");
} finally {
  client.close();
}

process.stdout.write(`Migration applied to ${url}\n`);
