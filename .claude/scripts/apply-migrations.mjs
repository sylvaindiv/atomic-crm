#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
//  apply-migrations — Apply committed db/migrations/*.mjs scripts
//  to the configured Turso (libSQL) database.
//
//  Usage:
//    node --env-file=.env .claude/scripts/apply-migrations.mjs
//
//  Behaviour:
//    Migrations are self-contained, idempotent scripts already committed
//    to db/migrations/ on the base branch (written by the deploy-time
//    migration round and merged by the merger) before this script runs.
//    There is no migrations-tracking table, so re-running every file on
//    each deploy is intentional and safe (see db/migrations/*.mjs).
//
//    Each file is run as a child process via `node --env-file=.env <file>`
//    (spawnSync, not dynamic import()) so a missing-env `process.exit(1)`
//    inside a migration only ends that child, not this loop.
// ─────────────────────────────────────────────────────────────
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error(
    "TURSO_DATABASE_URL is not set (use --env-file=.env or export it).",
  );
  process.exit(1);
}

// This is a CLI tool: its whole job is to report progress to stdout. ESLint's
// no-console rule only permits warn/error, so write to stdout directly.
const print = (s) => process.stdout.write(s + "\n");

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "..", "db", "migrations");

if (!existsSync(migrationsDir)) {
  print("No db/migrations/ directory found, nothing to apply.");
  process.exit(0);
}

// Filenames are timestamp-prefixed (YYYYMMDDHHMMSS_...), so a plain
// lexicographic sort gives chronological order.
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".mjs"))
  .sort();

if (migrations.length === 0) {
  print("db/migrations/ is empty, nothing to apply.");
  process.exit(0);
}

for (const file of migrations) {
  print(`Applying migration: ${file}`);
  const { status } = spawnSync(
    "node",
    ["--env-file=.env", join(migrationsDir, file)],
    { stdio: "inherit" },
  );
  if (status !== 0) {
    console.error(`Migration failed: ${file}`);
    process.exit(status ?? 1);
  }
}

print(`All migrations applied to ${url}`);
