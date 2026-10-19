# 09: Éditeur de formes et formes personnalisées

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`. Rétrodoc de l'écran : `features/diagrams/shape-editor.md`.

**What to build:** Un second écran dans la Vue, l'éditeur de formes, pour créer des bibliothèques de formes à partir d'images, avec leurs points d'attache. Une palette en bas du canevas les rend disponibles dans les diagrammes. L'Utilisateur a jugé ces formes et leurs points d'attache « cool » et fiables : il faut garder leur comportement et corriger Q-008 à Q-012.

**Blocked by:** 03 (Connexions), 08 (Images)

**Status:** ready-for-agent

### Éditeur

- [ ] Le bouton « Shapes » de la barre d'outils ouvre l'éditeur, et « ← Back to diagram » ramène au diagramme ouvert. La navigation reste interne à la Vue, sans historique du navigateur.
- [ ] Bibliothèques : sélecteur, « + » pour créer (« New library »), renommage (un nom vide garde l'ancien). Il n'y a pas de suppression de bibliothèque.
- [ ] Forme :
  - nom (« New shape » par défaut, « Untitled shape » si vide, 120 caractères au plus) ;
  - image (rangée comme au ticket 08) ;
  - largeur et hauteur, de 16 à 1200 (65 par défaut) ;
  - placement du texte (dessous, dessus, à droite, à gauche, centré) ;
  - « Show in diagram palette ».
- [ ] Points d'attache :
  - un clic sur l'aperçu ajoute un point, que l'on peut glisser, renommer ou retirer ;
  - « Use 8 default anchors » remet les 8 points par défaut ;
  - « Clear anchors » signifie **aucun point** : les flèches ne s'attachent alors qu'en automatique (Q-012) ;
  - les identifiants en double sont rendus uniques automatiquement.
- [ ] Enregistrement automatique dans la clé `shapes`, comme pour les diagrammes, avec le même indicateur (Q-008, Q-009). Une forme sans image ne peut pas être enregistrée, et un message l'indique.
- [ ] La suppression d'une forme demande une confirmation, qui indique combien de diagrammes s'en servent (Q-010).

### Dans les diagrammes

- [ ] Une palette de vignettes en bas du canevas présente les formes visibles. Le survol affiche « bibliothèque · forme », et une palette vide est masquée.
- [ ] Une forme personnalisée est posée à **ses** dimensions et avec son nom comme texte (Q-016). Son texte se place selon le placement choisi, qui peut être changé pour chaque instance.
- [ ] Ses points d'attache sont ceux de sa définition, et ils suivent la rotation et le redimensionnement. Une modification de la définition se répercute sur les instances existantes.
- [ ] Une forme dont la définition a été supprimée s'affiche comme un cadre en pointillé portant son nom, et ses flèches restent attachées.

### Tests

- [ ] Tests unitaires : nettoyage d'une bibliothèque lue (bornes, identifiants uniques) et points d'attache d'une forme personnalisée en rotation.
- [ ] Test navigateur : créer une bibliothèque et une forme avec deux points d'attache, la poser dans un diagramme, y attacher une flèche au second point, puis masquer la forme de la palette ; l'instance existante reste intacte.
