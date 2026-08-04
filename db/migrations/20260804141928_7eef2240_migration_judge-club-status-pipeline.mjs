// Deploy-time migration for session 7eef2240 (judge/club status-driven deal
// pipeline). Brings a live Turso database in sync with the `db/schema.sql`
// delta:
//   - companies.status            TEXT
//   - deals.case_type             TEXT NOT NULL DEFAULT 'club' (+ index)
//   - contacts_summary.linked_deal_id (computed column)
//
// SQLite's `ALTER TABLE ... ADD COLUMN` has no `IF NOT EXISTS` clause, so
// idempotency is enforced in JS via `pragma_table_info`, mirroring the
// seed-data guard already used in db/apply-schema.mjs. `companies_summary`
// needs no change: it selects `c.*`, so `companies.status` is picked up
// automatically by SQLite's view-text substitution once the column exists.
//
// Usage:
//   node --env-file=.env db/migrations/20260804141928_7eef2240_migration_judge-club-status-pipeline.mjs
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

if (!(await hasColumn("companies", "status"))) {
  await client.execute("ALTER TABLE companies ADD COLUMN status TEXT");
  print("Added companies.status");
} else {
  print("Skipped companies.status (already present)");
}

if (!(await hasColumn("deals", "case_type"))) {
  await client.execute(
    "ALTER TABLE deals ADD COLUMN case_type TEXT NOT NULL DEFAULT 'club'",
  );
  print("Added deals.case_type");
} else {
  print("Skipped deals.case_type (already present)");
}

await client.execute(
  "CREATE INDEX IF NOT EXISTS deals_case_type_idx ON deals (case_type)",
);
print("Ensured deals_case_type_idx");

// contacts_summary gains a computed linked_deal_id column. SQLite has no
// CREATE OR REPLACE VIEW, so drop + recreate (safe: views hold no data of
// their own). Statement mirrors db/schema.sql verbatim.
await client.executeMultiple(`
DROP VIEW IF EXISTS contacts_summary;
CREATE VIEW contacts_summary AS
SELECT
    co.*,
    (SELECT group_concat(json_extract(je.value, '$.email'), ' ')
       FROM json_each(CASE WHEN json_valid(co.email_jsonb) THEN co.email_jsonb ELSE '[]' END) je
    ) AS email_fts,
    (SELECT group_concat(json_extract(je.value, '$.number'), ' ')
       FROM json_each(CASE WHEN json_valid(co.phone_jsonb) THEN co.phone_jsonb ELSE '[]' END) je
    ) AS phone_fts,
    (SELECT cmp.name FROM companies cmp WHERE cmp.id = co.company_id) AS company_name,
    (SELECT trim(coalesce(r.first_name, '') || ' ' || coalesce(r.last_name, ''))
       FROM contacts r WHERE r.id = co.referred_by_id
    ) AS referred_by_name,
    (SELECT count(*) FROM tasks t WHERE t.contact_id = co.id AND t.done_date IS NULL) AS nb_tasks,
    (SELECT text FROM contact_notes cn WHERE cn.contact_id = co.id ORDER BY date DESC LIMIT 1) AS latest_note_text,
    -- Most recent non-archived 'judge' deal this contact is a party to.
    (SELECT d.id FROM deals d
       WHERE d.case_type = 'judge'
         AND d.archived_at IS NULL
         AND EXISTS (
           SELECT 1 FROM json_each(CASE WHEN json_valid(d.contact_ids) THEN d.contact_ids ELSE '[]' END) je
           WHERE je.value = co.id
         )
       ORDER BY d.created_at DESC
       LIMIT 1
    ) AS linked_deal_id
FROM contacts co;
`);
print("Recreated contacts_summary view with linked_deal_id");

client.close();
print(`Migration applied to ${url}`);
