# 05: Le radar de la prochaine Édition, en direct

Spec parente : `.scratch/skills-library/spec.md`. Vocabulaire : `GLOSSARY.md` et « Vocabulaire du Module » de la spec. Contrat : la Convention.

**What to build:** L'onglet *Radar* dessine en SVG le radar de la prochaine Édition à partir des Skills non archivées. Le rendu est une fonction pure, réutilisée pour le billet et la couverture (ticket 07). Sans Édition publiée, toutes les Skills sont *nouvelles*.

**Blocked by:** 03

**Status:** resolved

- [x] `changesSince(skills, editions)` donne le Changement de chaque Skill (*nouvelle*, *de retour*, *déplacée* avec son sens, *mise à jour*, *retirée*, *inchangée*) et le compteur de changements en attente, comme dans la spec. Testée unitairement pour chaque cas, avec des Éditions construites en test.
- [x] `renderRadar` produit un SVG autonome : 4 anneaux (*Recommended* au centre), 4 Quadrants nommés, un point numéroté par Skill, la légende des marqueurs (● ◆ ▲ ▼). Testée unitairement : même `id` → même position ; numérotation par Quadrant, Anneau puis nom ; deux points ne se superposent pas.
- [x] Les couleurs restent lisibles sur fond clair et sombre ; le SVG ne dépend d'aucune feuille de style externe.
- [x] L'onglet *Radar* affiche le radar, la légende numérotée (numéro, nom, Anneau) et la liste des changements en attente. Un clic sur un point ou une ligne de la légende ouvre la Skill dans *Library*.
- [x] Le radar reste lisible de 360 px à la largeur d'un ordinateur.
- [x] Test navigateur : ajouter des Skills dans plusieurs Anneaux et Quadrants, voir les points ; changer l'Anneau d'une Skill, son point change d'anneau.
