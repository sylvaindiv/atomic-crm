# Import Ten’Up et rattachements multi-clubs

Les juges utilisent `contacts.company_ids`, une liste JSON d'identifiants numériques distincts. `company_id` reste le premier club. Une écriture historique de ce champ remplace seulement le premier rattachement ; les formulaires qui renvoient une liste inchangée sont aussi compatibles. Les partenaires restent limités à un club.

`db/migrate-multi-clubs.mjs`, appelé au démarrage et par `db:apply`, reconstruit la table contacts dans une transaction, conserve les identifiants, les séquences, les index et les enfants, puis vérifie les clés étrangères. La suppression d'un club détache ses contacts via un trigger SQL et conserve notes/tâches. Les identifiants Ten’Up sont des textes uniques et nullables.

## Exécution

Les CSV restent hors du dépôt : `clubs.csv`, `juges_arbitres.csv`, `club_juge_tournois.csv` (séparateur point-virgule). Aucun tournoi n'est créé dans le CRM.

```sh
# Simulation : aucune écriture en base, toutes les fiches sont lues.
node --env-file=.env scripts/import-tenup.mjs --source '/dossier/csv' --report .context/tenup-import/simulation.json

# Après sauvegarde complète, migration et déploiement validés :
node --env-file=.env scripts/import-tenup.mjs --source '/dossier/csv' --report .context/tenup-import/application.json --apply
```

L'application relit les données sous transaction d'écriture et recalcule les correspondances. Une ambiguïté bloque l'ensemble de l'application. Les correspondances approuvées sont inscrites dans le script ; un conflit nouveau les bloque aussi. Le téléphone seul ne constitue jamais une identité. Les champs existants sont conservés, à l'exception de l'identité de Vanessa nº 494 ; son statut `mort` est contrôlé et conservé.

Avant l'import, le script sauvegarde toutes les tables et leur schéma dans `<rapport>.backup.json` (création exclusive, permissions 0600). Cette sauvegarde ne remplace pas la sauvegarde **avant migration**. Les écritures et leur journal `record_history` sont dans la même transaction. Les rattachements sont vérifiés, puis une nouvelle simulation doit produire zéro modification avant commit. Le fichier `<rapport>.applied.json` confirme le commit ; en cas de doute après une panne, relancer la simulation.

Les CSV, rapports, divergences, sauvegardes et captures sont locaux dans `.context/`, ignoré par Git. Les exports CSV du CRM comprennent `companies` (tableau JSON de noms, portable entre bases) et `tenup_id`; les anciens CSV à colonne `company` restent acceptés.

## Mise en service

1. Sauvegarder la base de production et contrôler la restauration sur une copie locale.
2. Tester la migration, l'import et sa réexécution sur cette copie ; comparer les fiches existantes et leurs notes/tâches.
3. Déployer par le circuit existant : `.github/workflows/easypanel-deploy.yml` déclenche EasyPanel lors d'un push sur `main`.
4. Refaire la simulation sur la base actualisée, examiner le rapport, appliquer avec un nouveau chemin de rapport, puis contrôler les historiques et les rattachements.

Prévision validée pour les sources du 7 octobre 2026 : 53 clubs (32 nouveaux, 21 existants), 79 juges identifiés (60 nouveaux, 19 existants), 99 couples juge-club et 9 identifiants exclus faute d'identité. Les comptes sont recalculés à chaque exécution.
