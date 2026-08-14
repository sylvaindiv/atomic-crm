# ADR-02f50f28-TASK-003 — Club duplicate matching by normalized name only

- **Date**: 2026-08-14
- **Ticket**: TASK-003
- **Session**: 02f50f28

## Context

The club merge dialog needs to suggest duplicate clubs, mirroring the contact
merge dialog's `findDuplicateContacts` (ADR-02f50f28-TASK-002). Contacts union
three signals (name, email, phone) into a ranked candidate list. No company
row has `phone_number`, `website` or `address` populated in production, so
none of the contact-side secondary signals apply to clubs.

## Decision

`findDuplicateCompanies` reuses the shared `normalizeText` helper but matches
on normalized name only, returning plain `Company[]` (no `matchedBy` /
ranking wrapper, since there is only one match reason) instead of mirroring
the full `DuplicateContactCandidate` shape.

## Consequences

- Simpler than the contact equivalent -- no ranking logic, one query.
- If clubs later gain a second usable signal (e.g. website), the function
  would need a `matchedBy`-style return like `findDuplicateContacts`.

## Alternatives considered

- Copy `findDuplicateContacts`'s full ranked-candidate shape for structural
  symmetry -- rejected, dead code for the two match reasons clubs can never
  produce today.
