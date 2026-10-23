# 14: Panneau de survol d'un Ensemble sur le radar

Spec parente : `.scratch/skills-library/spec.md`. Vocabulaire : `GLOSSARY.md` et « Vocabulaire du Module » de la spec. Contrat : la Convention.

**What to build:** Dans l'onglet *Radar*, survoler un point (ou le toucher, ou le focaliser au clavier) ouvre un panneau qui montre ce que contient l'Ensemble.

**Blocked by:** 11

**Status:** resolved

- [x] Le panneau montre le nom de l'Ensemble, son Anneau, son Quadrant, et chaque Skill avec ses étoiles ou « Not evaluated ». Il se place près du point sans sortir de la Vue, de 360 px à la largeur d'un ordinateur.
- [x] Souris : il s'ouvre au survol et se ferme en sortant. Écran tactile : un toucher l'ouvre, un toucher ailleurs le ferme. Clavier : chaque point est focalisable (ordre des numéros), Entrée ou le focus ouvre le panneau, Échap le ferme.
- [x] Un clic sur le nom de l'Ensemble dans le panneau ouvre l'onglet *Library* sur cet Ensemble.
- [x] Le panneau suit le thème de l'Hôte. Le SVG rendu par `renderRadar` reste celui du billet (le panneau s'appuie sur `data-set-id` si le ticket 12 est fait, sinon sur un attribut ajouté pour la Vue).
- [x] Test navigateur : survoler un point, lire les Skills et leurs Notes ; le parcourir au clavier ; cliquer le nom et arriver dans *Library*.
