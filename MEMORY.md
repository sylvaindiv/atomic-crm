# MEMORY

Durable Atomic CRM knowledge. One sentence per bullet, freshest first. Maintained by the `documentator` agent — see [.claude/agents/documentator.md](.claude/agents/documentator.md).

## Business Knowledge

- A deal is either a judge case (`case_type: "judge"`, linked to exactly one contact) or a club case (`case_type: "club"`, linked to one company) — chosen at creation and immutable afterwards.
- The deals Kanban board no longer has its own stage config: its columns are the shared `noteStatuses` (contact/company statuses) flagged `visibleInDealsKanban`, so judges/clubs and deals move through the same status vocabulary.
- A judge's (contact) or club's (company) `status` field and their linked deal's `stage` are kept in sync automatically by the backend (`server/dealSync.mjs`): changing one side updates or creates the other, one hop only, no ping-pong.
- Companies have a `status` column (same value space as `contacts.status`); `contacts_summary.linked_deal_id` exposes each contact's most recent non-archived judge deal.
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

**Résumé.** Diagnostiqué `FOREIGN KEY constraint failed` sur contacts/contact_notes : `getIdentity()` dans `authProvider.ts` renvoyait la string `"admin"` au lieu d'un vrai `sales.id`. Fix implémenté via le harness (orchestrator → TASK-001 → developer/reviewer/merger) : résolution du premier `sales` existant, auto-provisionnement si vide, garde anti-race, promu sur `conductor/pwa-simple-password-auth`. L'orchestrator ne s'est jamais auto-réveillé entre les étapes ; relancé manuellement 4 fois via SendMessage après diagnostic disque (ticket, worktree, hooks.log). Avant de créer la PR demandée vers `main`, découvert que ce même bug était déjà corrigé et mergé sur `main` la veille (PR #6, autre workspace Conductor) — cette branche avait divergé avant ce fix et a raté 3 PR (#5/#6/#7). Réconciliation : merge de `main` dans la branche, conflit sur `authProvider.ts`/`authProvider.test.ts` résolu en gardant la version déjà validée de la PR #6, en conservant uniquement l'ajout `db/seed.sql` (non couvert par l'autre fix).

**Décisions prises.** - Router le fix via l'agent orchestrator plutôt que l'implémenter directement, conformément à AGENTS.md - Après découverte du doublon, garder le fix déjà mergé sur `main` (déjà validé en local par l'utilisateur via agent-browser) plutôt que le mien, pour éviter de remplacer du code testé par du code non testé en conditions réelles.

**Fichiers / skills modifiés.** - `src/components/atomic-crm/providers/turso/authProvider.ts` — inchangé au final (version PR #6 conservée) - `db/seed.sql` — ligne INSERT OR IGNORE sales par défaut (seul ajout net de cette session) - `src/components/atomic-crm/providers/turso/authProvider.test.ts` — inchangé au final (version PR #6 conservée)

**Prochaines étapes / TODOs.** - [ ] Aucune action code en attente ; PR ouverte vers `main` avec le seul ajout `db/seed.sql`.

## 2026-07-28 20:30 — Création PR statuts contacts + override policy

**Résumé.** Suite à la vérification (session précédente) montrant que les statuts CSV étaient déjà appliqués aux contacts CRM, l'utilisateur a demandé la création d'une PR via un fichier d'instructions attaché. Un seul changement non commité existait (entrée MEMORY.md ajoutée par le hook auto-mémoire). Le repo interdit aux agents de commit/push (`git-policy.md`), conflit signalé à l'utilisateur qui a explicitement demandé de passer outre. Commit + push de `MEMORY.md` puis création de la PR #7 (`sylvaindiv/atomic-crm`) vers `main`.

**Décisions prises.** - Demander confirmation explicite avant de commit/push malgré la policy `git-policy.md`, car conflit direct entre instructions utilisateur et règle projet écrite. - Override appliqué uniquement après validation explicite de l'utilisateur ("fais-le toi-même").

**Fichiers / skills modifiés.** - `MEMORY.md` — commit de l'entrée de vérification statuts (10 lignes ajoutées), poussé sur `conductor/import-contact-statuses-csv`.

**Prochaines étapes / TODOs.** - [ ] Aucune action code en attente ; PR #7 ouverte, à merger par l'utilisateur.

## 2026-07-27 14:04 — Fix FK contact_notes + PR #6 créée
**Résumé.** Diagnostiqué et corrigé l'erreur `FOREIGN KEY constraint failed` à l'ajout d'une note : `getIdentity()` renvoyait la string `"admin"` au lieu d'un vrai `sales.id`, régression du commit d0853bd (remplacement de l'auth). Fix implémenté via le harness (ticket TASK-001) dans `authProvider.ts` : résolution du premier `sales` existant, ou auto-provisionnement si la table est vide, avec garde anti-race. Bloqué en cours de route par un environnement Conductor non provisionné (`node_modules` absent) — diagnostiqué via hooks.log et corrigé manuellement (npm install + provisioning des worktrees). Fix vérifié en local (instance SQLite jetable + agent-browser : contact + note créés avec `sales_id` réel), mergé et promu sur `conductor/fix-contact-note-fk-error` (commit db48157). PR #6 créée sur GitHub vers `main`.
**Décisions prises.** - Garder la contrainte FK `sales_id` plutôt que la supprimer, pour préserver l'intégrité référentielle (corrige aussi Settings/Profile, cassé pour la même raison) - Router le fix via l'agent `orchestrator` plutôt que de l'implémenter directement, conformément à AGENTS.md
**Fichiers / skills modifiés.** - `src/components/atomic-crm/providers/turso/authProvider.ts` — `getIdentity()` résout un vrai `sales.id` au lieu du hardcode `"admin"` - `src/components/atomic-crm/providers/turso/authProvider.test.ts` — nouveau, 3 cas de test
**Prochaines étapes / TODOs.** - [ ] Merger la PR #6 une fois validée - [ ] Backfill optionnel de `companies.sales_id`/`tasks.sales_id` contenant encore `"admin"` (pas de FK dessus, cosmétique)

## 2026-07-27 11:01 — Vérification statuts contacts CSV JA

**Résumé.** Demande utilisateur : appliquer les statuts du CSV "Listing JA" (399 lignes, prospection clubs padel) aux contacts CRM qui n'en avaient aucun. Exploration du schéma (`contacts.status`, `defaultNoteStatuses`) et de l'import CSV existant via agent Explore. Interrogation directe de la base Turso `atomic-crm` (CLI `turso db shell`) pour matcher les 398 lignes CSV aux 399 contacts par email/téléphone/nom. Résultat : seules 32 lignes CSV ont un Statut exploitable, et les 32 contacts correspondants ont déjà exactement ce statut en base (0 non matché, 0 ambigu, 0 divergence) — aucune écriture nécessaire.

**Décisions prises.** - Traiter ceci comme une opération de données (lecture/écriture DB directe via Turso CLI), pas comme un changement de code — pas de passage par le harness orchestrator. - Ne rien écrire en base puisque la vérification a montré que le rapprochement était déjà appliqué intégralement.

**Fichiers / skills modifiés.** _aucune_

**Prochaines étapes / TODOs.** - [ ] Si l'utilisateur pensait que des statuts manquaient, obtenir les noms précis des contacts/clubs concernés pour investigation ciblée.

## 2026-07-27 14:04 — Fix FK contact_notes + PR #6 créée
**Résumé.** Diagnostiqué et corrigé l'erreur `FOREIGN KEY constraint failed` à l'ajout d'une note : `getIdentity()` renvoyait la string `"admin"` au lieu d'un vrai `sales.id`, régression du commit d0853bd (remplacement de l'auth). Fix implémenté via le harness (ticket TASK-001) dans `authProvider.ts` : résolution du premier `sales` existant, ou auto-provisionnement si la table est vide, avec garde anti-race. Bloqué en cours de route par un environnement Conductor non provisionné (`node_modules` absent) — diagnostiqué via hooks.log et corrigé manuellement (npm install + provisioning des worktrees). Fix vérifié en local (instance SQLite jetable + agent-browser : contact + note créés avec `sales_id` réel), mergé et promu sur `conductor/fix-contact-note-fk-error` (commit db48157). PR #6 créée sur GitHub vers `main`.
**Décisions prises.** - Garder la contrainte FK `sales_id` plutôt que la supprimer, pour préserver l'intégrité référentielle (corrige aussi Settings/Profile, cassé pour la même raison) - Router le fix via l'agent `orchestrator` plutôt que de l'implémenter directement, conformément à AGENTS.md
**Fichiers / skills modifiés.** - `src/components/atomic-crm/providers/turso/authProvider.ts` — `getIdentity()` résout un vrai `sales.id` au lieu du hardcode `"admin"` - `src/components/atomic-crm/providers/turso/authProvider.test.ts` — nouveau, 3 cas de test
**Prochaines étapes / TODOs.** - [ ] Merger la PR #6 une fois validée - [ ] Backfill optionnel de `companies.sales_id`/`tasks.sales_id` contenant encore `"admin"` (pas de FK dessus, cosmétique)

## 2026-07-28 20:30 — Création PR statuts contacts + override policy

**Résumé.** Suite à la vérification (session précédente) montrant que les statuts CSV étaient déjà appliqués aux contacts CRM, l'utilisateur a demandé la création d'une PR via un fichier d'instructions attaché. Un seul changement non commité existait (entrée MEMORY.md ajoutée par le hook auto-mémoire). Le repo interdit aux agents de commit/push (`git-policy.md`), conflit signalé à l'utilisateur qui a explicitement demandé de passer outre. Commit + push de `MEMORY.md` puis création de la PR #7 (`sylvaindiv/atomic-crm`) vers `main`.

**Décisions prises.** - Demander confirmation explicite avant de commit/push malgré la policy `git-policy.md`, car conflit direct entre instructions utilisateur et règle projet écrite. - Override appliqué uniquement après validation explicite de l'utilisateur ("fais-le toi-même").

**Fichiers / skills modifiés.** - `MEMORY.md` — commit de l'entrée de vérification statuts (10 lignes ajoutées), poussé sur `conductor/import-contact-statuses-csv`.

**Prochaines étapes / TODOs.** - [ ] Aucune action code en attente ; PR #7 ouverte, à merger par l'utilisateur.
>>>>>>> origin/main

## 2026-08-04 16:28 — Pipeline affaires piloté par statuts juge/club livré
**Résumé.** Implémenté la fonctionnalité demandée en plan mode : les colonnes du Kanban "affaires" sont pilotées par la liste des statuts juges-arbitres (`noteStatuses`), avec synchronisation bidirectionnelle statut↔stage (contact/club ↔ deal), un champ `deals.case_type` (Juge/Club, immuable), un statut club (`companies.status`), une section "affaire liée" sur la fiche contact, et le fix du graphique dashboard (NaN). 9 tickets développés/revus/mergés via le harness (plusieurs re-revues, 2 vrais bugs runtime attrapés). Vérifié en mode démo via agent-browser — le "bug" d'ordre de colonnes signalé par l'utilisateur s'est avéré être le reset-on-reload normal de FakeRest, pas un défaut du code. Migration SQL générée, revue, mergée, puis appliquée avec succès sur la vraie base Turso (`atomic-crm-sylvaindiv`) une fois les identifiants renseignés dans `.env.development`.
**Décisions prises.** - Kanban columns = `noteStatuses` partagé, une seule source de vérité entre juges, clubs et pipeline affaires. - Sync bidirectionnelle en SQL brut côté serveur (`server/dealSync.mjs`), jamais via `update()` générique, pour éviter toute boucle infinie. - Pas de mapping deviné pour les anciens statuts de deals : les affaires historiques disparaissent du Kanban jusqu'à réassignation manuelle. - Le script générique `.claude/scripts/apply-migrations.mjs` (Supabase/Docker) ne fonctionne pas sur ce projet Turso — appliqué manuellement via `node --env-file=.env.development db/migrations/<fichier>.mjs`.
**Fichiers / skills modifiés.** - `db/schema.sql`, `server/dealSync.mjs`, `server/query.mjs` — sync bidirectionnelle statut/stage. - `src/components/atomic-crm/deals/*`, `companies/*`, `contacts/ContactAside.tsx`, `dashboard/DealsChart.tsx`, `settings/SettingsPage.tsx` — UI complète. - `db/migrations/20260804141928_7eef2240_migration_judge-club-status-pipeline.mjs` — migration générée et appliquée.
**Prochaines étapes / TODOs.** - [ ] Corriger ou documenter `.claude/scripts/apply-migrations.mjs` pour ce projet Turso (actuellement suppose Supabase/Docker). - [ ] Nettoyer l'artefact de merge Git préexistant en ligne 75 (`>>>>>>> origin/main` orphelin).
