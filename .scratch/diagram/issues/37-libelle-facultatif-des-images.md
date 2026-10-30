# 37 : Choisir, à l'insertion d'une image, de lui donner un libellé ou non

Status: resolved

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`. Touche l'insertion d'images du ticket 08.

## Demande

Quand on colle une image, elle est toujours groupée avec un libellé placé en dessous. On ne veut pas toujours de libellé. Au collage, le Module doit demander :

- soit d'insérer l'image groupée avec un libellé, en saisissant ce libellé ;
- soit de l'insérer seule, sans libellé ni groupe.

## État actuel et explication

Lecture du code le 2026-10-30 :

- `onPaste` (`src/view/Canvas.svelte`) insère l'image du presse-papiers au centre de la vue avec le libellé `captionOf("")`, c'est-à-dire « image ».
- `onPicked`, l'outil Image avec choix d'un fichier, fait de même avec le nom du fichier sans son extension.
- Les deux passent par `insertImage` (`src/lib/store.svelte.ts`) puis `placeImage` (`src/lib/images.ts`). `placeImage` crée toujours deux formes : l'image et une forme Texte placée `CAPTION_GAP` plus bas, dans un même groupe. Il renvoie les deux identifiants, qui deviennent la sélection.
- Rien ne permet aujourd'hui d'insérer une image seule : il faut dégrouper puis supprimer le libellé.
- `ConfirmDialog.svelte` et `Modal.svelte` donnent déjà un modèle de boîte de dialogue.

## Choix retenus

- **Boîte de dialogue** à chaque insertion d'image. Elle contient :
  - un champ « Libellé », prérempli (« image » pour un collage, le nom du fichier pour l'outil Image) et sélectionné, pour être remplacé d'une frappe ;
  - un bouton **« Avec libellé »**, bouton par défaut sur Entrée : image et libellé groupés, comme aujourd'hui, avec le texte saisi ;
  - un bouton **« Sans libellé »** : l'image seule, hors de tout groupe ;
  - Échap ou **« Annuler »** : rien n'est inséré.
  Un libellé vide revient à « Sans libellé ».
- **Portée** : le collage et l'outil Image, pour que les deux insertions se comportent de la même façon. L'import depuis living-documentation (ticket 15) n'est pas concerné.
- **Ordre** : la boîte s'ouvre avant d'écrire l'image dans le stockage, et une annulation n'écrit rien. Une image refusée (format, taille) affiche son message comme aujourd'hui.
- **Modèle** : `placeImage` reçoit un `caption` facultatif. Sans lui, il ne crée que l'image, sans `groupId`, et renvoie un seul identifiant. Une seule étape d'annulation dans les deux cas.
- Pas d'option « ne plus demander » dans un premier temps ; on pourra en ajouter une plus tard dans les Valeurs par défaut (ticket 11).

## Critères d'acceptation

- [x] Coller une image ou en choisir une avec l'outil Image ouvre la boîte, avec le libellé prérempli et sélectionné.
- [x] « Avec libellé » (ou Entrée) insère l'image et le libellé saisi, groupés, et les sélectionne.
- [x] « Sans libellé », ou un libellé vide, insère l'image seule, sans groupe, et la sélectionne.
- [x] Échap ou « Annuler » n'insère rien et n'écrit rien dans le stockage.
- [x] Annuler/rétablir annule l'insertion en une étape ; sauvegarde/rechargement conservent l'image seule.
- [x] Interface traduite, Guide mis à jour, tests unitaires de `placeImage` avec et sans libellé, test navigateur du collage dans les deux cas et de l'annulation.

## Comments

- 2026-10-30 : demande recueillie ; aucun code du Module modifié. À trancher avec l'utilisateur : étendre ou non la question à l'outil Image, ajouter ou non une option « ne plus demander ».
- 2026-10-30 : tranché avec l'utilisateur : choix proposés retenus, la boîte vaut pour le collage et pour l'outil Image, sans option « ne plus demander ».
- 2026-10-30 : réalisé dans `tessello-diagram` (71aa3ca). `placeImage` prend un `caption` facultatif : absent ou vide, l'image est seule, sans groupe, et un seul identifiant est renvoyé. Nouveau `ImageCaptionDialog.svelte` sur `Modal.svelte`, qui reçoit un troisième bouton facultatif (`secondaryLabel`/`onSecondary`). `Canvas` ouvre la boîte avant `insertImage`, donc avant toute écriture ; un second collage d'image est ignoré tant qu'elle est ouverte. Interface traduite, Guide mis à jour. Tests unitaires de `placeImage` avec et sans libellé ; tests navigateur du collage avec libellé saisi, sans libellé (annuler/rétablir, rechargement) et d'Échap avec l'outil Image.
- 2026-10-30 : relecture à deux axes. Standards : aucune violation ; jugements : la paire `secondaryLabel`/`onSecondary` pourrait être un seul objet. Spec : Échap n'est testé qu'avec l'outil Image, pas au collage ; annuler/rétablir n'est testé que sans libellé (le chemin avec libellé n'a pas changé) ; « Avec libellé » avec un champ vide insère l'image seule, sans autre retour.
