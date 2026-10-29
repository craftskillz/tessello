# 28 : Le collage reprend une ancienne image au lieu des formes copiées

Status: resolved

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

- [x] Image collée, puis formes copiées dans le diagramme : Ctrl/Cmd+V colle les formes, dans ce diagramme comme dans un autre.
- [x] Formes copiées, puis image copiée hors de l'application : Ctrl/Cmd+V colle l'image.
- [x] Les collages successifs gardent leur décalage de 40 unités ; Ctrl/Cmd+Alt+C/V (style) n'est pas affecté.
- [x] La copie dans un champ de texte ou pendant l'édition d'un texte garde le comportement natif.
- [x] Test navigateur reproduisant la séquence image → copie interne → collage.

## Comments

- 2026-10-29 : demande recueillie et cause identifiée à la lecture ; aucun code du Module modifié.
- 2026-10-29 : réalisé dans `tessello-diagram` (00cb231). `src/lib/clipboard.ts` gagne `CLIP_TYPE` (`application/x-tessello-diagram`), `markClipboard` (le marqueur, et les textes des formes copiées en `text/plain`) et `imageToPaste` (aucune image quand le marqueur est présent). Dans `Canvas.svelte`, un `onCopy` sur `window` marque le presse-papiers lors d'une copie interne, hors champ de texte (`typing`). Ctrl/Cmd+C garde la copie dans `ui.clip` sans `preventDefault`, pour que l'événement `copy` natif suive. `onPaste` passe par `imageToPaste`. Tests unitaires dans `test/clipboard.test.ts`. Test navigateur dans `e2e/images.test.ts` : image collée → copie interne → collage des formes, puis image copiée ailleurs → collage de l'image. Guide : une phrase sur « la dernière copie l'emporte ». Suite complète verte (323 unitaires, 66 navigateur).
- 2026-10-29 : relecture à deux axes (Standards, Spec). Corrigé : `copySelection` rend la copie, ce qui supprime `ui.clip!` ; le test navigateur couvre aussi l'image copiée après une copie interne. Reste ouvert : le test navigateur déclenche un événement `copy` synthétique, sans vrai Ctrl+C ni vrai presse-papiers ; il ne prouve donc pas que le navigateur efface l'image du presse-papiers du système. Le collage dans un autre diagramme, le décalage de 40 et le style ne sont couverts que par les tests existants. Si l'événement `copy` natif ne se déclenche pas, `ui.clip` est rempli mais le presse-papiers garde l'image, et l'ancien défaut revient dans ce cas.
