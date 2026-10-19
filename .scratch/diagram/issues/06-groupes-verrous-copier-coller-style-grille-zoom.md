# 06: Groupes, verrous, copier-coller, copie de style, grille, guides et zoom

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** Les outils pour travailler sur de grands schémas (parcours 3, 5, 6 et 9 de la rétrodoc), avec les simplifications décidées : un clic sur un élément verrouillé le sélectionne, sans maintien de 2 s, et « Copy style / Paste style » remplace les trois tampons.

**Blocked by:** 03 (Connexions)

**Status:** ready-for-agent

### Groupes

- [ ] « Group selection » (au moins deux formes) et « Ungroup ». Un clic sur un membre sélectionne tout le groupe, entouré d'un contour en pointillé. Alt+clic sélectionne un membre seul.
- [ ] Le groupe se déplace, se redimensionne et se met en forme d'un bloc.

### Verrous

- [ ] « Lock » sur des formes ou des flèches. Une flèche libre se verrouille avec ses deux extrémités.
- [ ] Un clic sur un élément verrouillé le sélectionne avec un badge cadenas. Il ne peut alors être ni déplacé, ni redimensionné, ni supprimé, et son panneau n'offre que **Unlock**.
- [ ] La sélection rectangle et Ctrl/Cmd+A ignorent les éléments verrouillés.

### Copier-coller

- [ ] Ctrl/Cmd+C copie dans un presse-papiers interne au Module les formes sélectionnées et les flèches dont les deux extrémités sont dans la sélection. Ctrl/Cmd+V colle avec un décalage de 40 unités qui s'accumule. Les groupes collés sont de **nouveaux** groupes, indépendants des originaux (Q-015).
- [ ] Une image présente dans le presse-papiers système passe en priorité au collage. C'est réalisé au ticket 08, et ce ticket laisse la place pour le faire.

### Copie de style

- [ ] « Copy style » (Ctrl/Cmd+Alt+C) prend la couleur, l'opacité, la taille et l'alignement du texte de la forme sélectionnée. Avec « with size » coché, elle prend aussi la largeur et la hauteur. Pour une flèche, elle prend les pointes, le pointillé, l'épaisseur, la couleur, la taille du texte et le tracé.
- [ ] « Paste style » (Ctrl/Cmd+Alt+V) l'applique à toute la sélection du même genre.

### Grille, guides et zoom

- [ ] Une grille avec aimantation (G) et des guides d'alignement (bords et centres des autres formes). Les deux sont activés par défaut et enregistrés avec le diagramme.
- [ ] Zoom −/+ et « Fit » (ajuster la vue au contenu), avec le pourcentage affiché.

### Tests

- [ ] Tests unitaires : candidats des guides d'alignement, aimantation sur la grille, copie de groupes (nouveaux `groupId`), application d'un style copié.
- [ ] Test navigateur : grouper puis déplacer, verrouiller puis tenter de supprimer, copier-coller un groupe relié par une flèche, copier un style.
