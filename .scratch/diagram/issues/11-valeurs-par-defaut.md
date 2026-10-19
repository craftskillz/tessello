# 11: Valeurs par défaut des nouvelles formes et flèches

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** Un seul niveau de valeurs par défaut, rangé dans la clé `defaults` (parcours 10, Q-016). Il n'y a plus de valeurs « projet » ni de mémoire du navigateur.

**Blocked by:** 04 (Tracés), 05 (Style des flèches)

**Status:** ready-for-agent

- [ ] Boîte de dialogue « Diagram defaults » :
  - pour les flèches : pointes, plein ou pointillé, taille du texte, tracé, épaisseur et couleur ;
  - pour chacune des sept formes intégrées : largeur, hauteur, taille du texte et couleur.
  - « Save », « Reset » (retour aux valeurs d'usine) et « Cancel ».
- [ ] Les bornes sont **appliquées** : tailles de 10 à 800, texte de 6 à 72. Une valeur hors bornes est signalée dans le champ, et l'enregistrement est refusé tant qu'elle n'est pas corrigée.
- [ ] « Save as default for this shape type » sur une forme intégrée sélectionnée, et « Save as default for arrows » sur une flèche, mettent à jour `defaults` et l'indiquent.
- [ ] Les valeurs par défaut ne changent que les créations suivantes, jamais les éléments existants. Les formes personnalisées gardent les dimensions de leur définition.
- [ ] Tests unitaires : lecture défensive de `defaults` (valeurs absentes ou hors bornes).
- [ ] Test navigateur : changer la couleur par défaut des rectangles, poser un rectangle, recharger.
