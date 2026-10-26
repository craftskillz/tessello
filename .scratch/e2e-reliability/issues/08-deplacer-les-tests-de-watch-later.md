# 08 : Watch Later : déplacer ses tests

**Status:** ready-for-human

**Blocked by:** 02 — Mesurer ; 04 — Un Hôte de test dans le SDK ; 05 — Les tests de contrat des Modules dans l'Hôte.

Spec parente : [des tests navigateur rapides et fiables](../spec.md). Table de référence : `.scratch/e2e-reliability/audit.md`, section Watch Later.

**What to build:** Les 19 tests navigateur de `packages/host/e2e/watch-later.test.ts` quittent ce dépôt selon l'audit. Ses règles sont prouvées dans `../tessello-watch-later` par des tests unitaires, ou par une petite suite navigateur contre l'Hôte de test. Il ne reste ici que ses tests de contrat (ticket 05), et ceux que l'audit classe « Hôte ».

Notes pour ce Module : Le tri par score, les doublons, les tags et les sections relèvent sans doute de tests unitaires (`videos`, `drop`, `youtube`) ; le glisser-déposer des cartes et des sections, et le collage d'une URL n'importe où sur la page, de sa suite navigateur. La lecture du titre YouTube est simulée par l'Hôte de test (réseau simulé). L'échec CI `watch-later.test.ts:590` disparaît avec ce ticket.

## Critères d'acceptation

