# ADR-33662640-TASK-001 — Fold the deals entity into contacts

- **Date**: 2026-08-15
- **Ticket**: TASK-001
- **Session**: 33662640

## Context

Every deal now requires exactly one linked contact (or, for club deals, a
company) and a next-action task on that contact — the `deals` table had
become a thin wrapper duplicating fields (`amount`, `description`,
`"index"`) that conceptually belong to the party itself. `deals_summary`
recomputed `next_action_due_date` from `contact_ids[0]` via
`json_extract`, one hop removed from the task it actually reads.

## Decision

Drop `deals` and `deal_notes` entirely. Move `amount`, `description` and
`"index"` onto `contacts`. Compute `next_action_due_date` directly on
`contacts_summary` (`MIN(due_date)` of that contact's open tasks, no JSON
indirection). Drop `contacts_summary.linked_deal_id`,
`companies.status` and `companies_summary.nb_deals`.

## Consequences

- A "deal" is now just a contact row — no separate pipeline entity, no
  `case_type`/`stage` duplication to keep in sync with contact status.
- Club deals (company-scoped, no single obvious contact) have no clean
  1:1 target for the columns moved onto `contacts` — the deploy-time
  migration must backfill judge deals from `contact_ids[0]` and flag
  `case_type = 'club'` rows for **manual** human review before dropping
  the source tables (see ticket description / commit message).
- `server/dealSync.mjs` (status↔stage sync) and every `src/.../deals/*`
  UI file become dead code — out of scope for this ticket (schema only),
  tracked as follow-up cleanup.
- This is a schema-only commit; no migration file, no live DB write.

## Alternatives considered

- Keep `deals` as a thin table with only `contact_id` + `case_type` —
  rejected: still duplicates contact identity/status without removing the
  sync complexity that motivated this change.
