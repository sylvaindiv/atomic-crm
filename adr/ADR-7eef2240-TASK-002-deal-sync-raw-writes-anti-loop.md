# ADR-7eef2240-TASK-002 — Deal sync writes raw SQL, never the generic update()

- **Date**: 2026-08-04
- **Ticket**: TASK-002
- **Session**: 7eef2240

## Context

A judge/club's `status` and its linked deal's Kanban `stage` must stay in
sync in both directions, hooked into the end of `query.mjs`'s generic
`update()`. A hook that propagated a change by calling `update()` again
(the DRY-looking option) would re-trigger itself on the write it just made,
since both directions live in the same hook — an unbounded ping-pong between
contact/company and deal.

## Decision

`dealSync.mjs` propagates both directions with raw, parameterized
`db.execute` calls, never through `query.mjs`'s `update()`. Because the hook
only fires from inside `update()`, a raw write can never re-enter it: a
change propagates exactly one hop and terminates.

## Consequences

- Guarantees termination without a visited-set/depth-guard mechanism.
- `dealSync.mjs` duplicates a small amount of write logic (`prepareWrite`-style
  column handling) instead of reusing `update()`.
- Future edits to `dealSync.mjs` must preserve this invariant — routing a
  propagation write through `update()` reintroduces the loop.

## Alternatives considered

- Call `update()` recursively with a “skip sync” flag — rejected: an extra
  parameter threaded through the generic CRUD layer for one caller, more
  surface area than a raw write.
