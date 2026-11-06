# 04: Savoir si le dépôt distant est public

Spec parente : `.scratch/git-integration/spec.md`. Décision : `docs/adr/0020-git-integration-et-tessello-sync-parlent-par-le-stockage-du-module.md`. Vocabulaire : `GLOSSARY.md`.

**What to build:** La commande renseigne `status.remoteVisibility`, pour que le Module avertisse quand le dépôt est public.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Pour un `remote` `github.com` (formes SSH `git@github.com:o/r.git` et HTTPS), une requête anonyme à `https://api.github.com/repos/<o>/<r>` : `200` avec `private: false` → `public`. Tout autre cas (404, erreur, autre hébergeur) → `unknown`. Aucune réponse ne donne `private` sans authentification : la valeur `private` n'est pas produite pour l'instant.
- [ ] Vérifié au démarrage, à chaque changement de `remote`, puis au plus une fois par heure (limite de l'API anonyme).
- [ ] Hors ligne, la dernière valeur connue est gardée.
- [ ] Tests : analyse des formes d'URL, et classement des réponses (fetch injecté).
