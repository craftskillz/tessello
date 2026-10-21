# 14: Export PNG et draw.io

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** L'Utilisateur télécharge la sélection ou le diagramme en PNG, et le diagramme en `.drawio` (parcours 12 et 13, sans les parties propres à living-documentation).

**Blocked by:** 04 (Tracés), 09 (Formes personnalisées), 13 (Hôte : téléchargements)

**Status:** ready-for-human

### PNG

- [x] « Export PNG » (Ctrl/Cmd+Maj+E) produit l'image de la sélection, ou de tout le diagramme si rien n'est sélectionné. Le rendu se fait **à partir du modèle**, et non par une capture de la vue : le contenu hors de l'écran est inclus (Q-017). Les flèches entre formes sélectionnées sont incluses.
- [x] Le fond suit le thème courant, avec l'option « transparent ». L'échelle est de 2× pour la netteté. Le nom de fichier vient du titre nettoyé.

### draw.io

- [x] « Export as drawio (.drawio) » télécharge un fichier qui contient :
  - les formes (styles draw.io équivalents) et leurs textes ;
  - les groupes ;
  - les flèches, avec leurs points d'attache (`exitX`/`entryX`…) et leurs points de passage, dans le style `edgeStyle` correspondant au tracé (`orthogonalEdgeStyle` pour le coudé, `curved=1` pour le courbe) ;
  - les étiquettes ;
  - les images, intégrées en data URL, ce qui les rend disponibles hors ligne puisqu'elles sont déjà dans le stockage.
- [x] Les pertes connues sont signalées dans un message, comme dans l'original : les rotations d'étiquette indépendantes, que draw.io ne sait pas représenter.
- [ ] Le fichier s'ouvre dans draw.io (app.diagrams.net) avec le même aspect. C'est une vérification manuelle, faite une fois et notée dans les commentaires du ticket.

### Tests

- [x] Tests unitaires : conversion d'un diagramme qui contient chaque type d'élément en XML draw.io (formes, points d'attache, points de passage, groupes, image intégrée).
- [x] Tests navigateur : téléchargement d'un PNG dont les octets commencent par la signature PNG, puis téléchargement d'un `.drawio` analysable qui contient le bon nombre de cellules.

## Comments

- Le PNG est dessiné à part (`src/view/Drawing.svelte`), par les mêmes composants que le canevas : `ShapeView` et `ArrowView`, ce dernier extrait de `Canvas.svelte`. Les styles calculés par la page sont recopiés sur chaque élément du SVG, puisqu'une image ne voit pas les feuilles de style de la page, puis le SVG est dessiné sur un canvas à l'échelle 2×. Il est cadré sur ce qu'il dessine, avec une marge de 20. Un très grand diagramme est réduit pour rester sous 16 000 px de côté.
- La sélection exportée comprend les formes sélectionnées, les flèches sélectionnées, et les flèches dont les deux bouts sont dans la sélection (même règle que Ctrl+C). Les flèches sont tracées parmi toutes les formes du diagramme, donc sur les mêmes chemins que dans le canevas.
- draw.io : les images sont écrites `data:image/png,…` dans le style. `mxGraph.postProcessCellStyle` (draw.io) remet `;base64,` après la virgule. La forme `data:image/png,base64,…` de l'original donnerait donc des données corrompues.
- draw.io place l'étiquette d'une flèche de −1 à 1 le long de la ligne, et la décale dans le sens antihoraire (`mxGraphView.getPoint`). Le décalage du modèle va dans le sens horaire, donc il est inversé. Une étiquette de flèche tournée garde sa rotation (cellule enfant `edgeLabel`) : seules les rotations de texte de forme sont perdues et comptées.
- Avec `curved=1`, draw.io prend chaque point comme point de contrôle d'une pièce quadratique (`mxPolyline.paintCurvedLine`) : la courbe ne passe pas par ce point. Une courbe sans point de passage reçoit donc le point `2·milieu − milieu de la corde`. Ainsi, le milieu de l'arc tracé par draw.io est celui de la courbe du canevas. Perte connue : une courbe **avec** points de passage est plus plate dans draw.io, puisqu'elle n'y passe plus par ses points.
- Les étiquettes des flèches ont un fond blanc (`labelBackgroundColor`) qui cache la ligne, comme dans le canevas. Dans un PNG transparent, ce fond reste peint (couleur du thème) sous l'étiquette, comme dans le canevas.
- Les couleurs sont celles de la variante claire de la palette. Les liens des formes ne sont pas exportés : le ticket ne les demande pas.
- **Reste à faire, à la main** : ouvrir un `.drawio` exporté dans app.diagrams.net et noter ici le résultat. Ce n'est pas encore fait.

