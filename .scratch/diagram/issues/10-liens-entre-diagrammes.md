# 10: Liens vers une URL ou un autre diagramme, et retour

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** Une forme peut porter un lien vers une URL ou vers un autre diagramme (parcours 7). On suit le lien, puis un bouton ramène au diagramme d'origine.

**Blocked by:** 02 (Toutes les formes intégrées)

**Status:** ready-for-agent

- [ ] Panneau « Link on this shape », pour une seule forme sélectionnée, avec trois choix :
  - **External URL**, à laquelle on ajoute `https://` sans schéma, comme dans le Survival Kit (seuls `http(s)`, `mailto:` et `tel:` sont gardés tels quels) ;
  - **Existing diagram**, dans une liste qui exclut le diagramme courant ;
  - **New diagram**, avec un titre obligatoire, et un message si ce titre est vide.
- [ ] Un indicateur de lien est visible sur la forme. Maj+clic suit le lien : une URL s'ouvre dans un nouvel onglet, et un diagramme s'ouvre dans la Vue.
- [ ] Suivre un lien vers un diagramme empile le diagramme d'origine. Un bouton **← Back to "<titre>"** en haut du canevas y ramène, et la pile se vide quand on ouvre un diagramme depuis la liste.
- [ ] Un lien vers un diagramme supprimé affiche « Diagram not found » et propose de retirer le lien.
- [ ] Le lien est enregistré automatiquement, comme toute modification, ce qui règle Q-014 pour les liens.
- [ ] Tests navigateur : lier une forme à un nouveau diagramme, le suivre, revenir ; supprimer la cible et constater le message.
