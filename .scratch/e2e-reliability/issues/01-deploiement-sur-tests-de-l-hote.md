# 01 : Le déploiement ne dépend plus des tests des Modules

**Status:** resolved

**Blocked by:** Aucun (peut commencer immédiatement).

Spec parente : [des tests navigateur rapides et fiables](../spec.md).

**What to build:** Le workflow *Deploy the Host* (`.github/workflows/deploy-host.yml`) déploie l'Hôte après la vérification de types, les tests unitaires, le build et un court jeu de tests navigateur propres à l'Hôte. La suite navigateur complète tourne toujours à chaque push, dans un workflow séparé dont l'échec se voit mais ne bloque pas le déploiement.

## Critères d'acceptation

- [x] Le jeu court de `deploy-host.yml` comprend au moins `pwa`, `handshake`, `install`, `install-url`, `home`, `permissions` et `update`. Sa liste est écrite à un seul endroit, réutilisable en local (par exemple une recette `just e2e-host` qui s'appuie sur `just e2e-only`).
- [x] Un nouveau workflow (par exemple `.github/workflows/browser-tests.yml`) lance `npm run test:browser` à chaque push sur `main` et par `workflow_dispatch`, sans aucun secret.
- [x] Le job `deploy` reste séparé du job qui installe les dépendances, et reste sauté sans la variable `CLOUDFLARE_ACCOUNT_ID` (ticket 12).
- [x] `DEPLOYING.md` et `README.md` décrivent la nouvelle répartition : ce qui bloque un déploiement, et où voir la suite complète.
- [x] `npm run typecheck`, `npm test` et le jeu court passent en local. Les workflows sont valides (au minimum relus ; `actionlint` s'il est disponible).

## Comments

**2026-10-25, implémentation.** La liste du jeu court est le script `test:browser:host` de `package.json` (les 7 fichiers exigés, rien de plus), utilisé par `deploy-host.yml` et par `just e2e-host`. Elle n'est pas construite sur `just e2e-only`, pour que la CI n'ait pas à installer `just`. `browser-tests.yml` lance la suite complète sans groupe de concurrence : chaque push garde son résultat. `actionlint` n'était pas disponible : les workflows ont été relus et analysés avec `js-yaml`.

Passages locaux (Mac du Mainteneur, sans ralentissement) :
- `just e2e-host` : 33 tests, environ 27 s ; 2 passages réussis sur 3. Le passage en échec venait de `home.test.ts:95` (`filechooser`, l'échec CI de la spec) ; `home.test.ts` seul est ensuite passé 3 fois sur 3. Ce test conditionne maintenant le déploiement : son instabilité y reste jusqu'au ticket 10.
- `npm run test:browser` : 202/203, environ 5 min. Nouvel échec, absent de la CI : `diagram.test.ts:1800` (« imports the files of living-documentation… », `missing image` jamais visible), à consigner dans `mesures.md` (ticket 02).
