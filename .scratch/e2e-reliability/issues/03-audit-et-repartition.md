# 03 : Audit : où va chaque test navigateur d'un Module

**Status:** resolved

**Blocked by:** Aucun (peut commencer immédiatement).

Spec parente : [des tests navigateur rapides et fiables](../spec.md), sections « Résultat attendu » et « Hypothèses de périmètre » (aucune perte de couverture).

**What to build:** Une table qui décide, pour chacun des tests navigateur de `diagram.test.ts`, `skills-library.test.ts`, `watch-later.test.ts` et `survival-kit.test.ts` (environ 125), où il va, en s'appuyant sur les tests unitaires qui existent déjà dans `../tessello-<name>/test/`. Les tickets 04 à 09 suivent cette table ; personne ne refait le tri.

## Critères d'acceptation

- [x] `.scratch/e2e-reliability/audit.md` a une section par Module et une ligne par test navigateur : le fichier et la ligne, le nom du test, puis un seul des cinq destins suivants, avec la référence qui le justifie :
  - **contrat** : il reste dans ce dépôt, comme test de contrat (ticket 05) ;
  - **déjà couvert** : un test unitaire du Module prouve déjà la même règle (le fichier et le nom de ce test sont cités) ; il ne sera pas recréé ;
  - **unitaire** : la règle devient un test unitaire du Module (le fichier de test visé et le code testé sont cités) ;
  - **navigateur du Module** : il faut un vrai navigateur (glisser, survol, focus, mise en page, presse-papiers…) ; il va dans la suite navigateur du Module, contre l'Hôte de test du ticket 04 ;
  - **Hôte** : il prouve en réalité un comportement de l'Hôte (Dossier des Modules, Permissions, téléchargements…) ; il reste ici, et le comportement de l'Hôte visé est nommé.
  Un test qui prouve plusieurs choses peut être découpé : chaque morceau a sa ligne.
- [x] « Déjà couvert » se vérifie en lisant le test unitaire cité, pas seulement son nom. En cas de doute, le destin est « unitaire » ou « navigateur du Module ».
- [x] Pour chaque Module, l'audit liste ce dont la suite navigateur du Module aura besoin de l'Hôte de test : stockage pré-rempli, thème, langue, visibilité, `openView` et paramètres de navigation, réseau simulé (YouTube, GitHub…), fichiers ou presse-papiers. Le ticket 04 s'en sert comme cahier des charges.
- [x] Un résumé en tête donne le compte par destin et par Module, et la liste des tests de contrat retenus (au plus 3 par Module).
- [x] Ni test ni code n'est modifié dans ce ticket.

## Comments

**2026-10-25, implémentation.** [audit.md](../audit.md) classe les 125 tests en 244 lignes : 10 contrat, 105 déjà couvert, 12 unitaire, 114 navigateur du Module, 3 Hôte. Chaque « déjà couvert » cite un test lu, par sa ligne, dans le clone du Module (ou, pour un comportement de l'Hôte déjà prouvé, le test de l'Hôte qui le prouve).

- Les tests unitaires proposés ne visent que des modules TypeScript purs sans test : `youtube.ts` (URL de miniature et d'oEmbed) et `storage.ts` de Watch Later, `change-tag.ts` et `github-failure.ts` de Skills Library, `storage.ts` de Diagram. La logique de `store.svelte.ts` et des composants va dans la suite navigateur du Module : les runes Svelte 5 ne se chargent pas dans `node --test` sans compilation, et les sources ne changent pas.
- Watch Later et Skills Library n'ont aucun test qui ouvre leur Guide d'utilisation : leur contrat C3 est à écrire au ticket 05.
- 3 morceaux restent « Hôte » parce qu'aucun test de l'Hôte ne les prouve : le presse-papiers depuis une iframe `sandbox`, la visibilité transmise quand la page est cachée, et l'onglet ouvert hors du bac à sable. Le ticket 10 peut les réécrire avec un Module sonde.
- `skills-library.test.ts:655` (rafraîchir sans plus aucun skill ne marque rien) contredit `refreshSet` de `src/lib/skills.ts` seul (`test/skills.test.ts:874`, qui marque tout) : la règle n'est que dans `store.svelte.ts`, donc « navigateur du Module ».
