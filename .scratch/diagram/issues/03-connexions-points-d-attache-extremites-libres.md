# 03: Connexions : points d'attache, extrémités libres, flèches distinctes et toujours cliquables

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** Le cœur de la refonte, qui corrige les trois défauts constatés dans l'original (spec, « Problem Statement » et « Further Notes »). Une flèche se trace d'un seul geste n'importe où, et chaque extrémité s'attache à un point d'attache, au contour de la forme, ou reste libre. Les flèches parallèles sont écartées, et un clic sur le trait visible sélectionne toujours la flèche.

**Blocked by:** 02 (Toutes les formes intégrées)

**Status:** resolved

### Tracer

- [x] Outil Flèche (F) : appuyer, glisser, relâcher, depuis n'importe où. Pendant le geste, la forme survolée affiche ses points d'attache, et le point visé est mis en évidence.
- [x] Au relâchement, chaque extrémité est :
  - **attachée à un point** si elle est relâchée sur un point mis en évidence ;
  - **automatique** si elle est relâchée ailleurs sur la forme ;
  - **libre** sinon.
- [x] Maj contraint l'angle par pas de 45°. Un simple clic sans glisser ne crée rien.
- [x] Les formes intégrées ont 8 points d'attache (N, NE, E, SE, S, SW, W, NW), posés sur leur contour réel. Les points suivent le déplacement, le redimensionnement et la rotation de la forme.
- [x] On ne peut pas partir d'une forme verrouillée. Relâcher sur une forme verrouillée donne une extrémité libre.

### Modifier

- [x] Une flèche sélectionnée montre des poignées à ses deux extrémités. Glisser une poignée la rattache à un autre point, à une autre forme, ou la libère. Les mêmes règles d'aimantation s'appliquent.
- [x] Glisser le corps d'une flèche dont les deux extrémités sont libres la déplace en entier. Une flèche attachée ne se déplace pas par son corps.
- [x] « Detach ends » rend automatiques les extrémités attachées à un point (remplace « Clear attachment points »).
- [x] Supprimer une forme libère les extrémités qui y étaient attachées, qui restent en place. Ctrl/Cmd+Suppr supprime la forme et ses flèches.

### Défauts de l'original (non-régression)

