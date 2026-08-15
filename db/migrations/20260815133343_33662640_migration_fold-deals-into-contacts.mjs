// Deploy-time migration for session 33662640 (fold deals into contacts).
// Brings a live Turso database in sync with the `db/schema.sql` delta:
//   - contacts gains: amount, description, "index" (backfilled from deals,
//     see below)
//   - contacts_summary: adds next_action_due_date, drops linked_deal_id
//   - deals, deal_notes tables and the deals_summary view are dropped
//   - companies drops: status
//   - companies_summary: drops nb_deals
//
// See adr/ADR-33662640-TASK-001-fold-deals-into-contacts.md.
//
// BACKFILL / MANUAL-REVIEW GATE (read before running in production)
// -------------------------------------------------------------------------
// Every 'judge' deal maps 1:1 onto a single contact (contact_ids[0]), so its
// amount/description/index backfill onto that contact automatically below.
// 'club' deals are company-scoped (no single obvious contact) and have no
// clean 1:1 target among the columns moved onto `contacts`. This dev
// workspace has no DB credentials to check the real Turso database for
// such rows ahead of time, so this script performs the check itself, at
// migration time:
//
//     SELECT * FROM deals WHERE case_type = 'club'
//
// If that query returns any rows, the script prints them and ABORTS
// (non-zero exit) *before* touching contacts/deals/deal_notes/views or
// companies — no destructive statement runs. Re-running this script is
// then safe (adding columns and backfilling judge deals is idempotent),
// but the drop of `deals`/`deal_notes`/`companies.status` only proceeds
// once that SELECT returns zero rows — i.e. once a human has manually
// reviewed and resolved the flagged club-type deals (migrate them by
// hand, or confirm they can be discarded) and re-runs the migration.
//
// SQLite's `ALTER TABLE ... ADD/DROP COLUMN` has no `IF [NOT] EXISTS`
// clause, so idempotency is enforced in JS via `pragma_table_info`,
// mirroring the pattern used by the other files in this directory.
//
// Usage:
//   node --env-file=.env db/migrations/20260815133343_33662640_migration_fold-deals-into-contacts.mjs
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

/** Returns true if a table with this name currently exists. */
async function hasTable(table) {
  const { rows } = await client.execute(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
    [table],
  );
  return rows.length > 0;
}

// ── 1. Add the contacts columns moved in from deals (idempotent) ──────────
for (const [column, ddl] of [
  ["amount", "ALTER TABLE contacts ADD COLUMN amount INTEGER"],
  ["description", "ALTER TABLE contacts ADD COLUMN description TEXT"],
  ["index", 'ALTER TABLE contacts ADD COLUMN "index" INTEGER'],
]) {
  if (!(await hasColumn("contacts", column))) {
    await client.execute(ddl);
    print(`Added contacts.${column}`);
  } else {
    print(`Skipped contacts.${column} (already present)`);
  }
}

// ── 2. Backfill 'judge' deals onto their single contact ────────────────────
if (await hasTable("deals")) {
  // json_extract resolves contact_ids[0] in SQL directly — no need to
  // JSON.parse a potentially malformed string in JS.
  const { rows: judgeDeals } = await client.execute(`
    SELECT amount, description, "index",
           json_extract(CASE WHEN json_valid(contact_ids) THEN contact_ids ELSE '[]' END, '$[0]') AS contact_id
    FROM deals WHERE case_type = 'judge'
  `);
  let backfilled = 0;
  for (const deal of judgeDeals) {
    if (deal.contact_id == null) continue;
    await client.execute(
      'UPDATE contacts SET amount = ?, description = ?, "index" = ? WHERE id = ?',
      [deal.amount, deal.description, deal.index, deal.contact_id],
    );
    backfilled++;
  }
  print(`Backfilled ${backfilled}/${judgeDeals.length} judge deal(s) onto contacts`);

  // ── 3. Manual-review gate: refuse to drop anything while 'club' deals
  //      exist — they have no 1:1 contact target. See header comment.
  const { rows: clubDeals } = await client.execute(
    "SELECT * FROM deals WHERE case_type = 'club'",
  );
  if (clubDeals.length > 0) {
    console.error(
      `\nABORTING: ${clubDeals.length} 'club' deal(s) found — they have no single contact to backfill onto:\n` +
        JSON.stringify(clubDeals, null, 2) +
        "\n\nManually review and resolve these rows (migrate or confirm discard), " +
        "then re-run this migration. No destructive statement has been run — " +
        "contacts columns were added/backfilled above, which is idempotent.",
    );
    client.close();
    process.exit(1);
  }
} else {
  print("Skipped deals backfill (deals table already dropped)");
}

// ── 4. Drop deals_summary, deal_notes, deals (only once the gate above
//      cleared, or the table was already dropped by a previous run) ───────
await client.executeMultiple(`
DROP VIEW IF EXISTS deals_summary;
DROP TABLE IF EXISTS deal_notes;
DROP TABLE IF EXISTS deals;
`);
print("Dropped deals_summary, deal_notes, deals");

// ── 5. Recreate contacts_summary: add next_action_due_date, drop
//      linked_deal_id. Statement mirrors db/schema.sql verbatim. ──────────
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
    (SELECT MIN(t.due_date) FROM tasks t WHERE t.contact_id = co.id AND t.done_date IS NULL) AS next_action_due_date
FROM contacts co;
`);
print("Recreated contacts_summary view (added next_action_due_date, dropped linked_deal_id)");

// ── 6. Drop companies.status ────────────────────────────────────────────
if (await hasColumn("companies", "status")) {
  await client.execute("ALTER TABLE companies DROP COLUMN status");
  print("Dropped companies.status");
} else {
  print("Skipped companies.status (already absent)");
}

// ── 7. Recreate companies_summary: drop nb_deals ────────────────────────
await client.executeMultiple(`
DROP VIEW IF EXISTS companies_summary;
CREATE VIEW companies_summary AS
SELECT
    c.*,
    (SELECT count(*) FROM contacts co WHERE co.company_id = c.id) AS nb_contacts
FROM companies c;
`);
print("Recreated companies_summary view (dropped nb_deals)");

client.close();
print(`Migration applied to ${url}`);
