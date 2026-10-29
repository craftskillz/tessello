# 31 : Supprimer un point de passage d'une flèche

Status: resolved

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`.

## Demande

Sur une flèche, aucun moyen ne permet de supprimer un point de passage ajouté en trop. « Réinitialiser le tracé » les retire tous à la fois.

## État actuel et explication

Lecture du code le 2026-10-29 : `src/view/Canvas.svelte` prévoit bien une suppression au double-clic sur la poignée d'un point de passage (`ondblclick={(event) => removeWaypoint(event, arrow, index)}`), et le Guide la décrit. Pourtant, ce double-clic ne se déclenche jamais :

- `startWaypoint` appelle `capture()`, qui capture le pointeur sur le `svg` du canevas ;
- les événements `click` et `dblclick` qui suivent sont donc reçus par le canevas, comme l'indique déjà le commentaire de `onDoubleClick` ;
- `onDoubleClick` trouve la flèche sous le point (`arrowAt`) et ouvre l'édition de son étiquette au lieu de retirer le point.

Aucun test ne couvre ce geste. Sur une flèche en coude, déplacer un segment fait de chaque coin un point de passage (`shiftSegment`), ce qui multiplie les points à retirer.

## Choix retenus

- Geste : double-clic sur la poignée d'un point de passage, comme dans draw.io et comme le décrit déjà le Guide.
- Correction probable : traiter le cas dans `onDoubleClick`, en cherchant d'abord une poignée de point de passage sous le pointeur d'une flèche sélectionnée, avant les étiquettes et les flèches.

## Critères d'acceptation

- [x] Un double-clic sur un point de passage d'une flèche sélectionnée le retire, sans ouvrir l'édition de l'étiquette ; les autres points restent.
- [x] Un double-clic ailleurs sur la flèche édite toujours son étiquette.
- [x] Le retrait fonctionne pour les tracés droits, courbes et en coude ; une flèche verrouillée ne change pas.
- [x] Une seule étape d'annulation par retrait ; le retrait est enregistré.
- [x] Test navigateur dans `e2e/arrows.test.ts` ; Guide relu.

## Comments

- 2026-10-29 : demande recueillie et cause identifiée à la lecture ; geste choisi avec l'utilisateur : double-clic sur le point. Aucun code du Module modifié.
- 2026-10-29 : réalisé dans `tessello-diagram` (9f985b7). `onDoubleClick` cherche d'abord, pour la flèche sélectionnée et modifiable (`withEnds`), un point de passage sous le pointeur (`waypointAt` dans `src/lib/arrows.ts`, portée `WAYPOINT_REACH` de 6 px à l'écran) et le retire avec `removeWaypoint`, avant les étiquettes et les flèches ; le `ondblclick` mort de la poignée est retiré. Une pression sur un point de passage ne le déplace plus avant `DRAG` (3 px), comme pour les segments : un léger tremblement pendant le double-clic ne crée plus d'étape d'annulation en plus. Guide relu : déjà juste (« Double-click a waypoint to remove it »). Tests : unitaire de `waypointAt` ; deux tests navigateur dans `e2e/arrows.test.ts` (tracé droit avec double-clic tremblé, une annulation et édition de l'étiquette ailleurs sur la ligne ; tracé en coude). Suite complète verte (342 unitaires, 69 navigateur), typage sans erreur.
- 2026-10-29 : relecture à deux axes (Standards, Spec). Corrigé : la constante `HANDLE` renommée `WAYPOINT_REACH` ; le seuil `DRAG` sur la poignée d'un point de passage, vérifié rouge puis vert. Reste ouvert : pas de test navigateur dédié au tracé courbe ni à la flèche verrouillée ; le code ne dépend pas du tracé (positions stockées des points) et `withEnds` exclut les flèches verrouillées.
