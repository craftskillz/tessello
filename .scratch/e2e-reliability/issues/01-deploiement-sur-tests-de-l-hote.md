# 01 : Le déploiement ne dépend plus des tests des Modules

**Status:** ready-for-agent

**Blocked by:** Aucun (peut commencer immédiatement).

Spec parente : [des tests navigateur rapides et fiables](../spec.md).

**What to build:** Le workflow *Deploy the Host* (`.github/workflows/deploy-host.yml`) déploie l'Hôte après la vérification de types, les tests unitaires, le build et un court jeu de tests navigateur propres à l'Hôte. La suite navigateur complète tourne toujours à chaque push, dans un workflow séparé dont l'échec se voit mais ne bloque pas le déploiement.

## Critères d'acceptation

- [ ] Le jeu court de `deploy-host.yml` comprend au moins `pwa`, `handshake`, `install`, `install-url`, `home`, `permissions` et `update`. Sa liste est écrite à un seul endroit, réutilisable en local (par exemple une recette `just e2e-host` qui s'appuie sur `just e2e-only`).
- [ ] Un nouveau workflow (par exemple `.github/workflows/browser-tests.yml`) lance `npm run test:browser` à chaque push sur `main` et par `workflow_dispatch`, sans aucun secret.
- [ ] Le job `deploy` reste séparé du job qui installe les dépendances, et reste sauté sans la variable `CLOUDFLARE_ACCOUNT_ID` (ticket 12).
- [ ] `DEPLOYING.md` et `README.md` décrivent la nouvelle répartition : ce qui bloque un déploiement, et où voir la suite complète.
- [ ] `npm run typecheck`, `npm test` et le jeu court passent en local. Les workflows sont valides (au minimum relus ; `actionlint` s'il est disponible).
