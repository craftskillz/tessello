# Mesures : tests navigateur, avant le déplacement

Ticket [02](issues/02-mesurer.md). Point de départ des tickets 06 à 10 : à refaire à la fin (`just e2e-repeat 3`, puis `E2E_CPU_SLOWDOWN=4 just e2e-repeat 3`) pour montrer ce que le déplacement a changé.

## Conditions

- **Date :** 2026-10-25, sur le commit `23bf931` (« Keep file chooser interception on for the whole of each browser test »), plus les outils de ce ticket.
- **Machine :** Mac du Mainteneur, Apple M5 (10 cœurs, 32 Go), Darwin 25.6.0. Rien d'autre de lourd ne tournait pendant les passages.
- **Versions :** Node v24.12.0, Playwright 1.64.1, Chromium 156.0.8078.4.
- **Suite :** 22 fichiers de `packages/*/e2e/`, 206 tests, un fichier après l'autre (comme `npm run test:browser`).
- **Ralentissement :** `E2E_CPU_SLOWDOWN=4` ralentit le processeur de chaque page. Les Vues et Widgets des Modules, dans des iframes `sandbox` sans `allow-same-origin`, tournent dans le processus de la page sous ce Chromium (aucune cible `iframe` dans CDP `Target.getTargets`). Ils sont donc ralentis aussi : une boucle de calcul y passe de 50 à 186 ms, comme dans la page (50 à 187 ms).

## Durées

Médiane et maximum sur 3 passages, en secondes ; total : somme des médianes.

| Fichier | Normal : médiane | Normal : max | Ralenti ×4 : médiane | Ralenti ×4 : max |
|---|---|---|---|---|
| `diagram` | 99,9 | 99,9 | 460,6 | 464,1 |
| `skills-library` | 72,0 | 72,6 | 625,5 | 636,2 |
| `watch-later` | 24,6 | 24,7 | 88,4 | 89,9 |
| `home` | 14,2 | 14,2 | 16,3 | 16,5 |
| `document-size` | 13,4 | 13,5 | 17,2 | 17,2 |
| `survival-kit` | 11,1 | 11,1 | 19,6 | 20,4 |
| `folder-modules` | 5,5 | 5,6 | 8,5 | 8,6 |
| `install-url` | 4,3 | 4,8 | 5,3 | 5,4 |
| `marketplace` | 4,2 | 4,2 | 7,0 | 7,7 |
| `settings` | 4,2 | 4,2 | 4,6 | 4,6 |
| `local-network` | 3,6 | 3,6 | 5,7 | 6,0 |
| `update` | 3,2 | 3,3 | 3,8 | 3,8 |
| `modules-folder` | 2,6 | 2,7 | 3,9 | 3,9 |
| `permissions` | 2,6 | 2,6 | 3,5 | 3,6 |
| `space` | 2,4 | 2,4 | 2,9 | 3,0 |
| `downloads` | 1,9 | 2,0 | 2,2 | 2,3 |
| `guide` | 1,5 | 1,5 | 1,7 | 1,7 |
| `install` | 1,2 | 1,3 | 2,1 | 2,1 |
| `handshake` | 0,9 | 0,9 | 1,1 | 1,1 |
| `package-files` | 0,8 | 0,8 | 1,1 | 1,1 |
| `pwa` | 0,7 | 0,7 | 1,0 | 1,1 |
| `data-files` | 0,7 | 0,7 | 1,0 | 1,0 |
| **Total** | **275,5 (4 min 36)** | | **1 283 (21 min 23)** | |

- Les 4 fichiers des Modules @craftskillz (`diagram`, `skills-library`, `watch-later`, `survival-kit`) font 207,6 s sur 275,5 (75 %) sans ralentissement, et 1 194 s sur 1 283 (93 %) ralentis. Les 18 fichiers de l'Hôte passent de 68 s à 89 s : ils supportent bien le ralentissement, les Modules non (`skills-library` ×8,7, `diagram` ×4,6).
- Le jeu court du déploiement (`pwa`, `handshake`, `install`, `install-url`, `home`, `permissions`, `update`) : 27 s, et 33 s ralenti.
- Les durées varient peu d'un passage à l'autre : le maximum dépasse la médiane de 12 % au plus (`install-url`).

## Les 4 échecs de la CI (run 40208924784)

