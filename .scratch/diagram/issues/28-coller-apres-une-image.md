# 28 : Le collage reprend une ancienne image au lieu des formes copiées

Status: ready-for-agent

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`.

## Demande

Après avoir collé une image du presse-papiers dans un diagramme, il n'est plus possible de copier-coller des parties du diagramme : chaque Ctrl/Cmd+V recolle l'ancienne image.

## État actuel et explication

Lecture du code le 2026-10-29, dans `src/view/Canvas.svelte` :

- Ctrl/Cmd+C (`onKeyDown`) range la sélection dans `ui.clip`, interne à la Vue, sans rien écrire dans le presse-papiers du système.
- Ctrl/Cmd+V (`onPaste`) regarde d'abord le presse-papiers du système. S'il contient une image, il l'insère et ignore `ui.clip`.

L'image copiée hors de l'application reste dans le presse-papiers du système, puisque la copie interne ne la remplace pas. Elle passe donc devant toute copie faite ensuite dans le diagramme.

## Proposition de périmètre

La dernière copie l'emporte, d'où qu'elle vienne. Sur l'événement `copy` d'une copie interne, écrire dans le presse-papiers du système un marqueur du Module (et un texte simple), ce qui en efface l'image. Au collage :

- si le presse-papiers porte ce marqueur, coller `ui.clip` ;
- s'il porte une image, l'insérer ;
- sinon, coller `ui.clip` comme aujourd'hui.

Une image copiée hors de l'application après une copie interne reste donc collée comme image.

## Critères d'acceptation

- [ ] Image collée, puis formes copiées dans le diagramme : Ctrl/Cmd+V colle les formes, dans ce diagramme comme dans un autre.
- [ ] Formes copiées, puis image copiée hors de l'application : Ctrl/Cmd+V colle l'image.
- [ ] Les collages successifs gardent leur décalage de 40 unités ; Ctrl/Cmd+Alt+C/V (style) n'est pas affecté.
- [ ] La copie dans un champ de texte ou pendant l'édition d'un texte garde le comportement natif.
- [ ] Test navigateur reproduisant la séquence image → copie interne → collage.

## Comments

- 2026-10-29 : demande recueillie et cause identifiée à la lecture ; aucun code du Module modifié.
