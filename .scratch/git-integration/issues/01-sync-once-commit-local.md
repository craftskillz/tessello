# 01: `tessello sync --once` : un tour qui commite en local

Spec parente : `.scratch/git-integration/spec.md`. Décision : `docs/adr/0020-git-integration-et-tessello-sync-parlent-par-le-stockage-du-module.md`. Vocabulaire : `GLOSSARY.md`.

**What to build:** La première tranche du moteur. `npx tessello sync --once [dossier]` vérifie le Dossier des Modules, initialise le dépôt git, lit la `config` du Module, génère le `.gitignore`, commite ce qui a changé et écrit le `status`. Ni boucle, ni push : ils arrivent aux tickets 02 et 03.

**Blocked by:** aucun

**Status:** resolved

### Commande

- [x] `packages/cli/src/sync-command.ts`, branchée dans `cli.ts` comme `validate` et `serve`. `[dossier]` vaut par défaut le dossier courant.
- [x] Sans `.tessello/modules.json` : message clair et code de sortie non nul (`not-a-modules-folder`). Sans `git` sur la machine : idem (`git-missing`).
- [x] Si le dossier n'est pas un dépôt git : `git init`, avec la branche `main`.

### Canal (ADR 0020)

- [x] Lecture de `.tessello/data/@craftskillz/git-integration/config.json`, au format `{ "key": "config", "value": { remote, push, intervalSeconds, dataModules } }`. Si le fichier est absent ou invalide, on ne commite rien et le `status` porte `no-config`.
- [x] Écriture atomique de `status.json` (fichier temporaire sans extension `.json`, puis renommage), au format de l'Hôte. Le nom de fichier est celui que `keyFileName` donne à la clé `status` : la fonction est partagée ou testée contre celle de l'Hôte.
- [x] Le `status` porte `heartbeat`, `installed` (Identifiant, nom tiré du Manifeste, dossier, d'après `modules.json`), `ownRepositories`, `lastCommit` et `problem`.

### Ce qui est versionné

- [x] Une section délimitée du `.gitignore` (`# >>> tessello sync` … `# <<< tessello sync`) est régénérée à chaque tour. Les lignes hors de cette section sont gardées telles quelles.
- [x] Elle exclut : `.tessello/data/<id>/` de tout Module absent de `dataModules`, `.tessello/data/@craftskillz/git-integration/status.json`, `.tessello/sync.lock`, `*.crswap`, `.DS_Store`, les fichiers temporaires de la commande, et tout dossier de premier niveau qui contient son propre `.git` (listé dans `ownRepositories`).
- [x] `config.json` de Git Integration est versionné.
- [x] Un Module retiré de `dataModules` sort de l'index (`git rm --cached -r`), et ses fichiers restent sur le disque.

### Commit

- [x] S'il y a des changements : `git add -A` puis `git commit`. Le message nomme les Modules touchés (« tessello sync: @craftskillz/notes, home »). Sinon, rien.
- [x] Un `.git/index.lock` présent fait sauter le tour sans erreur.

### Tests

- [x] Sur de vrais dépôts temporaires : premier tour (init et commit), tour sans changement, données d'un Module non choisi jamais commitées, retrait de `dataModules`, dépôt imbriqué exclu, `.gitignore` de l'Utilisateur préservé, `no-config`, `not-a-modules-folder`.
- [x] Le README du CLI documente la commande.

## Comments

- 2026-11-06 : réalisé. `packages/cli/src/sync-command.ts` (`syncOnce`, `syncCommand`), branché dans `cli.ts` ; sans `--once`, erreur d'usage (code 2) en attendant le ticket 02. Le `.gitignore` refuse par défaut les données de tout Module (`/.tessello/data/*/*/`) puis réinclut `dataModules` et `@craftskillz/git-integration` (sauf `status.json`) : les données d'un Module inconnu ou désinstallé restent hors du dépôt. Sortie de l'index : `git ls-files -ci` avec les seules règles de la commande, puis `git rm --cached` ; un fichier que l'Utilisateur ignore plus tard reste suivi. Sans identité git sur la machine, le commit se fait au nom de `tessello sync <sync@tessello.invalid>`. Le message nomme aussi `registry` (`modules.json`) et `@craftskillz/git-integration` quand sa `config` change. Un `no-config` initialise déjà le dépôt, mais n'écrit pas le `.gitignore`. Les noms `config.json` et `status.json` sont testés contre `keyFileName` de l'Hôte. 20 tests (`packages/cli/test/sync.test.ts`), 578 au total, typage sans erreur.
- 2026-11-06 : relecture à deux axes. Spec : critères remplis ; corrigés avant le commit : la sortie de l'index touchait aussi les fichiers ignorés par les lignes de l'Utilisateur, et un marqueur `# >>> tessello sync` sans fin faisait répéter la section. Standards : aucune violation ; JSDoc de `run` mis à jour, doublon des libellés retiré. Restent des jugements : `sync-command.ts` mêle commande, git et format du stockage (à découper quand le ticket 02 l'agrandira), le couple `problem`/`message` pourrait devenir un type `Problem`, et les identifiants de `dataModules` ne sont pas échappés pour la syntaxe du `.gitignore`.
