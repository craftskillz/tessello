# 01: Squelette : des diagrammes, des rectangles et des flèches attachées, enregistrés

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** La première tranche de bout en bout du Module Diagram. On l'installe dans l'Hôte, on crée un diagramme, on y pose des rectangles reliés par des flèches, et tout est retrouvé après un rechargement. Ce ticket pose le modèle de données de la spec (formes, flèches, extrémités) et le canevas SVG, sur lesquels les tickets suivants s'appuient.

**Blocked by:** aucun

**Status:** resolved

### Paquet

- [x] `sample-modules/diagram/` est construit comme le Survival Kit (Svelte 5, esbuild, `scripts/build.ts`, `dist/` ignoré par git). L'identifiant est `@tessello/diagram`, et le Module ne déclare aucune Permission.
- [x] Un Guide d'utilisation minimal existe, car la Convention l'exige. Il est complété au ticket 16.
- [x] Le paquet passe le Validateur sans erreur ni avertissement. Le test des exemples couvre `sample-modules/diagram`.
- [x] Le thème suit celui de l'Hôte, et la langue suit le `locale` (catalogues anglais et français dès ce ticket).

### Diagrammes

- [x] Une barre latérale liste les diagrammes. « + New » crée « New diagram » et l'ouvre. Le titre se modifie dans la barre d'outils, et un titre vide devient « Untitled ».
- [x] La suppression d'un diagramme demande une confirmation, dans une boîte de dialogue du Module. Si le diagramme ouvert est supprimé, le premier restant s'ouvre, ou l'état vide « Select or create a diagram » s'affiche.
- [x] La Vue s'ouvre sur le diagramme `params.id` s'il existe (handshake et `navigation.params`), sinon sur le plus récemment modifié.

### Canevas

- [x] Le canevas est un SVG qui se déplace à la souris (glisser sur le vide avec Espace ou le bouton du milieu, ou molette) et se zoome (Ctrl/Cmd + molette).
- [x] Outil Rectangle : un double-clic sur le vide pose un rectangle et ouvre l'édition de son texte (Entrée valide, Maj+Entrée ajoute une ligne, Échap abandonne).
- [x] Outil Sélection : un clic sélectionne une forme, un glisser la déplace, et Suppr la supprime.
- [x] Outil Flèche, version minimale : un glisser d'une forme vers une autre crée une flèche entre ces formes, avec des extrémités **automatiques** (spec, « Extrémité automatique »). Le trait s'arrête au contour des formes et n'y entre jamais. Les extrémités libres et les points d'attache arrivent au ticket 03.
- [x] Déplacer une forme redessine aussitôt les flèches qui y sont attachées.

### Stockage

- [x] Les clés `diagrams` et `diagram:<id>` sont utilisées (spec, « Stockage »). L'enregistrement est automatique à la fin de chaque geste, et un indicateur « Saved » / « Save failed » affiche le résultat. Il n'y a pas de bouton Enregistrer.
- [x] Un échec de lecture au démarrage affiche une erreur et bloque l'édition. Un échec d'écriture est signalé, et la modification reste à l'écran marquée comme non enregistrée.
- [x] La Vue relit le stockage quand elle redevient visible.

### Tests

- [x] Tests unitaires : intersection d'un segment avec le contour d'un rectangle, et lecture défensive d'un diagramme stocké.
- [x] Test navigateur : installation, puis deux rectangles reliés par une flèche, retrouvés après un rechargement ; la flèche suit un rectangle déplacé.

## Comments

### Implémentation (2026-10-20)

- **Paquet** : `sample-modules/diagram/` (Svelte 5, esbuild, `scripts/build.ts`), `@tessello/diagram` 0.1.0, sans Permission ni Widget (ticket 12). Guide minimal dans `guide/guide.md`.
- **Modèle** (`src/lib/diagram.ts`) : le modèle complet de la spec (formes, flèches, `Extrémité`), lu de façon défensive, pour qu'une version suivante ne perde rien de ce qu'elle a écrit. Les couleurs sont des clés de palette (`c-gray`), comme `colorKey` dans l'original, pour faciliter l'import (ticket 15).
- **Géométrie** (`src/lib/geometry.ts`, fonctions pures) : `outlinePoint` (contour d'un rectangle, rotation comprise), `arrowEnds` (extrémités automatiques), `shapeAt` (forme au premier plan sous un point), `arrowHead` (le trait s'arrête à la base de la pointe, qui touche le contour).
- **Stockage** : `diagrams` puis `diagram:<id>`. Les écritures passent l'une après l'autre. Après un échec, le diagramme ouvert et son entrée de la liste restent tels qu'à l'écran, même quand la Vue relit le stockage en redevenant visible.
- **Tests** : `test/geometry.test.ts`, `test/diagram.test.ts`, `packages/host/e2e/diagram.test.ts` (rectangles et flèche après rechargement, flèche qui suit un rectangle déplacé, suppression confirmée, titre vide, échec d'enregistrement). Le test des exemples couvre le paquet construit.

**Au-delà du ticket**, gardé parce que l'omettre laisserait un état incohérent ou que c'est minime :
  - Suppr sur une forme libère les extrémités des flèches attachées, à l'endroit où elles étaient dessinées (spec, story 13). Sinon, une flèche dont une extrémité vise une forme supprimée ne serait plus dessinée, tout en restant dans le stockage.
  - Un double-clic sur une forme existante modifie son texte (ticket 02). Les flèches se sélectionnent et se suppriment. Les touches V, R et F choisissent l'outil.

**Limites** :
  - L'ouverture sur `params.id` est implémentée (handshake et `navigation.params`). Elle n'a pas de test navigateur, faute de Widget pour envoyer ces params (ticket 12).
  - Le blocage sur un échec de lecture n'a pas de test navigateur, faute de moyen simple de faire échouer `storage.get` dans l'Hôte.
  - Échap sur un rectangle qu'on vient de poser abandonne le texte, mais garde le rectangle vide (comme l'original).
  - Sans lien avec ce ticket : `survival-kit.test.ts` échoue environ une fois sur quatre. `readFolder` lit un fichier pendant que l'Hôte l'écrit (`NotReadableError`). `diagram.test.ts` relit en cas d'échec ; il faudrait corriger `readFolder` dans `e2e/browser.ts`.
