# 02: Toutes les formes intégrées, leur texte et leur style

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** L'Utilisateur dispose des sept formes intégrées de l'original. Il peut les redimensionner, les tourner, écrire leur texte et les mettre en forme. C'est le parcours 2 et la plus grande partie du parcours 3 de la rétrodoc.

**Blocked by:** 01 (Squelette)

**Status:** resolved

- [x] Outils Rectangle (R), Ellipse (E), Database (D), Circle (C), Actor (A), Post-it (P), Free text (T) et Select (S, Échap). Chaque forme a le rendu de l'original (la base de données a son cylindre, le Post-it son coin plié, l'Acteur sa silhouette) et suit le thème clair ou sombre.
- [x] Redimensionnement par les poignées des coins, avec une taille minimale de 20 unités. Maj garde les proportions, et l'Acteur les garde toujours. Le mode « coin opposé fixe » ou « centre fixe » se choisit dans la barre d'outils.
- [x] Rotation par une poignée dédiée et par les boutons ±10°. Le texte a sa propre rotation.
- [x] Le panneau de forme permet de régler :
  - la couleur (palette de l'original, en variantes claire et sombre) ;
  - l'opacité du fond (0–100 %) ;
  - la taille du texte (8–48) ;
  - l'alignement horizontal et vertical ;
  - l'ordre (premier plan, arrière-plan).
- [x] Double-clic sur une forme, ou bouton « Edit text » : édition du texte sur place, avec retour à la ligne automatique dans la largeur de la forme.
- [x] Ctrl/Cmd+clic ajoute une forme à la sélection ou l'en retire, et Ctrl/Cmd+A sélectionne tout. Le panneau s'applique à toute la sélection.
- [x] Les flèches attachées suivent la forme quand elle est redimensionnée ou tournée, avec le contour réel : cercle, ellipse, cylindre et forme tournée.
- [x] Tests unitaires : contour de chaque forme (intersection d'une demi-droite depuis le centre), y compris tournée.
- [x] Test navigateur : poser chaque forme, la redimensionner avec Maj, la tourner, changer sa couleur et son texte, puis tout retrouver après un rechargement.

## Comments

### Implémentation (2026-10-20)

- **Géométrie** (`src/lib/geometry.ts`, fonctions pures) : `outlinePoint` suit le contour réel de chaque type (rectangle, ellipse, cercle, cylindre de la base de données, rotation comprise), et `shapeAt` sélectionne par ce même contour. `resizeBox` : coin opposé ou centre fixe, proportions gardées, taille minimale de 20, dans le repère de la forme tournée.
- **Modèle** (`src/lib/diagram.ts`) : `textRotation`, taille et couleur de création par type (le Post-it est ambre), taille du texte ramenée dans 8–48 à la lecture, `reorder` pour le premier plan et l'arrière-plan.
- **Texte** (`src/lib/text.ts`) : le texte revient à la ligne dans la largeur de la forme, mesuré dans la police de la Vue. Celui de l'Acteur va sous sa silhouette, comme dans l'original.
- **Vue** : `ShapeView.svelte` dessine chaque forme ; `ShapePanel.svelte` est le panneau de style, qui s'applique à toute la sélection ; `Canvas.svelte` gère la multi-sélection, les poignées de redimensionnement, de rotation et de rotation du texte (T), et les touches R, E, D, C, A, P, T, S, F, Échap et Ctrl/Cmd+A. Les 15 couleurs de l'original ont une variante sombre, qui n'existait pas.
- **Tests** : `test/geometry.test.ts` (contour de chaque forme, tournée ou non, redimensionnement), `test/diagram.test.ts`, `test/text.test.ts`, et deux tests dans `packages/host/e2e/diagram.test.ts` : les sept formes redimensionnées avec Maj, tournées, colorées, retrouvées après un rechargement ; une flèche qui suit le contour d'un cercle redimensionné et d'une ellipse tournée.

**Choix** :
  - Le panneau est ancré à droite du canevas, au lieu de flotter : flottant, il cachait le dessin.
  - Le Cercle garde toujours ses proportions, comme l'Acteur. Dans l'original, sa hauteur était ignorée.
  - Les tailles de création sont un peu plus grandes que dans l'original, pour qu'une nouvelle forme tienne un mot ou deux. Le ticket 11 rend les valeurs par défaut réglables.
  - Les touches : S choisit Sélection (au ticket 01, c'était V). Un clic sans glisser sur une forme d'une multi-sélection la sélectionne seule.
  - Un geste suit le pointeur sur toute la Vue (écouteurs sur `window`). Dans Chromium sans écran, la capture du pointeur ne tenait pas au-delà du canevas.

**Au-delà du ticket** : des boutons ±10° pour la rotation du texte, et Maj sur la poignée de rotation, qui tourne par pas de 15°.

**Limites** :
  - Les poignées n'apparaissent que sur une forme sélectionnée seule. L'original redimensionnait et tournait aussi une multi-sélection comme un seul bloc.
  - Le champ d'édition du texte n'est pas tourné avec sa forme. Pour l'Acteur, il couvre la silhouette, alors que le texte s'affiche dessous.
  - Ctrl/Cmd+clic n'ajoute que des formes. Une flèche ne s'ajoute à la sélection que par Ctrl/Cmd+A.

