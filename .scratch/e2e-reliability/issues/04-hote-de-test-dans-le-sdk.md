# 04 : Un Hôte de test dans le SDK

**Status:** ready-for-human

**Blocked by:** 03 — Audit (sa liste des besoins de chaque Module).

Spec parente : [des tests navigateur rapides et fiables](../spec.md), section « Résultat attendu », niveau 3.

**What to build:** Un Créateur teste la Vue ou le Widget de son Module dans un navigateur sans Hôte. Sa page se connecte, comme d'habitude avec `connect()` du SDK, à un **Hôte de test** en mémoire, que le test prépare et inspecte : stockage de départ, thème, langue, visibilité, navigation. C'est ce que les tickets 06 à 09 utilisent pour les tests « navigateur du Module » de l'audit.

## Critères d'acceptation

- [x] `@tessello/sdk` expose l'Hôte de test sur un point d'entrée séparé (par exemple `@tessello/sdk/testing`), absent du code d'un Module en production. Il s'appuie sur le `transport` déjà injectable de `connect()` (`ConnectOptions`) et répond au protocole de la Convention (§6). Il réutilise si possible le protocole et le stockage de `@tessello/host-core`, pour que ses réponses (erreurs et limites de taille comprises) soient celles du vrai Hôte.
- [x] Le test peut : fixer le contexte (surface, Module, langue, thème) ; pré-remplir le stockage et le relire, ou attendre qu'une clé soit écrite ; changer le thème et la visibilité ; recevoir les `openView` avec leurs paramètres et envoyer des paramètres de navigation ; faire échouer une écriture pour tester le message « ne peut pas être enregistré ». La liste couvre les besoins notés dans l'audit ; un besoin non couvert est signalé dans le ticket, pas ignoré.
- [x] Il fournit l'utilitaire d'attente de la spec (« Règles communes »), avec son échéance réglable et `E2E_CPU_SLOWDOWN`, pour que chaque Module n'ait pas à le réécrire.
- [x] Un exemple court montre comment une suite navigateur de Module l'utilise avec `playwright` et `node:test` : servir le `dist/` du Module, ouvrir sa Vue ou son Widget, brancher l'Hôte de test. Il est testé dans ce dépôt sur un Module d'exemple de `examples/`.
- [x] Les tests unitaires de l'Hôte de test passent avec `npm test`, et compilés et empaquetés avec `just packages`. Le README du SDK le documente. Une ADR consigne la décision : un Hôte de test public dans le SDK, ce qu'il garantit (même protocole et mêmes limites que l'Hôte) et ce qu'il ne garantit pas (pas de sandbox, de CSP ni de Permissions : les tests de contrat de l'Hôte s'en chargent).
- [ ] Le numéro de version du SDK est augmenté. La publication sur npm (`just npm-publish`) est faite par le Mainteneur.

## Comments

- 2026-10-25 — **Implémentation.** `@tessello/sdk/testing` (`packages/sdk/src/testing.ts`) : `createTestHost({ module, locale, theme, storage })` fait tourner `createHost` et `createMemoryPersistence` de `@tessello/host-core` ; les deux thèmes de l'Hôte sont passés dans host-core (`THEMES`), d'où l'Hôte et l'Hôte de test les lisent. Dans le navigateur, `host.attach(page, { surface, params })` (avant `page.goto`) : la page du Module est ouverte en haut de l'onglet, `connect()` poste donc ses requêtes à la page elle-même ; un script d'init les passe au test (`exposeFunction`), qui répond par `window.postMessage`. En Node, `host.mount()` donne un `transport` pour `connect({ transport })`. Le test : `host.storage` (lire, écrire, effacer, partagé par Vue et Widget, gardé au rechargement), `refuseWrites({ key, code })` (refus dans le stockage de l'Hôte, après ses propres contrôles : `not_ready`, clé, taille), `setTheme`, `setVisible` (par surface), `openedViews`, `openView(params)` (comme depuis le Widget). Attente : `until(read, what)`, `setWaitTimeout`, `cpuSlowdown()` et `slowDownCpu(page)` (`E2E_CPU_SLOWDOWN`). Navigateur : `serveFolder(dist)`, `WIDGET_SIZES`. Exemple : `packages/sdk/e2e/notes.test.ts` sur `examples/notes` (passe aussi avec `E2E_CPU_SLOWDOWN=4`) ; 16 tests unitaires `packages/sdk/test/testing.test.ts` ; le test `packed` importe et type `@tessello/sdk/testing` depuis `npm pack`. Le point d'entrée est compilé en un seul fichier avec host-core (esbuild, `scripts/build-packages.ts`) : le SDK reste sans dépendance. ADR 0019, README du SDK, terme « Hôte de test » au GLOSSARY. SDK 0.2.0.
- 2026-10-25 — **Besoins de l'audit non couverts par l'Hôte de test**, à faire autrement dans les tickets 06 à 09 :
  - **Réseau simulé** (Watch Later : oEmbed, miniatures, hors ligne puis en ligne, compte des requêtes ; Skills Library : GitHub, réponses modifiables, liste des requêtes) : `page.route` de Playwright sur la page du Module, comme le prévoit l'audit (la page n'a pas la CSP de l'Hôte). Le README le dit.
  - **Une Vue et un Widget sur la même page** : non ; une surface par page, deux pages pour les deux (elles partagent le stockage de l'Hôte de test).
  - **`until` et les valeurs fausses** : `false`, `0` et `""` comptent comme « pas encore » ; attendre une clé quelle que soit sa valeur se fait avec `!== null` (README).
- 2026-10-25 — **Reste à faire par le Mainteneur :** `just npm-publish` pour publier `@tessello/sdk` 0.2.0 ; les tickets 06 à 09 l'installent depuis npm dans les dépôts des Modules. Le doublon `cpuSlowdown` / serveur de fichiers avec `packages/host/e2e/browser.ts` est laissé au ticket 10, qui peut les importer de `@tessello/sdk/testing`.
