# 11: `tessello sync --living-documentation <dépôt>` : commiter les Projects Living Documentation d'un dépôt

Décision : `../tessello-living-documentation/docs/adr/0011-tessello-sync-commits-the-projects-of-a-repository.md` (et ADR 0020 ici pour le canal par le stockage). Vocabulaire : `GLOSSARY.md`.

**What to build:** Une nouvelle option, répétable, de `tessello sync` : `--living-documentation <dépôt>`. À chaque tour, pour chaque dépôt nommé, la commande lit dans le stockage du Module `@craftskillz/living-documentation` (clé `sync`, un fichier `{ "key", "value" }` sous `.tessello/data/@craftskillz/living-documentation/`) les Projects rangés dans ce dépôt, et commite **seulement** ce qui est sous leurs dossiers (`git add -A -- <chemin>…`), après l'attente au calme, avec un message qui liste les Documents changés. Jamais de push, de pull, de fusion ni de `--force`. L'intervalle est celui de Git Integration (60 s par défaut). Elle écrit ce qu'elle a fait dans la clé `syncStatus` du même stockage (écriture atomique, comme `status`).

**Blocked by:** `../tessello-living-documentation/.scratch/living-documentation-port/issues/34-sync-key-and-status.md` (le format de la clé `sync`)

**Status:** done (3e37cb3)

- [x] `--living-documentation <dépôt>` répétable, dans la commande lancée comme aujourd'hui dans le Dossier des Modules (`cd <Dossier des Modules> && npx tessello sync --living-documentation ~/code/arolla …`) : c'est là que se lit le stockage du Module
- [x] Lancée ailleurs, elle refuse de démarrer avec l'erreur explicite existante (« … is not a Modules folder: .tessello/modules.json is missing or unreadable. Choose it in the Host first. »), sans rien commiter dans aucun dépôt
- [x] Un Project correspond au dépôt quand son `location` saisi est dans le dépôt ; sinon quand le nom du dossier du dépôt est `repository` et que `path` y existe (tranché avec l'Utilisateur, 2026-11-27)
- [x] Seuls les dossiers des Projects sont ajoutés et commités ; le reste du dépôt n'est jamais touché (ni `.gitignore`, ni index hors de ces chemins)
- [x] Un dépôt sans Project configuré : « Cannot sync <chemin>: no Living Documentation Project is configured in this repository. In Living Documentation, open Project settings › Repository and connect this repository to the Project. », et les autres dépôts continuent ; de même pour un dossier qui n'est pas un dépôt git ou qui n'existe pas
- [x] Un `index.lock` présent (le git de l'Utilisateur travaille) reporte le tour, comme aujourd'hui
- [x] `syncStatus` écrit par Project (dernier commit ou problème, heartbeat)
- [x] Tests sur de vrais dépôts temporaires, comme ceux de `sync-command`

## Tranché

- Format de `syncStatus` (avec l'Utilisateur, 2026-11-27), identique au ticket 34 du Module :

```json
{
  "heartbeat": "2026-11-27T14:32:05Z",
  "projects": {
    "<Project id>": {
      "repository": "/Users/me/code/arolla",
      "lastCommit": { "at": "2026-11-27T14:31:50Z", "id": "a1b2c3d", "documents": ["docs/guide.md", "docs/api.md"] }
    },
    "<another Project id>": {
      "repository": "/Users/me/code/other",
      "problem": { "kind": "not-a-repository", "message": "Cannot sync …: it is not a git repository (no .git).", "since": "2026-11-27T14:00:00Z" }
    }
  }
}
```

`heartbeat`: the last round. Per Project: the repository used, then `lastCommit` (time, short id, Documents committed) and/or the current `problem` (kind, message, since). A repository with no configured Project has no entry (its message goes to the terminal only). Written atomically by `sync` only; read by the Module only.

- La clé `sync` (ticket 34 du Module, livré en 8a1133d) : `{ "projects": [{ "id", "name", "repository", "path"?, "location"? }] }`. **`path` est absent tant que le Module ne le connaît pas** (Project jamais commité) : ce Project ne se reconnaît alors que par son `location` (Utilisateur, 2026-11-27). Le chemin à commiter est alors `location` relatif au dépôt.
- Fichiers : la clé `sync` est `sync.json` ; la clé `syncStatus` est **`sync%53tatus.json`** (`keyFileName` n'admet que `[a-z0-9_-]`) ; un test vérifie qu'ils s'accordent avec `keyFileName`, comme pour `status` et `config`.
- Avec `--living-documentation`, la sauvegarde du Dossier des Modules (git init, commits, push) ne tourne **que si Git Integration a enregistré sa configuration** ; sans elle, seuls les dépôts Living Documentation sont commités : pas de `git init` du Dossier des Modules, pas de problème `no-config` (Utilisateur, 2026-11-27). L'intervalle reste celui de Git Integration, 60 s sans configuration.
- Les commits dans les dépôts de code se font **avec `--no-verify`** : les hooks du dépôt (husky, lint-staged, commitlint) ne tournent pas (Utilisateur, 2026-11-27).

## Comments

- `packages/cli/src/living-documentation-sync.ts` does one round; `syncRound` in `sync-command.ts` chains it after the Modules-folder backup (only when Git Integration is configured, else interval 60 s). The shared git helpers moved to `git.ts`.
- Commits: `git add -A` then `git commit --only --no-verify` on the Project paths that changed only (git refuses a pathspec matching nothing), with `--literal-pathspecs`; what the developer staged elsewhere stays staged. Message: `Living Documentation: <Documents>` (cut, `… (+N more)`), or `<n> files` when no `.md` changed. Identity: the repository's, else `tessello sync`'s.
- Matching compares real paths (symlinks); `~` in a location is the home folder. A Project whose path is `""` (the repository is the Project folder) commits the whole repository: it is the Project.
- Problems in `syncStatus`: `not-found`, `not-a-repository`, `commit-failed` (also a failed `git add`, or git missing). The index.lock is found with `git rev-parse --git-path` (worktrees). A postponed round (quiet wait) clears a problem.
- The Modules-folder backup ignores `sync%53tatus.json`, so that it does not commit it every round.
- The loop prints a repository's problem at every round, as for the Modules folder.
- Left: the trial with the Module in the local Host (ticket 34 of the Module).
