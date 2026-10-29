# 31 : Supprimer un point de passage d'une flèche

Status: ready-for-agent

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

- [ ] Un double-clic sur un point de passage d'une flèche sélectionnée le retire, sans ouvrir l'édition de l'étiquette ; les autres points restent.
- [ ] Un double-clic ailleurs sur la flèche édite toujours son étiquette.
- [ ] Le retrait fonctionne pour les tracés droits, courbes et en coude ; une flèche verrouillée ne change pas.
- [ ] Une seule étape d'annulation par retrait ; le retrait est enregistré.
- [ ] Test navigateur dans `e2e/arrows.test.ts` ; Guide relu.

## Comments

- 2026-10-29 : demande recueillie et cause identifiée à la lecture ; geste choisi avec l'utilisateur : double-clic sur le point. Aucun code du Module modifié.
