# 09 : Survival Kit : déplacer ses tests

**Status:** ready-for-human

**Blocked by:** 02 — Mesurer ; 04 — Un Hôte de test dans le SDK ; 05 — Les tests de contrat des Modules dans l'Hôte.

Spec parente : [des tests navigateur rapides et fiables](../spec.md). Table de référence : `.scratch/e2e-reliability/audit.md`, section Survival Kit.

**What to build:** Les 7 tests navigateur de `packages/host/e2e/survival-kit.test.ts` quittent ce dépôt selon l'audit. Ses règles sont prouvées dans `../tessello-survival-kit` par des tests unitaires, ou par une petite suite navigateur contre l'Hôte de test. Il ne reste ici que ses tests de contrat (ticket 05), et ceux que l'audit classe « Hôte ».

Notes pour ce Module : C'est le plus petit : il peut servir à valider le processus avant les trois autres.

## Critères d'acceptation

- [x] Dans `../tessello-survival-kit` : chaque ligne « unitaire » de l'audit a son test unitaire dans `test/`. Chaque ligne « navigateur du Module » a son test dans une suite navigateur du Module (par exemple `e2e/`, lancée par `npm run test:browser` et `just e2e`), qui sert le `dist/` du Module et utilise l'Hôte de test du SDK (ticket 04) et son utilitaire d'attente. Le README du Module dit comment la lancer. Les sources du Module ne changent pas.
- [x] **Pas de perte de couverture :** pour chaque nouveau test, on casse volontairement, une fois, le comportement qu'il protège dans le code du Module, on le voit échouer, puis on annule. Le résultat (test, modification faite, échec observé) est noté dans `audit.md`, en face de la ligne. Une ligne « déjà couvert » est vérifiée de la même façon sur le test cité.
- [x] Le workflow de CI du Module (s'il y en a un, sinon un nouveau) lance ses tests unitaires et sa suite navigateur à chaque push. `just publish` du Module les lance aussi avant de publier.
- [x] Dans ce dépôt : les tests déplacés sont supprimés de `packages/host/e2e/survival-kit.test.ts`, ou le fichier entier s'il n'y reste rien, avec les utilitaires qui ne servent plus. Les tests de contrat et les tests « Hôte » restent.
- [x] La suite navigateur du Module passe 3 fois de suite avec `E2E_CPU_SLOWDOWN=4`. La suite navigateur de ce dépôt passe toujours. Les durées avant et après, des deux côtés, sont ajoutées à `mesures.md`.
- [x] Pousser `craftskillz/tessello-survival-kit` demande l'accord du Mainteneur : le ticket se termine avec des commits locaux dans les deux dépôts, et la liste de ce qu'il reste à pousser.

## Comments

- 2026-10-26 — **Implémentation.** Dans `../tessello-survival-kit` : `e2e/` (4 fichiers, 6 tests, `node:test` + `playwright`) sert `dist/` et ouvre la Vue ou le Widget contre l'Hôte de test de `@tessello/sdk/testing`, sur le modèle de Watch Later (ticket 08). `e2e/survival-kit.ts` réunit l'ouverture (Vue avec ses paramètres, Widget à sa taille L, presse-papiers accordé sur demande), la lecture du stockage par `until` (`stored`) et les gestes de la Vue. `notes-and-links.test.ts` (59 c), `import.test.ts` (136 b), `storage-and-copy.test.ts` (168 b, par `refuseWrites({ code: "quota_exceeded" })` au lieu d'une note de 1,1 Mo ; 190 a), `widget.test.ts` (90 b, 112 a : la Vue et le Widget sur un même Hôte de test, `setVisible`, `openedViews`, `openView`). Aucune attente à durée fixe. L'audit n'a aucune ligne « unitaire » pour ce Module. `npm run test:browser` (construit `dist/` d'abord) et `just e2e` ; la CI installe Chromium puis lance la suite navigateur, et `just publish` la lance avant de publier ; le README dit comment la lancer. `tsconfig.json` vérifie aussi `e2e/`. Les sources du Module ne changent pas : `@tessello/sdk` et `tessello` passent de 0.1.0 à 0.2.0, et `playwright` s'ajoute aux devDependencies.
- **Dans ce dépôt**, `packages/host/e2e/survival-kit.test.ts` ne garde que la ligne « Hôte » 190 b (une Vue écrit dans le presse-papiers depuis son iframe `sandbox`), avec ses seuls utilitaires ; C1 à C3 sont dans `modules-contract.test.ts` (ticket 05). Les utilitaires de `browser.ts` servent tous encore ; `fixtures/survival-kit.zip` sert aux contrats et au test qui reste.
- **Pas de perte de couverture** : chaque ligne de la table Survival Kit de `audit.md` a sa colonne « Vérifié ». 16 lignes : 6 « navigateur du Module », 6 « déjà couvert » (dont 3 de l'Hôte : `home.test.ts`, `protocol.test.ts`), 3 « contrat », 1 « Hôte ». Une modification passait d'abord (136 b, les catégories comptées sur la liste des notes) : le test a été renforcé. Pour 112 b, retirer les paramètres du handshake ne fait pas échouer les deux tests cités, mais trois autres de `protocol.test.ts`, cités à leur place.
- **Mesures** (`mesures.md`) : `survival-kit.test.ts` de l'Hôte passe de 11,1 s (19,6 s ralenti) à 1,5 s (2,1 s) ; la suite du Module fait 2,5 s (3,5 s ralenti), 6/6 sur 3 passages de chaque. Tests unitaires du Module : 25, tous passent.
- **Suite navigateur de ce dépôt** après le ticket : 96 tests, 96 passent, 90,2 s. Tests unitaires : 549, tous passent.
- **Reste à faire par le Mainteneur :**
  1. Pousser `craftskillz/tessello-survival-kit` (`main`, commit local de ce ticket). `@tessello/sdk` 0.2.0 est déjà sur npm : `npm ci` passe.
  2. Pousser ce dépôt.
- **Revue (standards et spec)**, corrigé : le README du Module dit que `just publish` lance aussi les tests navigateur ; `addNote` est un utilitaire de `e2e/survival-kit.ts`, que `addCodeNote` et le test du stockage plein partagent ; `stored` n'a plus de paramètre `what` inutilisé ; les Vues du test du filtre se nomment `filtered` et `unfiltered` ; la ligne 112 b cite le test de `protocol.test.ts` qui prouve les paramètres du handshake ; la ligne 190 b ne dit plus « inchangé » (le test est renommé et réécrit dans la forme de `diagram.test.ts`). Laissé ouvert :
  - `stored` rend `any`, d'où des types écrits dans les tests (`(task: { text: string }) => …`), comme pour Skills Library.
  - Le contrat C1 (`modules-contract.test.ts`) ne relit qu'une tâche ; que les notes et les liens se relisent après un rechargement n'est prouvé que dans la suite du Module (59 c), contre l'Hôte de test.
  - `@tessello/sdk` passe à 0.2.0, une dépendance du code construit, comme pour Watch Later (ticket 08) : `index.js` est le même.
