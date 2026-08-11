# MEMORY

Durable Atomic CRM knowledge. One sentence per bullet, freshest first. Maintained by the `documentator` agent — see [.claude/agents/documentator.md](.claude/agents/documentator.md).

## Business Knowledge

- A deal (judge or club) can never be saved without a "next action": the deal form upserts the linked contact's earliest open task from a non-persisted `next_action.*` mini-form (text/type/due_date all required), since tasks stay contact-scoped with no `deal_id` column.
- Every deal, judge or club, now requires exactly one linked contact (`contact_ids`); previously only judge deals did.
- A deal's `amount` is optional (nullable, no longer required), and `expected_closing_date` was dropped from the `deals` table entirely.
- Contacts have a dedicated `postal_code` field (editable inline in the contacts table, included in CSV import/export) distinct from the legacy `zipcode`/`city` address columns.
- List pagination now offers up to 500 rows per page (`rowsPerPageOptions`), up from a 50-row cap.
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

## 2026-08-04 17:54 — PR #13 créée, secrets Turso exclus du commit
**Résumé.** Création de la PR #13 (statuts-colonnes-juge-arbitre → main) sur github.com/sylvaindiv/atomic-crm suite à la livraison de la fonctionnalité pipeline affaires. `.env.development` contenait les vrais identifiants Turso (TURSO_DATABASE_URL/TURSO_AUTH_TOKEN) ajoutés par l'utilisateur en session précédente ; détecté que ce fichier n'est pas gitignoré et que le dépôt est public. Seul `MEMORY.md` a été committé/poussé (entrée précédente corrigée : migration marquée appliquée au lieu de "en attente"). Demande explicite ultérieure de "commit and push all changes" reconfirmée avec l'utilisateur avant exécution ; il a choisi d'exclure `.env.development`.
**Décisions prises.** - Ne jamais committer `.env.development` en l'état car il contient des secrets de production et le dépôt est public — confirmation explicite demandée et obtenue avant tout push. - `.env.development` reste modifié uniquement en local, non poussé.
**Fichiers / skills modifiés.** - `MEMORY.md` — commit `8dd1cba`, correction de l'entrée précédente sur le statut de la migration.
**Prochaines étapes / TODOs.** - [ ] Déplacer les secrets Turso de `.env.development` vers `.env` (déjà gitignoré) pour éviter tout risque futur. - [ ] PR #13 à relire/merger par l'utilisateur.

## 2026-08-05 13:52 — Merge origin/main, résolution conflit ContactList

