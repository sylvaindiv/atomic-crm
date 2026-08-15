// Deploy-time migration for session 844e8bcb (compact Kanban deal card).
// Brings a live Turso database in sync with the `db/schema.sql` delta:
//   - new `deals_summary` view: adds club_name, contact_name and the due
//     date of the deal's next open action (earliest open task of
//     contact_ids[0]), consumed by the frontend's `deals` getList/getOne
//     (see src/components/atomic-crm/providers/turso/dataProvider.ts).
//
// No column was added to the `deals` table itself: `case_type` already
// exists (deployed by 20260804141928_7eef2240_migration_judge-club-status-pipeline.mjs).
// This is a brand-new view (not a recreation of an existing one), so there
// is no ordinal-position constraint to preserve.
//
// Usage:
//   node --env-file=.env db/migrations/20260814091038_844e8bcb_migration_deals-summary-view.mjs
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

// SQLite has no CREATE OR REPLACE VIEW, so drop + recreate (safe: views hold
// no data of their own). Statement mirrors db/schema.sql verbatim.
await client.executeMultiple(`
DROP VIEW IF EXISTS deals_summary;
CREATE VIEW deals_summary AS
SELECT
    d.*,
    (SELECT trim(coalesce(co.first_name,'') || ' ' || coalesce(co.last_name,''))
       FROM contacts co WHERE co.id = json_extract(d.contact_ids, '$[0]')
    ) AS contact_name,
    CASE
      WHEN d.case_type = 'club' THEN (SELECT cmp.name FROM companies cmp WHERE cmp.id = d.company_id)
      ELSE (SELECT cmp.name FROM contacts co JOIN companies cmp ON cmp.id = co.company_id
             WHERE co.id = json_extract(d.contact_ids, '$[0]'))
    END AS club_name,
    (SELECT MIN(t.due_date) FROM tasks t
       WHERE t.contact_id = json_extract(d.contact_ids, '$[0]') AND t.done_date IS NULL
    ) AS next_action_due_date
FROM deals d;
`);
print("Created deals_summary view");

client.close();
print(`Migration applied to ${url}`);
