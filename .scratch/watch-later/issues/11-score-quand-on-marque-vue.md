# 11: Donner un score quand on marque une vidéo comme vue

Spec parente : `.scratch/watch-later/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Marquer une vidéo comme vue ouvre une boîte de dialogue où l'on donne un score de 0 à 5, obligatoire, et où l'on peut écrire ou corriger la note. Le score est affiché sur la carte et se modifie dans le panneau de détail.

**Blocked by:** aucun

**Status:** resolved

### Modèle

- [x] Une vidéo vue a un `score?` : un entier de 0 à 5. Une vidéo à voir n'en a pas. Les vidéos marquées vues avant ce ticket n'ont pas de score, et restent valides sans migration.
- [x] La lecture du stockage ignore un score qui n'est pas un entier de 0 à 5, ou qui est posé sur une vidéo à voir.
- [x] Repasser une vidéo à « À voir » oublie son score, comme `watchedAt`.
- [x] La note reste le champ `note` existant : il n'y a qu'une note par vidéo.

### Marquer comme vue

- [x] Le bouton « Vue » d'une carte à voir, et « Marquer comme vue » du panneau de détail, ouvrent une boîte de dialogue du Module (pas de `prompt`, §4) : le titre de la vidéo, un choix de score de 0 à 5 (un groupe de boutons radio, utilisable au clavier), et le champ de note, rempli avec la note actuelle.
- [x] « Marquer comme vue » reste désactivé tant qu'aucun score n'est choisi. Il enregistre en une fois le statut, `watchedAt`, le score et la note (mêmes règles que la note du panneau : espaces retirés, 2 000 caractères au plus).
- [x] « Annuler », Échap ou un clic hors de la boîte ne change rien.
- [x] Quand « Cacher les vues » est actif, le message « Marquée comme vue · Annuler » apparaît comme aujourd'hui. « Annuler » rend la vidéo telle qu'elle était avant la boîte de dialogue, note comprise.
- [x] Repasser une vidéo vue à « À voir » (bouton de la carte ou du panneau) n'ouvre pas de boîte de dialogue.

### Afficher et modifier

- [x] Une carte vue affiche son score (par exemple ★★★☆☆), avec un nom accessible « Score : 3 sur 5 ». Une vidéo vue sans score n'affiche rien.
- [x] Le panneau de détail d'une vidéo vue montre son score et permet de le changer (même choix de 0 à 5), enregistré aussitôt. Une vidéo vue sans score peut en recevoir un.
- [x] Les catalogues anglais et français ont les nouveaux textes.

### Tests

- [x] Tests unitaires : marquer vue avec un score et une note, repasser à voir oublie le score, lecture d'un score invalide ou posé sur une vidéo à voir, changer le score d'une vidéo vue.
- [x] Test navigateur : « Vue » ouvre la boîte, le bouton reste désactivé sans score, choisir 4 et écrire une note marque la vidéo vue, le score et la note survivent au rechargement ; « Annuler » ne change rien.

## Comments

### Implémentation (2026-10-23)

- Le bouton « Vue » et le panneau de détail ouvrent une boîte de dialogue avec un score de 0 à 5 obligatoire et la note existante. Annuler, Échap et le fond abandonnent le brouillon sans écriture.
- Le statut, la date, le score et la note sont enregistrés ensemble. L'annulation du message restaure le statut et la note précédents, sans écraser les autres modifications de la vidéo.
- Le score est visible sur la carte, nommé pour un lecteur d'écran et modifiable dans le détail. Repasser à voir oublie le score et la date ; les anciennes vidéos vues sans score restent lisibles. Les textes existent en anglais et en français.
- Validation : 66 tests unitaires Watch Later réussis ; 17 tests navigateur Watch Later réussis (16 dans la première passe, puis le test restant après correction de son clic sur le fond, intercepté par le Lanceur de l'Hôte) ; construction réussie ; Validateur sans erreur ni avertissement.
- La vérification TypeScript globale (`npm run typecheck`) réussit également après les modifications concurrentes de Skills Library.
- Le classement par score et la mise à jour du Guide restent aux tickets 12 et 13.
