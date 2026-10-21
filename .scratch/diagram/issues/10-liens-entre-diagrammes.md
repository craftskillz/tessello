# 10: Liens vers une URL ou un autre diagramme, et retour

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** Une forme peut porter un lien vers une URL ou vers un autre diagramme (parcours 7). On suit le lien, puis un bouton ramène au diagramme d'origine.

**Blocked by:** 02 (Toutes les formes intégrées)

**Status:** resolved

- [x] Panneau « Link on this shape », pour une seule forme sélectionnée, avec trois choix :
  - **External URL**, à laquelle on ajoute `https://` sans schéma, comme dans le Survival Kit (seuls `http(s)`, `mailto:` et `tel:` sont gardés tels quels) ;
  - **Existing diagram**, dans une liste qui exclut le diagramme courant ;
  - **New diagram**, avec un titre obligatoire, et un message si ce titre est vide.
- [x] Un indicateur de lien est visible sur la forme. Maj+clic suit le lien : une URL s'ouvre dans un nouvel onglet, et un diagramme s'ouvre dans la Vue.
- [x] Suivre un lien vers un diagramme empile le diagramme d'origine. Un bouton **← Back to "<titre>"** en haut du canevas y ramène, et la pile se vide quand on ouvre un diagramme depuis la liste.
- [x] Un lien vers un diagramme supprimé affiche « Diagram not found » et propose de retirer le lien.
- [x] Le lien est enregistré automatiquement, comme toute modification, ce qui règle Q-014 pour les liens.
- [x] Tests navigateur : lier une forme à un nouveau diagramme, le suivre, revenir ; supprimer la cible et constater le message.

## Comments

**Implémentation (2026-10-21).**

- Un lien est rangé dans `link` de la forme, sous la forme `{ type: "url" | "diagram", value }`, comme le `nodeLink` de living-documentation, pour l'import du ticket 15. À la lecture, une URL reçoit `https://` selon la même règle que le Survival Kit, pour qu'un fichier modifié à la main ne puisse pas lancer de script.
- Le panneau s'ouvre par « Link… » dans le panneau d'une seule forme. Une URL vide retire le lien, comme dans l'original. « Existing diagram » sans choix possible affiche aussi un message.
- Le nouveau diagramme est écrit avant la forme qui y mène. Si son écriture échoue, il est retiré de la liste et la forme n'est pas liée.
- L'indicateur est une chaîne en bas à droite : le bleu de la palette pour une URL, son orange pour un diagramme. Son infobulle nomme la cible.
- Maj+clic suit le lien avec tous les outils sauf la Flèche, où Maj sert à contraindre l'angle. Une URL s'ouvre par un `<a target="_blank">` (CONVENTION.md §4).
- La pile de retour s'allonge quand le diagramme cible est ouvert, et pas avant. Elle se vide à l'ouverture depuis la liste, avec « + New », par les params du Widget, et quand le diagramme ouvert est supprimé.