**Résumé.** Fusion de `origin/main` dans `crm-multi-changes-batch` (1 commit de retard). Un seul conflit dans `ContactList.tsx` entre le flux de création via `ContactCreateSheet` (branche courante) et le nouveau panneau de filtres repliable (`main`, PR #15). Conflit résolu en combinant les deux fonctionnalités, plus suppression d'un import dupliqué de `Button`. Vérifié avec `tsc --noEmit` (aucune erreur), commit de merge créé et poussé sur `origin/crm-multi-changes-batch`.

**Décisions prises.**
- Conserver le flux `ContactCreateSheet` + `useTranslate` de la branche courante plutôt que le `CreateButton` de `main` — car c'est la fonctionnalité la plus récente/spécifique à cette branche, et ajouter le toggle de filtre (`useStore`, `PanelLeftClose/Open`) de `main` par-dessus.

**Fichiers / skills modifiés.**
- `src/components/atomic-crm/contacts/ContactList.tsx` — résolution de conflit de merge (imports fusionnés, `ContactListActions` combine bouton toggle filtre + bouton création via sheet)

**Prochaines étapes / TODOs.** _aucune_

## 2026-08-05 17:11 — Postal code backfill blocked on DB access

**Résumé.** Session portant sur deux demandes : pagination des listes jusqu'à 500 lignes et ajout d'une colonne code postal pour les juges-arbitres (contacts). Un plan initial a été rédigé et approuvé conceptuellement, mais l'utilisateur a indiqué l'avoir déjà exécuté ailleurs — la colonne `postal_code TEXT` est confirmée présente dans `db/schema.sql` sur la branche `increase-page-size-add-postal-code`. L'utilisateur a fourni un CSV réel (398 lignes : Nom, Club, CP, Ville, etc.) pour matcher et backfiller les codes postaux existants, en ignorant les autres colonnes jugées obsolètes. Le matching/update a été bloqué : ce workspace n'a ni `.env` (TURSO_DATABASE_URL/TURSO_AUTH_TOKEN), ni serveur backend local actif, ni session `turso` CLI authentifiée.

**Décisions prises.** - Matcher uniquement sur la colonne Nom (normalisée, insensible à la casse) contre `first_name + last_name`, en ignorant club/email/téléphone/statut du CSV car signalés comme modifiés/obsolètes par l'utilisateur.

**Fichiers / skills modifiés.** _aucune_

**Prochaines étapes / TODOs.**
- [ ] Obtenir l'accès DB (credentials Turso ou pointer vers le workspace où le plan a été exécuté) pour effectuer le matching et l'update
- [ ] Produire une liste de correspondances proposées (matched/unmatched) pour validation avant écriture en base

## 2026-08-05 17:21 — Pagination 500 + import code postal/ville juges-arbitres
**Résumé.** Confirmé que le plafond de pagination (50) est purement front (`list-pagination.tsx`), sans limite backend. La colonne `postal_code` sur `contacts` était déjà codée (non committée, non migrée en base live). Import du CSV "Listing JA" (398 lignes) matché aux contacts existants par nom, avec désambiguïsation via société/club pour les noms dupliqués ou placeholders ("(non renseigné)") : 359/361 lignes avec code postal matchées avec confiance. Dispatch de l'orchestrator pour ajouter une colonne `city` (miroir de `postal_code`) et générer la migration de déploiement des deux colonnes ; en attente de la confirmation PD-ASK.
**Décisions prises.** - Matcher par nom normalisé + désambiguïsation par société plutôt que fuzzy match aveugle, pour éviter d'assigner le mauvais code postal aux noms dupliqués/placeholders. - Passer par l'orchestrator pour l'ajout de `city` et la migration, conformément au workflow du projet.
**Fichiers / skills modifiés.** - `.context/scripts/fetch_contacts.mjs`, `match_postal_codes.mjs`, `apply_postal_codes.mjs` — scripts de matching/backfill (gitignorés, non committés).
**Prochaines étapes / TODOs.** - [ ] Récupérer le résultat de l'orchestrator (colonne `city` + migration). - [ ] Relayer la question PD-ASK à l'utilisateur. - [ ] Exécuter `apply_postal_codes.mjs` sur Turso `atomic-crm` une fois les colonnes live.

## 2026-08-05 17:34 — Pagination 500 lignes + code postal/ville juges-arbitres
**Résumé.** Augmenté la limite de pagination des listes de 50 à 500 lignes (option sélecteur). Ajouté les colonnes `postal_code` et `city` sur `contacts` (schéma, types, table éditable, import/export CSV, i18n, générateur fakerest). Appliqué l'`ALTER TABLE` directement sur la base Turso live (`atomic-crm`) car l'outillage de migration du harness cible Supabase, pas Turso. Matché le fichier CSV "Listing JA" aux contacts existants par nom (avec déduction via club en cas d'ambiguïté/nom placeholder) et importé code postal + ville pour 359 des 361 lignes exploitables.
**Décisions prises.**
- Réconciliation manuelle du code de la colonne `city` (plutôt que merge harness) — le working tree avait des changements non liés (pagination) que le `git reset --hard` du merger aurait détruits.
- ALTER TABLE appliqué directement via CLI turso plutôt que le pipeline de migration du harness, qui ne fonctionne pas sur ce projet (câblé Supabase).
**Fichiers / skills modifiés.**
- `db/schema.sql` — colonnes `postal_code`, `city` sur `contacts`
- `src/components/admin/list-pagination.tsx` — options jusqu'à 500
- `src/components/atomic-crm/companies/CompanyList.tsx` — override pagination retiré
- `src/components/atomic-crm/contacts/*` (types, table, import/export) — plomberie `postal_code`/`city`
- `providers/commons/*CrmMessages.ts`, `providers/fakerest/dataGenerator/contacts.ts` — libellés + fake data
**Prochaines étapes / TODOs.**
- [ ] Committer les changements en attente sur `increase-page-size-add-postal-code`
- [ ] Adapter l'outillage de migration du harness pour Turso (pas seulement Supabase)

## 2026-08-05 21:51 — PR créée : pagination 500 + code postal/ville
**Résumé.** Créé la PR #18 (increase-page-size-add-postal-code → main) suivant les instructions du fichier attaché. Vérifié git status/diff, confirmé que le hook Stop avait déjà écrit l'entrée MEMORY.md précédente, staged et committé les 14 fichiers en attente (pagination + postal_code/city + MEMORY.md), pushé avec upstream, revu le diff complet via GetWorkspaceDiff, puis créé la PR avec gh pr create en suivant le template du projet.
**Décisions prises.** - Checklist "Additional Checks" (documentation, fakerest, mobile) laissée décochée car non vérifiée manuellement en navigateur cette session — honnêteté sur ce qui a été réellement testé (uniquement typecheck).
**Fichiers / skills modifiés.** - Commit `507aea6` sur `increase-page-size-add-postal-code` — 14 fichiers (schema.sql, list-pagination.tsx, CompanyList.tsx, contacts/*, providers/*, types.ts, MEMORY.md), poussé vers origin.
**Prochaines étapes / TODOs.** - [ ] Tester la PR en fakerest et résolution mobile avant merge - [ ] Vérifier/mettre à jour la documentation si nécessaire
