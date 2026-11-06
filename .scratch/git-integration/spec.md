# Spec : Module Git Integration et commande `tessello sync`

**Status:** needs-triage

Vocabulaire : `GLOSSARY.md`. Contrat : la Convention (`convention/CONVENTION.md`). Organisation du Dossier des Modules : ADR 0007.

## Problem Statement

Les Modules et leurs données vivent dans le Dossier des Modules, sur la machine de l'Utilisateur (ADR 0007). Si le disque est perdu ou si l'Utilisateur change de machine, tout est perdu, sauf s'il pense à exporter son Espace. L'ADR 0007 a rendu ce dossier versionnable avec git (un fichier JSON indenté par clé), mais rien ne le fait pour lui : il faut écrire ses propres scripts, se souvenir de commiter, et choisir à la main quelles données peuvent quitter la machine (elles peuvent contenir des jetons d'API).

## Solution

Deux pièces, livrées ensemble :

- **`npx tessello sync [dossier]`**, une commande du CLI (`packages/cli`) que l'Utilisateur lance dans son Dossier des Modules. C'est le moteur : à intervalle régulier, elle commite ce qui a changé avec le vrai `git` de la machine, puis pousse si l'Utilisateur l'a demandé. Elle ne fait jamais de `pull`, de fusion ni de `push --force`.
- **Le Module Git Integration** (`@craftskillz/git-integration`), dans la Marketplace. C'est l'écran de configuration et de suivi : dépôt distant, fréquence, push ou non, Modules dont les données sont versionnées, alertes, et la marche à suivre pour restaurer sur une autre machine.

Un Module ne peut ni lire les fichiers, ni lancer git, ni connaître les autres Modules (Convention §4, §6). Le moteur est donc hors de l'Hôte, et le Module ne fait que lire et écrire **son propre stockage** :

- le Module écrit la clé `config` ;
- `tessello sync` lit `.tessello/data/@craftskillz/git-integration/config.json`, et écrit la clé `status` dans le même dossier ;
- l'Hôte relit le disque à chaque `storage.get` (pas de cache), donc le Module voit le `status` à jour.

Ce canal n'a besoin d'aucune Permission, d'aucun serveur local ni d'aucun jeton.

## User Stories

### Mettre en place

1. En tant qu'Utilisateur, je veux installer Git Integration depuis la Marketplace, y saisir l'URL de mon dépôt distant, et lancer `npx tessello sync` dans mon Dossier des Modules, afin que mon Espace soit sauvegardé sans autre réglage.
2. En tant qu'Utilisateur, je veux que le Module me donne la commande exacte à lancer, et me dise quand le moteur ne tourne pas, afin de ne pas croire à tort que je suis sauvegardé.
3. En tant qu'Utilisateur, je veux que `tessello sync` initialise le dépôt git s'il n'existe pas, et règle `origin` sur le dépôt que j'ai saisi, afin de ne pas avoir à le faire moi-même.
4. En tant qu'Utilisateur, je veux être averti si mon dépôt distant est public, et que le Module recommande toujours un dépôt privé, afin de ne pas publier mes données par erreur.

### Choisir ce qui est versionné

5. En tant qu'Utilisateur, je veux que les Modules (leur code), le registre et la disposition de l'Accueil soient toujours versionnés, afin de retrouver mon Espace complet sur une autre machine.
6. En tant qu'Utilisateur, je veux choisir, Module par Module, ceux dont les **données** sont versionnées, aucun n'étant coché par défaut, afin de garder les secrets hors du dépôt.
7. En tant qu'Utilisateur, je veux qu'un Module installé plus tard apparaisse dans la liste, décoché, afin de décider pour lui aussi.
8. En tant qu'Utilisateur, je veux qu'un dossier de Module qui est déjà un dépôt git (un Module que je développe sur place) soit exclu et signalé, afin de ne pas créer de dépôt imbriqué.

### Commiter et pousser

9. En tant qu'Utilisateur, je veux régler la fréquence (60 s par défaut), afin d'équilibrer fraîcheur et nombre de commits.
10. En tant qu'Utilisateur, je veux activer ou désactiver le push, afin de pouvoir ne garder qu'un historique local.
11. En tant qu'Utilisateur, je veux qu'aucun commit ne soit fait pendant que des données sont en train de changer, afin de ne pas figer un état à moitié écrit.
12. En tant qu'Utilisateur, je veux que, si un push est refusé, le Module m'affiche une alerte qui explique quoi faire à la main, et que les commits continuent en local en attendant, afin de ne rien perdre et de garder la main sur le conflit.
13. En tant qu'Utilisateur, je veux voir la date du dernier commit et du dernier push réussis, afin de savoir où j'en suis.
14. En tant qu'Utilisateur, je veux un Widget qui montre d'un coup d'œil si tout va bien, afin de repérer une alerte sans ouvrir la Vue.

### Restaurer

15. En tant qu'Utilisateur, je veux que le Module m'explique comment restaurer mon Espace sur une autre machine (cloner le dépôt, choisir ce dossier dans l'Hôte, relancer `tessello sync`), afin de pouvoir le faire le jour où j'en ai besoin.
16. En tant qu'Utilisateur, je veux savoir que les Modules dont je n'ai pas versionné les données repartiront vides après une restauration, afin de choisir en connaissance de cause.

## Implementation Decisions

### Le canal : le stockage du Module

Clés de `@craftskillz/git-integration`, au format de l'Hôte (`{ "key", "value" }`, JSON indenté, un fichier par clé, ADR 0007) :

- `config`, écrite par le Module seulement :
  ```json
  { "remote": "git@github.com:me/tessello-data.git", "push": true, "intervalSeconds": 60, "dataModules": ["@craftskillz/notes"] }
  ```
- `status`, écrite par `tessello sync` seulement :
  ```json
  {
    "heartbeat": "2026-11-06T10:00:00Z",
    "installed": [{ "id": "@craftskillz/notes", "name": "Notes", "folder": "notes" }],
    "ownRepositories": ["tessello-diagram"],
    "lastCommit": { "sha": "a1b2c3d", "at": "…", "modules": ["@craftskillz/notes"] },
    "lastPush": { "at": "…" },
    "remoteVisibility": "public | private | unknown",
    "problem": { "kind": "push-rejected | auth | remote-unreachable | git-missing | not-a-modules-folder | no-config", "message": "…", "since": "…" }
  }
  ```
- `tessello sync` écrit `status.json` de façon atomique (fichier temporaire sans extension `.json`, que l'Hôte ignore, puis renommage).
- Le Module relit `status` toutes les quelques secondes tant qu'il est visible, et s'arrête quand il est caché (Convention §6.4).
- Le moteur est « arrêté » quand `heartbeat` a plus de 2 × `intervalSeconds` + 10 s.
- `tessello sync` dépend ici de l'organisation interne du Dossier (ADR 0007), pas seulement de la Convention : voir l'ADR 0020.

### Ce qui est versionné

Tout le Dossier des Modules, **sauf** :

- `.tessello/data/<id>/` de chaque Module absent de `dataModules` ;
- `.tessello/data/@craftskillz/git-integration/status.json` (`config.json`, lui, est versionné, pour retrouver la configuration après une restauration) ;
- tout dossier de premier niveau qui contient son propre `.git` (listé dans `status.ownRepositories`) ;
- `*.crswap` (écritures en cours de Chrome), `.DS_Store`, fichiers temporaires de `tessello sync`.

`tessello sync` génère ces règles dans une section délimitée du `.gitignore`. L'Utilisateur peut ajouter ses propres lignes hors de cette section. Retirer un Module de `dataModules` le retire aussi de l'index (`git rm --cached`), sans toucher aux fichiers.

### Un tour du moteur

À chaque intervalle (la `config` est relue à chaque tour) :

1. On saute le tour si `.git/index.lock` existe (git lancé à la main) ou si la `config` manque (problème `no-config`).
2. On régénère le `.gitignore` et on règle `origin`.
3. `git status --porcelain` : s'il n'y a rien, on passe au push.
4. **Période de calme** : si un fichier modifié a moins de 10 s, on ne commite pas et on réessaie au tour suivant. Cela évite de figer deux clés liées qu'un Module écrit l'une après l'autre. L'Hôte écrit déjà chaque clé de façon atomique (`createWritable`).
5. `git add -A` puis `git commit`, avec un message qui nomme les Modules touchés.
6. Si `push` est vrai et que la branche locale est en avance : `git push`. En cas de refus (non-fast-forward), on enregistre le problème `push-rejected`, on continue de commiter en local, et on réessaie à chaque tour : l'alerte disparaît d'elle-même quand l'Utilisateur a réglé le conflit.
7. On écrit le `status` (le `heartbeat` à chaque tour).

Un verrou (`.tessello/sync.lock`, avec le PID) empêche deux `tessello sync` de tourner sur le même dossier.

### Authentification et visibilité

- `tessello sync` utilise l'authentification git de la machine (SSH, credential helper). Il ne stocke aucun secret.
- Visibilité : pour un dépôt `github.com`, une requête anonyme à `api.github.com/repos/<owner>/<repo>` répond `200` avec `private: false` → `public`. Tout autre cas → `unknown`. Le Module avertit si c'est `public`, et recommande toujours un dépôt privé.

### Le Module

- Dépôt `craftskillz/tessello-git-integration`, créé par `just new-module git-integration` (template Svelte), publié par `just publish`.
- Aucune Permission.
- **Vue** : état (moteur actif ou arrêté, dernier commit, dernier push, alerte), dépôt distant, push oui/non, fréquence, liste des Modules installés avec une case « versionner les données » (décochée par défaut), dossiers exclus parce qu'ils ont leur propre dépôt, section « Restaurer sur une autre machine ».
- **Widget S** : une pastille (OK, alerte, moteur arrêté) et l'heure du dernier commit, qui ouvre la Vue.
- La langue suit le `locale` (anglais, français), et le thème suit celui de l'Hôte.
- Le Guide d'utilisation explique : la commande à lancer, ce qui est versionné, les secrets, la résolution d'un push refusé, la restauration.

### La commande

- `packages/cli/src/sync-command.ts`. Elle tourne au premier plan et s'arrête avec Ctrl+C. `--once` fait un seul tour (utile pour les tests et pour cron).
- Elle vérifie que le dossier contient `.tessello/modules.json` (sinon `not-a-modules-folder`) et que `git` est installé (sinon `git-missing`).

## Testing Decisions

- La logique du moteur (règles d'ignore, calme, décision commit/push, lecture et écriture du `status`) est testée sur de vrais dépôts git temporaires, avec un dépôt nu local comme `origin`, y compris un push refusé.
- Le Module est testé avec l'Hôte de test du SDK (ADR 0019), avec un `status` pré-rempli : moteur arrêté, alerte de push, dépôt public, Module ajouté depuis.
- Un test de bout en bout : un Module écrit une clé dans l'Hôte, `tessello sync --once` la commite, et le Module affiche le nouveau commit.

## Out of Scope

- Le `pull`, la fusion et toute résolution automatique de conflit.
- Le lancement automatique de `tessello sync` à l'ouverture de session (launchd, systemd, tâche planifiée).
- Le Pont et son API locale.
- Toute modification de l'Hôte ou de la Convention.
