# ADR-c7993f35-TASK-004 — Contact referral lookup fetches the full contacts table

- **Date**: 2026-07-24
- **Ticket**: TASK-004
- **Session**: c7993f35

## Context

CSV import resolves `known_via` to `referred_by_id` by matching an existing
contact's `first_name || ' ' || last_name`, case-insensitively. The existing
`fetchRecordsWithCache` pattern (companies/tags) narrows server-side with a
`name@in` filter, but contacts have no single filterable "name" column, and
the filter layer (`server/filter.mjs`) only matches real columns — a
computed concatenation can't be filtered on, and `IN` is case-sensitive.

## Decision

`getContactsByName` fetches the current contacts snapshot (bounded at 1000,
the existing "fetch effectively everything" convention also used in
`mergeContacts.ts`/`dataProvider.ts`) whenever a batch has an unresolved
name, and matches client-side, case-insensitively. Matches are cached for
the import run; unmatched names are re-checked on the next batch that
needs them (not permanently cached as "not found"), so a referrer created
by an earlier batch in the same import still resolves.

## Consequences

- Correct for any first/last name shape, unlike a server-side `@in` on a
  guessed first/last-name split would be.
- Costs one full-table read per import run in the common case, instead of
  a narrow `name@in` read.
- Same v1 limitation as the rest of this feature: a referrer defined later
  in the SAME batch isn't visible yet (creates run after lookups).

## Alternatives considered

- Add a computed `full_name` column/view for server-side filtering —
  rejected, a schema change for one lookup, still needs case handling.
- Split `known_via` into first/last tokens, filter server-side — rejected,
  ambiguous for multi-word names.
