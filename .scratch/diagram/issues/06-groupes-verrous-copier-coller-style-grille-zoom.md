# 06: Groupes, verrous, copier-coller, copie de style, grille, guides et zoom

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** Les outils pour travailler sur de grands schémas (parcours 3, 5, 6 et 9 de la rétrodoc), avec les simplifications décidées : un clic sur un élément verrouillé le sélectionne, sans maintien de 2 s, et « Copy style / Paste style » remplace les trois tampons.

**Blocked by:** 03 (Connexions)

**Status:** resolved

### Groupes

- [x] « Group selection » (au moins deux formes) et « Ungroup ». Un clic sur un membre sélectionne tout le groupe, entouré d'un contour en pointillé. Alt+clic sélectionne un membre seul.
- [x] Le groupe se déplace, se redimensionne et se met en forme d'un bloc.

### Verrous

- [x] « Lock » sur des formes ou des flèches. Une flèche libre se verrouille avec ses deux extrémités.
- [x] Un clic sur un élément verrouillé le sélectionne avec un badge cadenas. Il ne peut alors être ni déplacé, ni redimensionné, ni supprimé, et son panneau n'offre que **Unlock**.
- [x] La sélection rectangle et Ctrl/Cmd+A ignorent les éléments verrouillés.

### Copier-coller

- [x] Ctrl/Cmd+C copie dans un presse-papiers interne au Module les formes sélectionnées et les flèches dont les deux extrémités sont dans la sélection. Ctrl/Cmd+V colle avec un décalage de 40 unités qui s'accumule. Les groupes collés sont de **nouveaux** groupes, indépendants des originaux (Q-015).
- [x] Une image présente dans le presse-papiers système passe en priorité au collage. C'est réalisé au ticket 08, et ce ticket laisse la place pour le faire.

### Copie de style

- [x] « Copy style » (Ctrl/Cmd+Alt+C) prend la couleur, l'opacité, la taille et l'alignement du texte de la forme sélectionnée. Avec « with size » coché, elle prend aussi la largeur et la hauteur. Pour une flèche, elle prend les pointes, le pointillé, l'épaisseur, la couleur, la taille du texte et le tracé.
- [x] « Paste style » (Ctrl/Cmd+Alt+V) l'applique à toute la sélection du même genre.

### Grille, guides et zoom

- [x] Une grille avec aimantation (G) et des guides d'alignement (bords et centres des autres formes). Les deux sont activés par défaut et enregistrés avec le diagramme.
- [x] Zoom −/+ et « Fit » (ajuster la vue au contenu), avec le pourcentage affiché.

### Tests

- [x] Tests unitaires : candidats des guides d'alignement, aimantation sur la grille, copie de groupes (nouveaux `groupId`), application d'un style copié.
- [x] Test navigateur : grouper puis déplacer, verrouiller puis tenter de supprimer, copier-coller un groupe relié par une flèche, copier un style.

## Comments

### Implémentation (2026-10-21)

- **Modèle** (`src/lib/diagram.ts`) : `groupShapes` donne un nouveau `groupId` aux formes sélectionnées (au moins deux), `ungroupShapes` efface les groupes touchés par la sélection, avec leurs autres membres, et `withGroups` étend une sélection aux membres de ses groupes.
- **Presse-papiers** (`src/lib/clipboard.ts`) :
  - `copyItems` copie les formes sélectionnées et les flèches dont les deux extrémités sont dans la sélection : une extrémité attachée à une forme sélectionnée, ou une extrémité libre d'une flèche sélectionnée.
  - `pasteItems` colle des formes et des flèches nouvelles, décalées et mises au premier plan dans leur ordre. Les flèches relient les nouvelles formes, et chaque groupe collé est un **nouveau** groupe (Q-015).
  - `copyStyle` et `applyStyle` portent « Copy style » / « Paste style ».
- **Placement** (`src/lib/placement.ts`) : `snapToGrid` (pas de 20, comme living-documentation), `alignment` (bords et centres des autres formes, le plus proche gagne, avec les guides à dessiner), `boundsOf`, `scaleBoxes` (redimensionnement d'un groupe) et `fitView`. `geometry.ts` expose `cornersOf`.
- **Vue** :
  - `Canvas.svelte` gère le clic sur un groupe (Alt+clic pour un membre seul), son contour en pointillé et ses poignées de redimensionnement, ainsi que les verrous (badge cadenas, panneau « Unlock » seul).
  - Il gère aussi les raccourcis Ctrl/Cmd+C, Ctrl/Cmd+V, Ctrl/Cmd+Alt+C, Ctrl/Cmd+Alt+V et G, la grille dessinée en motif SVG, les guides pendant un déplacement, et le zoom −/+/Fit avec son pourcentage, en bas à gauche du canevas.
  - `Toolbar.svelte` a les boutons « Grid (G) » et « Guides », enregistrés avec le diagramme.
  - `SelectionActions.svelte` porte Lock, Copy style et Paste style, partagés par les deux panneaux. Le Guide a deux nouvelles sections.
- **Tests** : `test/placement.test.ts`, `test/clipboard.test.ts` et les groupes dans `test/diagram.test.ts`. Cinq tests navigateur : grouper puis déplacer, verrouiller puis tenter de supprimer, copier-coller deux fois un groupe relié par une flèche, copier un style (avec et sans la taille), grille, guides et zoom.

**Choix** :
  - La grille aimante le centre de la forme saisie, pendant le glissement et pas seulement à la fin. Les guides alignent le cadre de toutes les formes déplacées, et passent avant la grille. Une flèche libre déplacée seule n'est pas aimantée, et une forme créée par double-clic non plus : seul le déplacement d'une forme l'est.
  - Après « Lock », la sélection reste : son panneau propose aussitôt « Unlock ». Dès que la sélection contient un élément verrouillé, le panneau n'offre que « Unlock ». Supprimer, déplacer et « Paste style » laissent de côté les éléments verrouillés d'une sélection mixte.
  - Une copie est collée déverrouillée, pour pouvoir la déplacer de là où elle tombe. Un membre copié sans le reste de son groupe est collé hors de tout groupe. Le contour en pointillé n'entoure qu'un groupe sélectionné en entier : un membre pris par Alt+clic n'en a pas.
  - Ctrl/Cmd+Suppr garde les flèches verrouillées des formes supprimées : leurs extrémités deviennent libres.
  - Une sélection rectangle s'étend aux groupes des formes qu'elle prend, comme un clic.
  - « Fit » ne grossit pas au-delà de 100 % : un petit dessin est centré à sa taille réelle.
  - Ctrl/Cmd+C et Ctrl/Cmd+V passent par `keydown`, sans empêcher l'événement `paste`. Le ticket 08 pourra l'utiliser pour lire une image du presse-papiers système avant le presse-papiers interne.

**Limites** :
  - Le redimensionnement d'un groupe ne déplace pas les points de passage de ses flèches, et une forme tournée de biais n'y garde pas exactement ses proportions.
  - Le copier-coller et « Paste style » ne s'annulent pas encore (ticket 07).
