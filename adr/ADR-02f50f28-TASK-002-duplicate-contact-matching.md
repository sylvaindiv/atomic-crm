# ADR-02f50f28-TASK-002 — Client-side duplicate contact matching

- **Date**: 2026-08-14
- **Ticket**: TASK-002
- **Session**: 02f50f28

## Context

The merge dialog needs to suggest duplicate contacts by name (case/accent-
insensitive), shared email, or shared phone. `email_jsonb`/`phone_jsonb` are
arrays of `{email|number, type}` objects; the backend's `@cs` filter operator
(`server/filter.mjs`) only matches whole array elements, not a sub-field, so
it can't express "any entry's `email` equals X". Name comparison also needs
normalization the filter layer can't do server-side.

## Decision

`findDuplicateContacts` fetches a bounded contacts snapshot (perPage 1000,
same convention as `getContactsByName` in `useContactImport.tsx`, see
ADR-c7993f35-TASK-004) and matches name/email/phone client-side, unioning the
three lookups into one ranked candidate list. A name wrapped entirely in
parentheses (e.g. `"(non renseigne)"`) is treated as a placeholder and
excluded from name matching, generically rather than hardcoding this one
string.

## Consequences

- Correct for the sub-field containment case `@cs` can't express, and for
  accent/case-insensitive name matching.
- Costs one bounded full-table read per dialog open, not a narrow filter.
- The placeholder heuristic (parenthesized name) also catches future
  placeholder conventions of the same shape without a code change; a
  placeholder written differently (no parentheses) would slip through.

## Alternatives considered

- Add a computed normalized-name column/view for server-side filtering —
  rejected, schema change for one dialog's suggestion list.
- Hardcode `"(non renseigne)"` as the excluded name — rejected, ticket
  states the normalization/placeholder logic is reused by TASK-003 for club
  names, where the placeholder text may differ.