| Échec de la CI | Normal | Ralenti ×4 | Constat |
|---|---|---|---|
| `diagram.test.ts:1143`, « undoes a move, a waypoint and a rename… », *the Host did not write the change* | 0/3 | 0/3 | Ne se reproduit pas. |
| `watch-later.test.ts:590`, « watched videos lead the row by score… », `NotFoundError` | 1/3 | 0/3 | Se reproduit sans ralentissement, avec la même erreur : `readFolder` (`browser.ts`) lit `settings.json` pendant que l'Hôte le remplace (`watch-later.test.ts:67`, `storedSettings`). |
| `home.test.ts:95`, « opens management actions with the keyboard… », `filechooser` jamais reçu | 0/3 | 0/3 | Ne se reproduit pas. Le commit `23bf931`, postérieur au run de la CI, garde l'interception du sélecteur de fichiers active pendant tout le test : c'est probablement la correction. |
| `skills-library.test.ts:1146`, « hovering a point shows its set… ; leaving closes it » | 0/3 | 0/3 | Ne se reproduit pas. |

Le ralentissement ×4 ne suffit donc pas à reproduire la CI : 3 de ses 4 échecs restent introuvables en local.

## Autres tests instables trouvés

| Test | Normal | Ralenti ×4 | Premier message, lieu |
|---|---|---|---|
| `diagram.test.ts:1489`, « links a shape to a new diagram, follows it with Shift+click and comes back… » | 0/3 | **3/3** | `1 !== 0` à `diagram.test.ts:1523` : juste après « ← Back », le test compte les boutons « ← Back to » sans attendre que la Vue l'ait retiré. |
| `survival-kit.test.ts:136`, « imports a .survival-kit.json of the original Survival Kit… » | 0/3 | 2/3 | `NotFoundError` à `survival-kit.test.ts:23` (`stored`, puis `readFolder`), à la ligne 160 : même cause que `watch-later.test.ts:590`. |
| `watch-later.test.ts:290`, « marking watched requires a score, cancelling discards the draft… » | 0/3 | 1/3 | `NotFoundError` à `watch-later.test.ts:67` (`storedSettings`), à la ligne 344 : même cause. |

- `diagram.test.ts:1800` (« imports the files of living-documentation… », signalé au ticket 01) : 0/6, ne se reproduit pas.
- **Deux familles** pour les tickets 06 à 10 : la lecture d'un fichier de données pendant que l'Hôte le remplace (`NotFoundError`, 3 tests, avec et sans ralentissement), et une vérification immédiate d'un état que la Vue n'a pas encore atteint (`diagram.test.ts:1523`, qui échoue à chaque passage ralenti). Les deux relèvent de la règle « une seule façon d'attendre » de la spec : un utilitaire qui réessaie jusqu'à une échéance et tolère une lecture qui lève.

## Après le ticket 06 (Diagram)

2026-10-25, même machine et mêmes versions. Médiane et maximum sur 3 passages, en secondes.

