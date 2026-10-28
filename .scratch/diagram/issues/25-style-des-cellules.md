# 25 : Styliser les cellules d'un tableau

Status: resolved

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`. Suite des tickets 19 (forme Tableau) et 24 (liaisons depuis les cellules). Lié au ticket 21 (gras, italique et souligné).

## Demande

Donner à chaque cellule d'un tableau son propre fond et sa propre police. Pouvoir appliquer ce style à une cellule, à toute une ligne, à toute une colonne ou à tout le tableau.

## État actuel et explication

Lecture du code le 2026-10-28 : le style d'un tableau est celui de la forme entière. `Shape.color` (une clé de la palette, comme `c-blue`), `opacity`, `fontSize`, `textAlign` et `textValign` valent pour toutes ses cellules. `Shape.cells` ne contient que du texte (`string[][]`). `ShapeView.svelte` dessine le fond du tableau d'un seul tenant, puis le texte de chaque cellule avec les réglages de la forme. L'export draw.io (`tableChildren`, `src/lib/drawio.ts`) donne à toutes les cellules le même style, avec `fillColor=none`.

Le Module ne connaît aucune famille de police : le texte s'affiche dans la police de l'interface, et `text.ts` la mesure pour calculer les retours à la ligne. On ne peut pas non plus sélectionner une cellule : un clic sélectionne le tableau, un double-clic ouvre l'éditeur d'une cellule.

## Décisions (2026-10-28)

- **Police** : la taille, le gras, l'italique, le souligné et les alignements horizontal et vertical. Pas de famille de police. Le gras, l'italique et le souligné s'appliquent à tout le texte d'une cellule ; le ticket 21 garde la question des mots isolés pour la forme Texte.
- **Fond** : une couleur de la palette actuelle, comme pour les formes. La couleur du texte de la cellule est celle de cette entrée de la palette, comme pour une forme ; l'opacité reste celle du tableau.
- **Sélection** : en mode Sélection, sur un tableau déjà sélectionné, un clic sélectionne une cellule, Maj+clic étend la sélection en rectangle, et une poignée au bord de chaque ligne et de chaque colonne sélectionne la ligne ou la colonne. Le panneau s'applique à la sélection de cellules ; sans elle, au tableau entier.
- **Ligne, colonne ou tableau** : appliquer un style à plusieurs cellules l'écrit dans chacune d'elles ; il n'y a aucune règle de priorité entre cellule, ligne et colonne. Une ligne ajoutée copie le style de la ligne voisine, une colonne ajoutée celui de la colonne voisine.
- **Style du tableau** : une cellule sans style propre suit le style du tableau. Changer le style du tableau entier, sans sélection de cellules, efface tout le style propre de toutes ses cellules.

## Critères d'acceptation

- [ ] Une cellule peut avoir son propre fond (palette) et sa propre police : taille, gras, italique, souligné, alignements.
- [ ] Clic, Maj+clic et poignées de ligne et de colonne sélectionnent des cellules ; Échap ou un clic hors du tableau rend la sélection au tableau entier. Le panneau montre la valeur commune de la sélection, ou aucune quand elles diffèrent.
- [ ] Un style appliqué à une ligne, une colonne ou un rectangle de cellules est écrit dans chacune ; appliqué au tableau entier, il efface tous les styles propres des cellules.
- [ ] Ajouter une ligne ou une colonne copie le style de sa voisine ; retirer des lignes ou des colonnes garde le style des cellules restantes.
- [ ] Les retours à la ligne et la hauteur du texte tiennent compte de la taille et du style réels de chaque cellule.
- [ ] Sauvegarde et rechargement, annuler et rétablir, copier et coller conservent les styles ; les tableaux existants gardent leur apparence.
- [ ] L'export PNG et l'export draw.io conservent le fond et la police de chaque cellule.
- [ ] Les poignées de sélection de ligne et de colonne ne recouvrent ni les poignées de redimensionnement, de rotation et de séparateur, ni les poignées de liaison des cellules (ticket 24), à tous les zooms.
- [ ] Interface traduite, Guide mis à jour, tests unitaires du modèle et tests navigateur de la sélection et de l'application d'un style.

## Comments

- 2026-10-28 : demande recueillie après les retours de test du ticket 24 ; aucun code du Module modifié.
- 2026-10-28 : décisions prises avec le Créateur ; ticket prêt pour un agent.

### Implémentation (2026-10-28)

- Code et tests dans `../tessello-diagram/`, sur `main` (commit `d122e90`). Modèle : `cellStyles` (un style propre par cellule, `{}` pour une cellule qui suit le tableau) et, sur le tableau, `bold`, `italic` et `underline`, lus défensivement ; les tableaux existants se lisent sans style propre. Fonctions pures dans `src/lib/table.ts` (`cellStyleOf`, `styleCells`, `styleTable`, `sharedCellStyle`, plages de cellules).
- Sélection : sur un tableau déjà seul sélectionné, un clic sélectionne une cellule, Maj+clic étend en rectangle (Maj+clic suit le lien du tableau seulement sans sélection de cellules), des barres au-dessus des colonnes et à gauche des lignes sélectionnent une colonne ou une ligne (Maj étend). Échap, un clic hors du tableau, une autre sélection, un verrou ou une annulation rendent la sélection au tableau entier. Un appui sur une cellule déplace toujours le tableau s'il est glissé.
- Panneau : couleur, taille, gras, italique, souligné et alignements s'appliquent aux cellules sélectionnées, sinon au tableau entier en effaçant le style propre des cellules. « Coller le style » sur un tableau l'efface aussi. La valeur commune s'affiche, aucune si elles diffèrent.
- Barres de sélection centrées à 32 pixels écran du bord (8 d'épaisseur), au-delà des poignées de liaison (jusqu'à 24) ; la tige de rotation d'un tableau passe à 52 pixels. Un test navigateur vérifie l'absence de recouvrement à 100 % et à un autre zoom.
- Retours à la ligne, hauteur de ligne, champ d'édition, rendu, export PNG et export draw.io (`fillColor`, `fontColor`, `fontSize`, `fontStyle`, alignements par cellule) suivent le style réel de chaque cellule. Le redimensionnement par un coin met aussi à l'échelle la taille propre des cellules.
- Validation : 312 tests unitaires et 60 tests navigateur réussis, typage sans erreur. Revues Standards et Spec faites ; le champ d'édition d'une cellule a été corrigé pour suivre son style.
- Limites connues : l'ancre d'un Maj+clic après une barre de ligne ou de colonne est la première cellule de cette ligne ou colonne. Le gras, l'italique et le souligné ne sont proposés que pour les tableaux (le ticket 21 garde la forme Texte).

### Seconde revue (2026-10-28)

- Revues Standards et Spec relancées sur `d122e90`. Corrigé dans `tessello-diagram` (7dc0067) : « Copier le style » d'un tableau emporte son gras, italique et souligné, collés sur les tableaux seulement ; un commentaire CSS de `Canvas.svelte` remis au-dessus de sa règle. Suite complète verte (313 unitaires, 63 navigateur).
- Non corrigé, à juger plus tard : `Canvas.svelte` grossit avec la sélection de cellules (à extraire dans un module) ; petites duplications dans `table.ts` (copie des styles de cellule) et dans `pickCells` ; type `{row, col}` sans nom ; noms `styled()`/`style()` proches de `shared()`/`apply()` dans `ShapePanel` ; boutons gras/italique/souligné sans état « mixte » quand la sélection diffère.
