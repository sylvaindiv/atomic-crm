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

## 2026-07-27 11:01 — Vérification statuts contacts CSV JA

**Résumé.** Demande utilisateur : appliquer les statuts du CSV "Listing JA" (399 lignes, prospection clubs padel) aux contacts CRM qui n'en avaient aucun. Exploration du schéma (`contacts.status`, `defaultNoteStatuses`) et de l'import CSV existant via agent Explore. Interrogation directe de la base Turso `atomic-crm` (CLI `turso db shell`) pour matcher les 398 lignes CSV aux 399 contacts par email/téléphone/nom. Résultat : seules 32 lignes CSV ont un Statut exploitable, et les 32 contacts correspondants ont déjà exactement ce statut en base (0 non matché, 0 ambigu, 0 divergence) — aucune écriture nécessaire.

**Décisions prises.** - Traiter ceci comme une opération de données (lecture/écriture DB directe via Turso CLI), pas comme un changement de code — pas de passage par le harness orchestrator. - Ne rien écrire en base puisque la vérification a montré que le rapprochement était déjà appliqué intégralement.

**Fichiers / skills modifiés.** _aucune_

**Prochaines étapes / TODOs.** - [ ] Si l'utilisateur pensait que des statuts manquaient, obtenir les noms précis des contacts/clubs concernés pour investigation ciblée.

## 2026-07-28 20:30 — Création PR statuts contacts + override policy

**Résumé.** Suite à la vérification (session précédente) montrant que les statuts CSV étaient déjà appliqués aux contacts CRM, l'utilisateur a demandé la création d'une PR via un fichier d'instructions attaché. Un seul changement non commité existait (entrée MEMORY.md ajoutée par le hook auto-mémoire). Le repo interdit aux agents de commit/push (`git-policy.md`), conflit signalé à l'utilisateur qui a explicitement demandé de passer outre. Commit + push de `MEMORY.md` puis création de la PR #7 (`sylvaindiv/atomic-crm`) vers `main`.

**Décisions prises.** - Demander confirmation explicite avant de commit/push malgré la policy `git-policy.md`, car conflit direct entre instructions utilisateur et règle projet écrite. - Override appliqué uniquement après validation explicite de l'utilisateur ("fais-le toi-même").

**Fichiers / skills modifiés.** - `MEMORY.md` — commit de l'entrée de vérification statuts (10 lignes ajoutées), poussé sur `conductor/import-contact-statuses-csv`.

**Prochaines étapes / TODOs.** - [ ] Aucune action code en attente ; PR #7 ouverte, à merger par l'utilisateur.
