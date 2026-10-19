# 07: Annuler et rétablir

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** Ctrl/Cmd+Z et Ctrl/Cmd+Maj+Z annulent et rétablissent **toute** modification du diagramme. L'original oubliait l'identité des formes personnalisées, le placement de leur texte, la position et la largeur des étiquettes, le titre, la grille et les guides (Q-015).

**Blocked by:** 06 (Groupes, verrous…)

**Status:** ready-for-agent

- [ ] Chaque geste terminé (le même événement qui déclenche l'enregistrement) crée une étape. Un glisser ne crée qu'une étape, et non une par image d'animation.
- [ ] Sont couverts : formes, flèches, extrémités et points de passage, styles, étiquettes, groupes, verrous, ordre, titre, grille et guides. Ne sont pas couverts : la sélection, le zoom et la position de la vue.
- [ ] Il y a 100 étapes au plus par diagramme. L'historique repart de zéro à l'ouverture d'un diagramme. Une annulation est enregistrée comme toute modification.
- [ ] Les raccourcis restent ceux de l'édition de texte quand un champ a le focus.
- [ ] Les tickets suivants (08 et au-delà) ajoutent leurs propres modifications à l'historique.
- [ ] Tests unitaires : pile d'annulation (limite, branche abandonnée après une nouvelle modification), et restitution complète d'un diagramme qui contient chaque type d'élément.
- [ ] Test navigateur : déplacer une forme, ajouter un point de passage, renommer le diagramme, puis tout annuler, tout rétablir, et recharger.