| Suite | Tests | Normal : médiane | Normal : max | Ralenti ×4 : médiane | Ralenti ×4 : max |
|---|---|---|---|---|---|
| `packages/host/e2e/diagram.test.ts`, avant | 45 | 99,9 | 99,9 | 460,6 | 464,1 |
| `packages/host/e2e/diagram.test.ts`, après (les 2 tests « Hôte ») | 2 | 2,0 | 2,0 | 3,2 | 3,3 |
| `../tessello-diagram`, `npm run test:browser` (`e2e/`, 13 fichiers, contre l'Hôte de test) | 43 | 36,4 | 36,7 | 47,5 | 48,6 |

- Les 43 tests du Module, et les 2 qui restent dans l'Hôte, prouvent en 38 s ce que les 45 tests de l'Hôte prouvaient en 100 s, et en 51 s ralentis au lieu de 461 s : ni installation, ni dossier, ni iframe, et l'Hôte de test répond en mémoire.
- **Instabilités trouvées, ralenti ×4**, toutes deux des attentes du test, corrigées dans la suite du Module :
  - « undoes a move, a waypoint and a rename… » (l'échec CI `diagram.test.ts:1143`) : Ctrl+Z pressé pendant que la Vue, montrée de nouveau, relit ses diagrammes. 3/3 avant, 0/5 après : le test attend que l'Hôte ait répondu à toutes les requêtes de la Vue (`answered`). C'est aussi un défaut du Module : `.scratch/diagram/issues/17-annulation-perdue-pendant-la-relecture.md`.
  - « new rectangles take the default color… » : un rechargement coupait l'écriture du texte d'une forme, l'attente `saved` étant satisfaite par l'écriture de la forme placée. 2/4 avant, 0/5 après : `addShape` attend que le texte soit dans le diagramme et la liste.
- `diagram.test.ts:1523` (« ← Back », 3/3 ralenti) : la suite du Module attend que le bouton disparaisse.

## Après le ticket 07 (Skills Library)

2026-10-26, même machine et mêmes versions. Médiane et maximum sur 3 passages, en secondes.

| Suite | Tests | Normal : médiane | Normal : max | Ralenti ×4 : médiane | Ralenti ×4 : max |
|---|---|---|---|---|---|
| `packages/host/e2e/skills-library.test.ts`, avant | 54 | 72,0 | 72,6 | 625,5 | 636,2 |
| `packages/host/e2e/skills-library.test.ts`, après | 0 | — | — | — | — |
| `../tessello-skills-library`, `node --test` sur `e2e/` (5 fichiers, contre l'Hôte de test) | 44 | 20,5 | 20,6 | 33,4 | 34,7 |

- Le fichier de l'Hôte est supprimé : aucune ligne de l'audit n'est « Hôte », et les contrats de Skills Library sont dans `modules-contract.test.ts`. Les 44 tests du Module prouvent en 21 s ce que les 54 tests de l'Hôte prouvaient en 72 s, et en 33 s ralentis au lieu de 626 s. Les mesures ne comptent pas la construction de `dist/` que fait `npm run test:browser` (2 s environ).
- **Instabilités** : aucune dans la suite du Module, ni normale ni ralentie (3 passages de chaque, 44/44).
- **L'échec CI `skills-library.test.ts:1146`** (le panneau de survol reste ouvert après le départ du pointeur) ne se reproduit pas dans la suite du Module : 10 passages ralentis ×4 des trois tests de survol (30/30), puis une sonde, non gardée, qui passe sur un point et le quitte aussitôt, avant même que le panneau ne s'ouvre, 20 fois par passage, sur 2 passages ralentis et 1 normal (60 départs, aucun panneau resté ouvert). Rien ne montre un défaut du Module : pas de ticket, et le test n'est pas affaibli. S'il revenait, ce serait dans l'iframe de l'Hôte, que la suite du Module n'a plus.
- **Suite navigateur de ce dépôt** après le ticket : 121 tests, 121 passent, 126,1 s (203 s après le ticket 06).

## Après le ticket 08 (Watch Later)

2026-10-26, même machine et mêmes versions. Médiane et maximum sur 3 passages, en secondes. Les durées « avant » sont celles du ticket 02.

| Suite | Tests | Normal : médiane | Normal : max | Ralenti ×4 : médiane | Ralenti ×4 : max |
|---|---|---|---|---|---|
| `packages/host/e2e/watch-later.test.ts`, avant | 19 | 24,6 | 24,7 | 88,4 | 89,9 |
| `packages/host/e2e/watch-later.test.ts`, après | 0 | — | — | — | — |
| `../tessello-watch-later`, `node --test` sur `e2e/` (5 fichiers, contre l'Hôte de test) | 20 | 7,6 | 7,6 | 10,3 | 10,3 |

- Le fichier de l'Hôte est supprimé : aucune ligne de l'audit n'est « Hôte », et les contrats de Watch Later sont dans `modules-contract.test.ts`. Les 20 tests du Module prouvent en 8 s ce que les 19 tests de l'Hôte prouvaient en 25 s, et en 10 s ralentis au lieu de 88 s. Les mesures ne comptent pas la construction de `dist/` que fait `npm run test:browser`.
- **Instabilités** : aucune dans la suite du Module, ni normale ni ralentie (3 passages de chaque, 20/20, et 3 passages ralentis de plus après chaque lot de tests écrit).
- **L'échec CI `watch-later.test.ts:590`** (`NotFoundError` : `settings.json` lu pendant que l'Hôte le remplace) disparaît avec le fichier : la suite du Module lit le stockage en mémoire de l'Hôte de test, par `until`.
- **Suite navigateur de ce dépôt** après le ticket : 102 tests, 102 passent, 100,5 s (126,1 s après le ticket 07).