- [x] Dans `../tessello-watch-later` : chaque ligne « unitaire » de l'audit a son test unitaire dans `test/`. Chaque ligne « navigateur du Module » a son test dans une suite navigateur du Module (par exemple `e2e/`, lancée par `npm run test:browser` et `just e2e`), qui sert le `dist/` du Module et utilise l'Hôte de test du SDK (ticket 04) et son utilitaire d'attente. Le README du Module dit comment la lancer. Les sources du Module ne changent pas.
- [x] **Pas de perte de couverture :** pour chaque nouveau test, on casse volontairement, une fois, le comportement qu'il protège dans le code du Module, on le voit échouer, puis on annule. Le résultat (test, modification faite, échec observé) est noté dans `audit.md`, en face de la ligne. Une ligne « déjà couvert » est vérifiée de la même façon sur le test cité.
- [x] Le workflow de CI du Module (s'il y en a un, sinon un nouveau) lance ses tests unitaires et sa suite navigateur à chaque push. `just publish` du Module les lance aussi avant de publier.
- [x] Dans ce dépôt : les tests déplacés sont supprimés de `packages/host/e2e/watch-later.test.ts`, ou le fichier entier s'il n'y reste rien, avec les utilitaires qui ne servent plus. Les tests de contrat et les tests « Hôte » restent.
- [x] La suite navigateur du Module passe 3 fois de suite avec `E2E_CPU_SLOWDOWN=4`. La suite navigateur de ce dépôt passe toujours. Les durées avant et après, des deux côtés, sont ajoutées à `mesures.md`.
- [x] Pousser `craftskillz/tessello-watch-later` demande l'accord du Mainteneur : le ticket se termine avec des commits locaux dans les deux dépôts, et la liste de ce qu'il reste à pousser.

## Comments

- 2026-10-26 — **Implémentation.** Dans `../tessello-watch-later` : `e2e/` (5 fichiers, 20 tests, `node:test` + `playwright`) sert `dist/` et ouvre la Vue ou le Widget contre l'Hôte de test de `@tessello/sdk/testing` ; `e2e/watch-later.ts` réunit l'ouverture, YouTube simulé par `page.route` (oEmbed, en ligne ou non, avec le compte des requêtes ; une miniature de 1 × 1), les lectures du stockage de l'Hôte de test, et les gestes de la Vue (collage, glisser-déposer synthétiques, dialogues, tags). `add.test.ts` (ajouter : champ, collage, dépôt, titre illisible, stockage plein par `refuseWrites`), `watched.test.ts` (vu, score, note, annulation, suppression), `tags.test.ts` (rangées, groupes, suppression d'une section), `drag.test.ts` (cartes et sections déplacées), `widget.test.ts`. Les attentes du stockage passent par `until` (`stored`, `settingsStored`) ; celles d'un élément de la page restent l'attente propre de Playwright ; aucune attente à durée fixe. Les états que l'ancien test écrivait dans le dossier de l'Hôte (`writeFolder`) sont donnés à l'Hôte de test (`openView({ storage })`), et plusieurs tests partent ainsi d'un stockage pré-rempli plutôt que d'ajouter leurs vidéos par le champ. Les 2 lignes « unitaire » sont dans `test/youtube.test.ts` (`thumbnailUrl`, `oembedUrl`) et le nouveau `test/storage.test.ts` (`videoStorage` : stockage plein, autre panne avec sa raison, cause gardée). `npm run test:browser` (construit `dist/` d'abord) et `just e2e` ; la CI installe Chromium puis lance la suite navigateur, et `just publish` la lance avant de publier ; le README dit comment la lancer. `tsconfig.json` vérifie aussi `e2e/`. Les sources du Module ne changent pas : `@tessello/sdk` et `tessello` passent de 0.1.0 à 0.2.0 (dont `index.js` est le même, ticket 07), et `playwright` s'ajoute aux devDependencies.
- **Dans ce dépôt**, `packages/host/e2e/watch-later.test.ts` est supprimé : l'audit n'y classe aucun morceau « Hôte », et C1 et C2 sont dans `modules-contract.test.ts` (ticket 05). Les utilitaires de `browser.ts` servent tous encore ; `fixtures/watch-later.zip` sert aux contrats. L'exemple de `just e2e-only` nommait `watch-later` : il nomme `install`.
- **Pas de perte de couverture** : chaque ligne de la table Watch Later de `audit.md` a sa colonne « Vérifié ». 43 lignes : 19 « navigateur du Module », 2 « unitaire », 20 « déjà couvert » (dont 3 de l'Hôte : `permissions.test.ts`, `protocol.test.ts`, `home.test.ts`), 2 « contrat ». Toutes les modifications retenues ont fait échouer le test visé. Quatre passaient d'abord, et le test a été renforcé, pas la modification changée : 127 b, 376, 732 b, 678 b (détail en tête de la section). Les modifications sans effet observable sont notées au même endroit.
- **Écarts.** 809 c : la Vue et le Widget ne sont plus sur une même page ; le Widget, caché par `setVisible(false)`, relit les vidéos écrites dans le stockage de l'Hôte de test quand il est montré, et « + Add » comme « Open ↗ » sont vus dans `openedViews` (sans paramètres). 224 b : le stockage plein est un refus de l'Hôte de test (`refuseWrites`), et non plus un titre de 1,1 Mo ; la limite de 1 Mo de l'Hôte est « déjà couverte » (224 c).
- **L'échec CI `watch-later.test.ts:590`** (lecture de `settings.json` pendant que l'Hôte le remplace) disparaît avec le fichier ; la suite du Module lit le stockage en mémoire.
- **Mesures** (`mesures.md`) : `watch-later.test.ts` de l'Hôte (24,6 s, 88,4 s ralenti) disparaît ; la suite du Module fait 7,6 s (10,3 s ralenti), 20/20 sur 3 passages de chaque. Tests unitaires du Module : 77, tous passent.
- **Suite navigateur de ce dépôt** après le ticket : 102 tests, 102 passent, 100,5 s. Tests unitaires : 549, tous passent.
- **Reste à faire par le Mainteneur :**
  1. Pousser `craftskillz/tessello-watch-later` (`main`, commit local de ce ticket). `@tessello/sdk` 0.2.0 est déjà sur npm : `npm ci` passe.
  2. Pousser ce dépôt.
- **Revue (standards et spec)**, corrigé : le dialogue du score (`scoreDialog`) est un utilitaire de `e2e/watch-later.ts`, que `confirmWatched` et `watched.test.ts` partagent. Laissé ouvert :
  - `storedVideo` rend son objet par `as unknown as StoredVideo & Record<string, never>`, pour qu'il entre dans le stockage donné à l'Hôte de test ; `StoredVideo` ne décrit pas `addedAt`, `channel` ni `start`.
  - `stored` (les vidéos) et `settingsStored` (les réglages) ne se lisent pas de la même façon ; `stored` suit le nom de Skills Library.
  - `fakeYouTube` est exporté sans qu'un test l'importe.