- [x] **Défaut 1, flèches superposées.** Les flèches qui relient les mêmes deux formes avec des extrémités automatiques sont écartées : décalage parallèle si elles sont droites, courbures opposées si elles sont courbes. Les flèches qui partagent un même point d'attache s'écartent légèrement en éventail. Chaque étiquette reste visible.
- [x] **Défaut 2, flèche impossible à sélectionner.** Chaque flèche a une zone de clic invisible d'environ 10 px de large à l'écran, quel que soit le zoom. Cette zone est calculée à partir du **même tracé** que le trait dessiné. Quand une flèche et une forme se chevauchent, la flèche l'emporte près de son trait.
- [x] **Défaut 3, flèche libre.** Un glisser dans le vide avec l'outil Flèche crée une flèche libre.
- [x] La sélection rectangle (glisser sur le vide avec l'outil Sélection) prend les formes et les flèches entièrement contenues.

### Tests

- [x] Tests unitaires :
  - position des points d'attache, y compris en rotation ;
  - choix de l'extrémité au relâchement (point, automatique ou libre) ;
  - écartement de 2 et 3 flèches parallèles ;
  - distance d'un point à un tracé droit et courbe.
- [x] Tests navigateur, qui reprennent la reproduction de la spec :
  - trois flèches A→B, A→B et B→A sont toutes visibles et cliquables une à une ;
  - une flèche courbe A.N → B.N est sélectionnée par un clic au milieu et vers la fin de son trait visible ;
  - un glisser dans le vide crée une flèche libre ;
  - une extrémité attachée au point NE suit la forme tournée de 90° ;
  - supprimer une forme libère la flèche.

## Comments

### Implémentation (2026-10-20)

- **Points d'attache** (`src/lib/geometry.ts`) : `portsOf`, `portPoint` et `portDirection`. Les 8 points sont posés sur le contour réel (coins du rectangle, circonférence de l'ellipse et du cercle, jonction des couvercles de la base de données), rotation comprise. `exitPoint` trouve où une droite issue d'un point intérieur quitte le contour (formes convexes, par dichotomie) ; `boxWithin` sert à la sélection rectangle.
- **Flèches** (`src/lib/arrows.ts`, fonctions pures) :
  - `endAt` choisit l'extrémité au relâchement : point d'attache à portée (8 px à l'écran), automatique sur la forme, libre ailleurs ou sur une forme verrouillée ;
  - `layoutArrows` calcule le tracé de toutes les flèches à la fois : décalage parallèle de 24 entre les flèches droites qui relient les mêmes formes en automatique, courbures opposées pour les courbes, éventail de 8 le long du contour pour les extrémités qui partagent un point, ramenées sur le contour pour un point de coin (dans l'ordre de leur direction, pour qu'elles ne se croisent pas) ;
  - `distanceTo` et `arrowAt` font la zone de clic, à partir du même tracé (une courbe est mesurée en 64 segments) ; `headOf` coupe la courbe à la base de la pointe ;
  - `constrainAngle` (Maj, pas de 45°) et `isDrawable` (pas de flèche d'une forme vers elle-même, sauf entre deux de ses points).
- **Modèle** (`src/lib/diagram.ts`) : `removeShape` libère les extrémités là où elles étaient dessinées, décalage compris, ou supprime les flèches avec `withArrows` ; `detachEnds`. `arrowEnds` est remplacé par `layoutArrows`.
- **Vue** : `Canvas.svelte` trouve l'élément cliqué par le modèle (la flèche l'emporte sur la forme à moins de 5 px à l'écran), et gère le tracé d'un seul geste, les poignées d'extrémité, le déplacement d'une flèche libre par son corps et la sélection rectangle. `ArrowPanel.svelte` porte « Detach ends ». Le Guide a une section « Arrows ».
- **Tests** : `test/arrows.test.ts`, `test/geometry.test.ts` (points d'attache, `boxWithin`), `test/diagram.test.ts` (suppression, détachement), et cinq tests dans `packages/host/e2e/diagram.test.ts` qui reprennent les reproductions de la spec.

**Choix** :
  - Le tracé courbe et les étiquettes n'ont pas encore de réglage dans la Vue (tickets 04 et 05). Les tests navigateur les posent en modifiant le fichier du diagramme, comme le ferait l'Utilisateur, puis rechargent. L'étiquette est dessinée au milieu du tracé, sur un halo du fond, pour que chaque étiquette reste visible.
  - Une courbe seule s'écarte de sa corde de 20 % de sa longueur. Deux courbes parallèles s'écartent de ±15 %, trois de −30 %, 0 et +30 % : celle du milieu est droite.
  - Une extrémité automatique d'une courbe vise son point de contrôle, et non l'autre extrémité : la courbe sort de la forme dans sa propre direction, sans y entrer.
  - Les poignées d'extrémité ne s'affichent qu'avec l'outil Sélection. Avec l'outil Flèche, un appui sur l'extrémité d'une flèche sélectionnée commence une nouvelle flèche.
  - Maj contraint aussi par pas de 45° une poignée d'extrémité glissée, autour de l'autre extrémité.
  - Ctrl/Cmd+clic ajoute aussi une flèche à la sélection, ce qui lève une limite du ticket 02.
  - Un double-clic sur une flèche ne crée pas de forme. L'édition de l'étiquette vient avec le ticket 05.

**Limites** :
  - Le verrouillage n'a pas encore de bouton (ticket 06). Les règles sur les formes verrouillées ne sont donc testées qu'en tests unitaires.
  - Les points de passage stockés sont déplacés avec une flèche libre, mais pas encore dessinés (ticket 04). Un tracé « elbow » est dessiné droit.
  - Les pointes au début ou aux deux bouts restent au ticket 05 : la pointe est toujours à la fin.
  - Les noms de points (N, NE…) apparaissent tels quels dans le nom accessible d'une flèche, en anglais comme en français.
  - Une flèche courbe dont une forme est supprimée garde ses extrémités, mais sa courbure est recalculée pour des extrémités libres.
