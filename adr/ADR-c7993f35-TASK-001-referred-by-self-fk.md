# ADR-c7993f35-TASK-001 — Self-referencing referred_by FK on contacts

- **Date**: 2026-07-24
- **Ticket**: TASK-001
- **Session**: c7993f35

## Context

The CRM needs to track "Connu par" (referral source): which existing contact introduced a new one. First self-referencing relationship on `contacts`, plus a denormalized display name so list/show/export avoid an extra lookup.

## Decision

Add `contacts.referred_by_id INTEGER REFERENCES contacts(id) ON UPDATE CASCADE ON DELETE SET NULL`, and expose `referred_by_name` in `contacts_summary` via a self-join subquery, mirroring the existing `company_name` pattern.

## Consequences

- `ON DELETE SET NULL` (not `CASCADE` like `company_id`): deleting a referrer must not delete the contacts they referred — that would be silent, unrelated data loss.
- `db/schema.sql` is the source of truth; views are dropped/recreated on every apply so the view edit takes effect automatically, but table columns are not retrofitted onto an already-provisioned live database.
- One-time manual post-deploy step, run by the human operator via `turso db shell <name>` (not automated, not run by CI/developer): `ALTER TABLE contacts ADD COLUMN referred_by_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL;`
- Existing rows get `NULL` on that ALTER, which satisfies the FK — no backfill needed.

## Alternatives considered

- _Not captured at decision time._
