# 04: Savoir si le dépôt distant est public

Spec parente : `.scratch/git-integration/spec.md`. Décision : `docs/adr/0020-git-integration-et-tessello-sync-parlent-par-le-stockage-du-module.md`. Vocabulaire : `GLOSSARY.md`.

**What to build:** La commande renseigne `status.remoteVisibility`, pour que le Module avertisse quand le dépôt est public.

**Blocked by:** 03

**Status:** resolved

- [x] Pour un `remote` `github.com` (formes SSH `git@github.com:o/r.git` et HTTPS), une requête anonyme à `https://api.github.com/repos/<o>/<r>` : `200` avec `private: false` → `public`. Tout autre cas (404, erreur, autre hébergeur) → `unknown`. Aucune réponse ne donne `private` sans authentification : la valeur `private` n'est pas produite pour l'instant.
- [x] Vérifié au démarrage, à chaque changement de `remote`, puis au plus une fois par heure (limite de l'API anonyme).
- [x] Hors ligne, la dernière valeur connue est gardée.
- [x] Tests : analyse des formes d'URL, et classement des réponses (fetch injecté).

## Comments

- 2026-11-06 : réalisé. `packages/cli/src/remote-visibility.ts` : `githubRepoOf` reconnaît `git@github.com:o/r(.git)`, `ssh://…@github.com[:port]/o/r`, `http(s)://[user@]github.com/o/r` (hôte sans casse, `/` et `.git` finaux tolérés ; noms limités à `[A-Za-z0-9._-]`, ni `.` ni `..`, pour ne rien injecter dans l'URL de l'API). `checkVisibility` fait la requête anonyme (`User-Agent: tessello-sync`, délai de 10 s) : `200` avec `private: false` → `public`, toute autre réponse HTTP → `unknown`, pas de réponse → hors ligne. `visibilityFor` décide quand demander, avec une mémoire en mémoire vive (dépôt et heure de la dernière réponse) que `syncLoop` garde d'un tour à l'autre : au premier tour du processus (donc à chaque `--once`), quand `remote` change, puis une heure après la dernière réponse. Hors ligne, la valeur précédente est gardée et la vérification retentée au tour suivant ; si `remote` a changé, `unknown`. Un `remote` vide : pas de champ `remoteVisibility`, et la mémoire est oubliée. Calculé juste après la lecture de la `config`, avant le saut pour `index.lock` ; sans `config` valide, la valeur précédente est reprise. `fetch` et la mémoire sont injectables (`SyncDeps`). 642 tests, typage sans erreur.
- 2026-11-06 : relecture à deux axes. Corrigé avant le commit : un `remote` vidé puis remis dans l'heure restait sans valeur. Assumés hors ticket : formes `ssh://` et `http://`, délai de 10 s, `unknown` hors ligne après un changement de dépôt. Restent ouverts : la mémoire n'est pas persistée, donc `--once` lancé par cron demande à chaque fois (au-delà de 60 lancements par heure, la limite anonyme est dépassée), et un `remote` changé pendant que la commande est arrêtée, puis vérifié hors ligne, garde la valeur de l'ancien dépôt ; un `403`/`429` de limite ou un `5xx` donne `unknown` et compte comme une réponse pour l'heure (lecture littérale du ticket). Standards : aucune violation ; jugements : `visibilityFor` a cinq paramètres et modifie la mémoire, `null` (hors ligne) et `undefined` (pas de dépôt) se distinguent par la doc seulement, la valeur pourrait vivre dans la mémoire plutôt que dans `previous`.
