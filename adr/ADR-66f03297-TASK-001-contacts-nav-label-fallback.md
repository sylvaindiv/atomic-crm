# ADR-66f03297-TASK-001 — Short "Referee" fallback for the contacts nav label

- **Date**: 2026-07-29
- **Ticket**: TASK-001
- **Session**: 66f03297

## Context

TASK-001 renames Contacts to "Judge-Referee"/"Judges-Referees" across the EN/FR
i18n catalogs. The ticket's acceptance criteria pre-authorized a shorter
fallback ("Referee |||| Referees") for `resources.contacts.name` and
`forcedCaseName` specifically, conditional on whether the full compound label
wraps or overflows in the desktop top nav (`layout/Header.tsx`) or mobile
bottom nav (`layout/MobileNavigation.tsx`).

## Decision

Inspected both components' markup: `MobileNavigation.tsx`'s `NavigationButton`
renders the label in a fixed `w-16` (64px) button at `text-[0.6rem]`
(~9.6px), with no `truncate`/`whitespace-nowrap`. The current 8-char
"Contacts" already nearly fills that box; the 15-char "Judges-Referees"
would wrap. Applied the pre-authorized fallback ("Referee |||| Referees" EN,
"Arbitre |||| Arbitres" FR) to `resources.contacts.name`/`forcedCaseName`
only, in both catalogs. Every other contacts-block string (buttons, empty
states, merge dialog, hot list, cross-references) keeps the full
"Judge-Referee"/"Judges-Referees" ("Juge-arbitre"/"Juges-arbitres") term,
since those render in unconstrained page content, not the fixed-width nav.

## Consequences

- The resource is deliberately called "Referee" in nav/menu contexts and
  "Judge-Referee" in descriptive UI copy — intentional, not an inconsistency
  to "fix" later.
- No live screenshot was taken (no browser tool available in this dispatch);
  the call rests on the concrete CSS constraint, not a guess.
- If `MobileNavigation.tsx`'s fixed width or font size changes later, this
  fallback should be re-evaluated against the full compound term.

## Alternatives considered

- Use "Judges-Referees" everywhere, accepting the mobile nav wrap — rejected,
  the acceptance criteria explicitly asked to avoid this.
- Shorten the term everywhere (not just nav) to avoid split terminology —
  rejected, it would touch many hand-authored strings the ticket didn't
  ask to shorten and reads fine as full prose in spacious UI.
