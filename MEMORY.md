# MEMORY

Durable Atomic CRM knowledge. One sentence per bullet, freshest first. Maintained by the `documentator` agent — see [.claude/agents/documentator.md](.claude/agents/documentator.md).

## Business Knowledge

- Core resources: contacts, companies, deals (Kanban pipeline), tasks, notes, tags, and sales (team members).
- Domain options (genders, sectors, deal stages/categories, note statuses, task types) are `<CRM>` props in `src/App.tsx`, not hardcoded.
- Sales users sync with Supabase `auth.users` via triggers; deletion is unsupported — accounts are disabled instead.
- Aggregated reads use database views (`contacts_summary`, `companies_summary`), which FakeRest emulates in the frontend.
- Two interchangeable data providers: Supabase (production) and FakeRest (in-browser demo, resets on reload).
- Filters use `ra-data-postgrest` syntax (`field_name@operator`); operators must be supported by the FakeRest `supabaseAdapter`.

## 2026-07-24 13:26 — Dockerfile EasyPanel livré, hook auto-memory corrigé
**Résumé.** Session partie d'une question sur l'installation/déploiement du CRM sur EasyPanel. Un Dockerfile de production (absent jusque-là) + `.dockerignore` ont été conçus (Turso managé, image node:22.19.0-bookworm-slim) et implémentés via le harness (orchestrator → planner → developer → reviewer → merger → promotion). Mergé dans `main` (fast-forward + merge --no-ff) puis pushé vers github.com/sylvaindiv/atomic-crm.git. En cours de route, le hook global `auto-memory.sh` s'est emballé (les sous-agents partagent le session_id → dizaines d'écritures concurrentes, 1512 lignes de doublons dans MEMORY.md) ; cause identifiée et corrigée.
**Décisions prises.** - Turso managé plutôt que SQLite local sur volume EasyPanel — usage interne mais préférence pour éviter de gérer ses propres sauvegardes. - Image node:22.19.0-bookworm-slim (pas Alpine) — plus sûr pour ce déploiement unique malgré support musl confirmé.
**Fichiers / skills modifiés.** - `Dockerfile` — build multi-stage production, mergé et pushé sur `main`. - `.dockerignore` — idem. - `~/.claude/hooks/auto-memory.sh` — ajout verrou par session (mkdir atomique) + cooldown 10 min contre les écritures concurrentes.
**Prochaines étapes / TODOs.** - [ ] Créer la base Turso et configurer TURSO_DATABASE_URL/TURSO_AUTH_TOKEN/PORT sur EasyPanel. - [ ] Créer l'App EasyPanel depuis le repo GitHub et déployer.

## 2026-07-28 21:59 — Fix getIdentity FK + doublon PR#6 détecté

**Résumé.** Diagnostiqué `FOREIGN KEY constraint failed` sur contacts/contact_notes : `getIdentity()` dans `authProvider.ts` renvoyait la string `"admin"` au lieu d'un vrai `sales.id`. Fix implémenté via le harness (orchestrator → TASK-001 → developer/reviewer/merger) : résolution du premier `sales` existant, auto-provisionnement si vide, garde anti-race, promu sur `conductor/pwa-simple-password-auth`. L'orchestrator ne s'est jamais auto-réveillé entre les étapes ; relancé manuellement 4 fois via SendMessage après diagnostic disque (ticket, worktree, hooks.log). Avant de créer la PR demandée vers `main`, découvert que ce même bug était déjà corrigé et mergé sur `main` hier (PR #6, autre workspace Conductor) — cette branche avait divergé avant ce fix et a raté 3 PR (#5/#6/#7).

**Décisions prises.** - Router le fix via l'agent orchestrator plutôt que l'implémenter directement, conformément à AGENTS.md - PR vers main mise en pause : proposition de garder le fix déjà validé de la PR #6 et de merger seulement l'ajout `db/seed.sql` du mien (en attente de confirmation utilisateur)

**Fichiers / skills modifiés.** - `src/components/atomic-crm/providers/turso/authProvider.ts` — getIdentity() résout un vrai sales.id - `db/seed.sql` — ligne INSERT OR IGNORE sales par défaut - `src/components/atomic-crm/providers/turso/authProvider.test.ts` — nouveau, 3 cas de test

**Prochaines étapes / TODOs.** - [ ] Confirmer la réconciliation avec la PR #6 déjà mergée - [ ] Merger main dans la branche et résoudre le conflit authProvider.ts - [ ] Créer la PR finale vers main
