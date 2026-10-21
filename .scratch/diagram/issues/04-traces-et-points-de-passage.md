# 04: Tracé droit, courbe ou coudé, et points de passage

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** Chaque flèche choisit son tracé : droit, courbe ou coudé. On peut lui ajouter des points de passage pour lui donner des angles. Ce ticket remplace l'interrupteur global courbe/droit de l'original, et répond au manque « on ne peut pas ajouter de points à une flèche ».

**Blocked by:** 03 (Connexions)

**Status:** resolved

- [x] Le panneau de flèche permet de choisir le tracé : **Straight**, **Curved** ou **Elbow**. La valeur par défaut vient des valeurs par défaut (ticket 11) ou est « Straight ». Les diagrammes importés de l'original reprennent leur ancien `edgesStraight` sur chaque flèche. *(Reporté avec l'import, ticket 15 : voir « Limites ».)*
- [x] Une flèche sélectionnée montre une poignée au milieu de chaque segment. La glisser crée un point de passage. Un point de passage se glisse, et un double-clic le retire. « Reset route » les retire tous.
- [x] Un point de passage s'aligne exactement à l'horizontale ou à la verticale de son voisin quand il en est proche.
- [x] Les points de passage ne bougent pas quand une forme se déplace. Seuls les segments d'extrémité suivent.
- [x] Le tracé suit le mode choisi :
  - **Straight** : une ligne brisée qui passe par les points de passage ;
  - **Curved** : une courbe lisse qui passe par eux ;
  - **Elbow** : des segments horizontaux et verticaux calculés automatiquement, qui sortent perpendiculairement au côté de la forme (ou du point d'attache) ; glisser un segment intermédiaire le décale latéralement et crée les points de passage nécessaires.
- [x] Une extrémité automatique vise le point de passage le plus proche, et non l'autre extrémité.
- [x] La zone de clic (ticket 03) suit le tracé, quel que soit le mode.
- [x] Tests unitaires : tracé de chaque mode, avec et sans points de passage ; alignement d'un point de passage ; sortie perpendiculaire d'un tracé coudé.
- [x] Test navigateur : créer un coude par glisser, le retrouver après un rechargement, déplacer la forme d'arrivée, et sélectionner la flèche par un clic sur son dernier segment.

## Comments

### Implémentation (2026-10-21)

- **Tracé** (`src/lib/arrows.ts`) : un `Path` est désormais la suite des points par lesquels passe la flèche (`points`), avec deux points de contrôle par morceau pour une courbe (`controls`). `startOf`, `endOf`, `pointAlong` (à une part de la longueur), `pathData`, `distanceTo`, `headOf` (coupe le dernier morceau) et `pathWithin` suivent ce modèle : la zone de clic, l'étiquette et la sélection rectangle suivent le tracé, quel que soit le mode.
- **`layoutArrows`** :
  - **Straight** : une ligne brisée par les points de passage ;
  - **Curved** : sans point de passage, la courbe du ticket 03 ; avec, une spline de Catmull-Rom passant par eux, qui sort d'un point d'attache dans sa direction ;
  - **Elbow** (`elbowPath`) : chaque extrémité sort perpendiculairement au côté qui fait face au point suivant (un point d'attache de coin prend le côté qui fait face) ; sans point de passage, le tracé tourne à mi-chemin, ou contourne ses deux formes par une voie qui les dégage quand une extrémité tourne le dos à l'autre ou que les deux regardent du même côté ; avec, il passe par eux en segments horizontaux et verticaux, et sort d'un point d'attache par 20 tout droit, puis à côté de sa forme si le point de passage est derrière elle. Une extrémité automatique se met dans l'alignement d'un point de passage que son côté atteint, pour y aller droit.
  - une extrémité automatique vise le point de passage voisin (et l'éventail des points d'attache aussi).
- **`snapWaypoint`** aligne un point de passage sur son voisin (6 px à l'écran) ; **`shiftSegment`** décale latéralement un segment intermédiaire d'un tracé coudé, dont les coins deviennent les points de passage ; **`middlesOf`** place les poignées de segment.
- **Vue** : `ArrowPanel.svelte` porte le choix du tracé (Straight, Curved, Elbow) et « Reset route ». `Canvas.svelte` montre une poignée carrée au milieu de chaque segment et une poignée ronde par point de passage (glisser, double-cliquer pour retirer). Le Guide a une section « Routes and waypoints ».
- **Tests** : `test/arrows.test.ts` (chaque mode avec et sans points de passage, sortie perpendiculaire, écartement de flèches coudées parallèles, points de passage fixes quand une forme bouge, alignement, décalage d'un segment) ; dans `packages/host/e2e/diagram.test.ts`, un test du coude et le test de la courbe, qui choisit maintenant le tracé dans le panneau.

**Choix** :
  - Une flèche qui a des points de passage n'est plus écartée de ses parallèles : elle suit le chemin donné par l'Utilisateur.
  - Les flèches coudées parallèles sont écartées de 24, comme les droites : leurs côtés et leur segment du milieu sont décalés.
  - Sur un tracé coudé, glisser le segment de début ou de fin (ou l'unique segment) ajoute un point de passage, comme sur les autres tracés ; les coins existants deviennent alors des points de passage.
  - Changer de tracé garde les points de passage.
  - Un point de passage s'aligne sur le point d'attache, le centre de la forme ou le point libre de l'extrémité voisine.
  - Une poignée de segment ne fait rien tant que le pointeur n'a pas bougé de plus de 3 px : un simple clic n'ajoute pas de point de passage.
  - Décaler un segment coudé fige tous les coins du tracé en points de passage, et pas seulement ceux du segment : le tracé garde ainsi exactement la forme vue pendant le glisser. « Reset route » rend le tracé automatique.

**Limites** :
  - `edgesStraight` : il n'y a pas encore d'import de l'original. La conversion de `edgesStraight` en tracé de chaque flèche est faite avec l'import (ticket 15). Le tracé par défaut est « Straight » jusqu'au ticket 11.
  - Le tracé coudé ne contourne pas les autres formes (hors périmètre de la spec). Avec des points de passage, le segment qui rejoint une extrémité automatique peut traverser une autre forme, et même la forme de départ si l'Utilisateur a posé le point de passage de l'autre côté. Un point de passage posé à l'intérieur d'une forme fait aussi entrer le trait.
  - Pour une forme tournée, le côté de sortie d'une flèche coudée est pris sur la boîte qui contient la forme tournée.
