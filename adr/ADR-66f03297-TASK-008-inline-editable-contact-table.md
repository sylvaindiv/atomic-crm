# ADR-66f03297-TASK-008 — Click-cell-to-mutate contact table

- **Date**: 2026-07-29
- **Ticket**: TASK-008
- **Session**: 66f03297

## Context

The desktop Contacts list moves from a card list (`ContactListContent`,
whole row wrapped in a `<Link>`) to a dense `DataTable` with ~17 columns,
11 of them inline-editable (TASK-005/006/007's `Editable*Cell` family). A
`DataTable.Col` cell renders inside a table row, not inside a react-hook-form
`<Form>` — so `admin/*-input.tsx` and ra-core's `useInput()`, which both
require a form ancestor, cannot be reused as-is for inline edits.

## Decision

Set `rowClick={false}` on `<DataTable>` — the row itself no longer navigates.
The `name` column is the sole exception: it renders its own `<Link>` to the
Show page. Every editable cell is hand-rolled against `useUpdateContactField`
(single-column optimistic `useUpdate`) instead of `useInput()`, reusing
existing standalone selectors (`ContactStatusSelector`, `TagsListEdit`) where
one already existed.

## Consequences

- Editable cells never fight the row for the click event; no `stopPropagation`
  choreography against a live row link is needed for correctness (kept anyway
  on each cell, for defense-in-depth and consistency with its siblings).
- Losing row-wide navigation means `name` must render its own `Link` — the
  only column allowed to navigate.
- Any future editable column follows the same hand-rolled, form-less pattern,
  not `admin/*-input.tsx`.

## Alternatives considered

- Wrap each row in its own `<Form>` to reuse `*-input.tsx` directly: rejected
  — one form per row is heavier and inconsistent with the
  `ContactStatusSelector`/`TagsListEdit` precedent of standalone selectors.
- Per-row "quick edit" sheet reusing `ContactEditSheet`: cheaper to build, but
  fails the one-click inline-cell requirement (still a modal detour).
