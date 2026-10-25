# Spec : des tests navigateur rapides et fiables

**Status:** ready-for-agent

Contexte : ticket 12 de tessello-v1 (déploiement de l'Hôte), qui a ajouté le workflow `.github/workflows/deploy-host.yml` et `DEPLOYING.md`. Vocabulaire : `GLOSSARY.md`.

## Problème

Les tests navigateur de ce dépôt (`npm run test:browser`, `just e2e` : Playwright + Chromium, environ 205 tests dans 22 fichiers de `packages/host/e2e/`) sont lents et échouent parfois sans que le code soit en cause.

- **Lents.** Les fichiers tournent l'un après l'autre (`--test-concurrency=1`), chacun avec son propre Chromium : environ 8 minutes sur GitHub Actions.
- **Instables.** Ils passent sur le Mac du Mainteneur, mais au premier passage en CI (run 40208924784, 2026-10-25), 4 tests ont échoué, et le déploiement de l'Hôte a été bloqué :
  - `diagram.test.ts:1143`, « the Host did not write the change » : une boucle d'attente à budget fixe (50 × 100 ms) a expiré ;
  - `watch-later.test.ts:590`, `NotFoundError` : le test lit `settings.json` pendant que l'Hôte le remplace ;
  - `home.test.ts:95`, événement `filechooser` jamais reçu : l'action part avant que le tiroir de gestion soit prêt ;
  - `skills-library.test.ts:1146` : le panneau de survol du radar reste visible après le départ du pointeur.
- **Mal placés.** Environ 125 de ces tests (`diagram` 45, `skills-library` 54, `watch-later` 19, `survival-kit` 7, soit environ 4 500 lignes) ne testent pas l'Hôte : ils vérifient les fonctionnalités des Modules @craftskillz (l'ordre des vidéos vues, l'export `.drawio`, la migration d'un ancien stockage, la taille d'un panneau sur 360 px…). Chacun démarre Chromium, sert l'Hôte, choisit un dossier, installe le `.zip` publié de `packages/host/e2e/fixtures/`, attend le handshake, puis vérifie une règle du Module. Ils testent donc une version publiée, pas les sources, qui vivent dans `craftskillz/tessello-<name>`. Or ces dépôts ont déjà leurs tests unitaires (environ 230 pour diagram, 337 pour skills-library, 71 pour watch-later, 25 pour survival-kit) : une partie de ces tests navigateur les recoupe, et une autre teste de la logique qui n'a pas besoin d'un navigateur.

## Résultat attendu

Chaque comportement est testé au niveau le plus bas qui le prouve, dans le dépôt qui le possède :

1. **Dépôt `tessello` : l'Hôte.** Les tests navigateur de l'Hôte lui-même (installation, Permissions, mise à jour, Accueil, PWA…) et, pour chaque Module @craftskillz, un court **test de contrat** de son paquet publié : il s'installe, sa Vue et son Widget démarrent, une donnée écrite se relit après un rechargement, et son Guide d'utilisation s'ouvre.
2. **Dépôt de chaque Module : tests unitaires.** Toute règle qui n'a pas besoin d'un vrai pointeur (tri, filtres, limites, migration, export, calculs de position) est testée sur le code du Module, sans navigateur.
3. **Dépôt de chaque Module : une petite suite navigateur.** Ce qui exige un navigateur (glisser, survol, clavier, gestes) tourne sur la page du Module contre un **Hôte de test** fourni par le SDK, en mémoire : ni Hôte, ni Dossier des Modules, ni installation, ni iframe.

Conséquences attendues : le déploiement de l'Hôte ne dépend que des tests de l'Hôte ; la suite navigateur de `tessello` passe à quelques dizaines de tests et quelques minutes ; un échec d'un test de Module se voit dans le dépôt du Module, au moment où son code change.

## Hypothèses de périmètre

- On ne change pas d'outil : `node:test` + `playwright` restent, ici comme dans les Modules (pas de `@playwright/test`, pas de bibliothèque de composants).
- **Aucune perte de couverture.** Un test navigateur ne quitte ce dépôt que lorsque son remplacement existe, et qu'on a vu ce remplacement échouer en cassant volontairement le comportement qu'il protège. Un test peut disparaître sans remplacement seulement s'il est prouvé redondant (le test qui le couvre déjà est nommé dans l'audit).
- On corrige les tests, pas le comportement de l'Hôte ni des Modules. Un défaut réel découvert en chemin fait l'objet de son propre ticket dans la spec concernée.
- Pas de nouvelle tentative automatique d'un test qui échoue : elle masquerait l'instabilité.
- Faire tourner les fichiers en parallèle n'est pas prévu : une fois la suite réduite, on décidera d'après les mesures s'il est encore utile.

## Règles communes

- **Une seule façon d'attendre.** Un test attend un état observable (un élément, un fichier écrit, un message), jamais une durée fixe. Dans chaque dépôt, les attentes passent par un même utilitaire qui réessaie jusqu'à une échéance (pas un nombre d'essais), tolère une lecture qui lève, et dont l'échéance se règle à un seul endroit.
- **Machine lente reproductible.** Une variable d'environnement (`E2E_CPU_SLOWDOWN`) ralentit le processeur de Chromium (CDP `Emulation.setCPUThrottlingRate`), pour reproduire en local les conditions de la CI.
- **Travail sur plusieurs dépôts.** Les tickets 06 à 09 modifient `../tessello-<name>` (le clone local, comme le crée `just new-module`) et ce dépôt. Les sources d'un Module ne changent pas : seuls ses tests et ses outils de test. Pousser dans un autre dépôt, ou publier une version, demande l'accord du Mainteneur.
- La CI de l'Hôte garde les règles du ticket 12 : le job qui détient le jeton Cloudflare n'installe aucune dépendance, et sans la variable `CLOUDFLARE_ACCOUNT_ID`, le déploiement est sauté.

## Tickets

| # | Ticket | Bloqué par |
|---|---|---|
| 01 | [Le déploiement ne dépend plus des tests des Modules](issues/01-deploiement-sur-tests-de-l-hote.md) | — |
| 02 | [Mesurer : durées par fichier, tests instables, machine ralentie](issues/02-mesurer.md) | — |
| 03 | [Audit : où va chaque test navigateur d'un Module](issues/03-audit-et-repartition.md) | — |
| 04 | [Un Hôte de test dans le SDK](issues/04-hote-de-test-dans-le-sdk.md) | 03 |
| 05 | [Les tests de contrat des Modules dans l'Hôte](issues/05-tests-de-contrat-des-modules.md) | 03 |
| 06 | [Diagram : déplacer ses tests](issues/06-deplacer-les-tests-de-diagram.md) | 02, 04, 05 |
| 07 | [Skills Library : déplacer ses tests](issues/07-deplacer-les-tests-de-skills-library.md) | 02, 04, 05 |
| 08 | [Watch Later : déplacer ses tests](issues/08-deplacer-les-tests-de-watch-later.md) | 02, 04, 05 |
| 09 | [Survival Kit : déplacer ses tests](issues/09-deplacer-les-tests-de-survival-kit.md) | 02, 04, 05 |
| 10 | [Les tests de l'Hôte qui restent : une seule façon d'attendre](issues/10-attentes-des-tests-de-l-hote.md) | 02, 06, 07, 08, 09 |

01 débloque le déploiement et peut passer en premier. 02 et 03 peuvent se faire en parallèle. 06 à 09 sont indépendants entre eux.
