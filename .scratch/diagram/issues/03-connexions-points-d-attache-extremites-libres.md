# 03: Connexions : points d'attache, extrémités libres, flèches distinctes et toujours cliquables

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** Le cœur de la refonte, qui corrige les trois défauts constatés dans l'original (spec, « Problem Statement » et « Further Notes »). Une flèche se trace d'un seul geste n'importe où, et chaque extrémité s'attache à un point d'attache, au contour de la forme, ou reste libre. Les flèches parallèles sont écartées, et un clic sur le trait visible sélectionne toujours la flèche.

**Blocked by:** 02 (Toutes les formes intégrées)

**Status:** ready-for-agent

### Tracer

- [ ] Outil Flèche (F) : appuyer, glisser, relâcher, depuis n'importe où. Pendant le geste, la forme survolée affiche ses points d'attache, et le point visé est mis en évidence.
- [ ] Au relâchement, chaque extrémité est :
  - **attachée à un point** si elle est relâchée sur un point mis en évidence ;
  - **automatique** si elle est relâchée ailleurs sur la forme ;
  - **libre** sinon.
- [ ] Maj contraint l'angle par pas de 45°. Un simple clic sans glisser ne crée rien.
- [ ] Les formes intégrées ont 8 points d'attache (N, NE, E, SE, S, SW, W, NW), posés sur leur contour réel. Les points suivent le déplacement, le redimensionnement et la rotation de la forme.
- [ ] On ne peut pas partir d'une forme verrouillée. Relâcher sur une forme verrouillée donne une extrémité libre.

### Modifier

- [ ] Une flèche sélectionnée montre des poignées à ses deux extrémités. Glisser une poignée la rattache à un autre point, à une autre forme, ou la libère. Les mêmes règles d'aimantation s'appliquent.
- [ ] Glisser le corps d'une flèche dont les deux extrémités sont libres la déplace en entier. Une flèche attachée ne se déplace pas par son corps.
- [ ] « Detach ends » rend automatiques les extrémités attachées à un point (remplace « Clear attachment points »).
- [ ] Supprimer une forme libère les extrémités qui y étaient attachées, qui restent en place. Ctrl/Cmd+Suppr supprime la forme et ses flèches.

### Défauts de l'original (non-régression)

- [ ] **Défaut 1, flèches superposées.** Les flèches qui relient les mêmes deux formes avec des extrémités automatiques sont écartées : décalage parallèle si elles sont droites, courbures opposées si elles sont courbes. Les flèches qui partagent un même point d'attache s'écartent légèrement en éventail. Chaque étiquette reste visible.
- [ ] **Défaut 2, flèche impossible à sélectionner.** Chaque flèche a une zone de clic invisible d'environ 10 px de large à l'écran, quel que soit le zoom. Cette zone est calculée à partir du **même tracé** que le trait dessiné. Quand une flèche et une forme se chevauchent, la flèche l'emporte près de son trait.
- [ ] **Défaut 3, flèche libre.** Un glisser dans le vide avec l'outil Flèche crée une flèche libre.
- [ ] La sélection rectangle (glisser sur le vide avec l'outil Sélection) prend les formes et les flèches entièrement contenues.

### Tests

- [ ] Tests unitaires :
  - position des points d'attache, y compris en rotation ;
  - choix de l'extrémité au relâchement (point, automatique ou libre) ;
  - écartement de 2 et 3 flèches parallèles ;
  - distance d'un point à un tracé droit et courbe.
- [ ] Tests navigateur, qui reprennent la reproduction de la spec :
  - trois flèches A→B, A→B et B→A sont toutes visibles et cliquables une à une ;
  - une flèche courbe A.N → B.N est sélectionnée par un clic au milieu et vers la fin de son trait visible ;
  - un glisser dans le vide crée une flèche libre ;
  - une extrémité attachée au point NE suit la forme tournée de 90° ;
  - supprimer une forme libère la flèche.
