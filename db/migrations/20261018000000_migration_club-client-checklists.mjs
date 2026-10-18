// Move legacy per-contact client progress into club and club/referee records.
// Usage: node --env-file=.env db/migrations/20261018000000_migration_club-client-checklists.mjs
import { createClient } from "@libsql/client";
import { migrateClubClientChecklists } from "../migrate-club-client-checklists.mjs";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error(
    "TURSO_DATABASE_URL is not set (use --env-file=.env or export it).",
  );
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
try {
  const result = await migrateClubClientChecklists(client);
  if (result.orphaned.length) {
    process.stdout.write(
      `Legacy clients without clubs: ${result.orphaned.join(", ")}\n`,
    );
  }
} finally {
  client.close();
}

process.stdout.write(`Migration applied to ${url}\n`);
