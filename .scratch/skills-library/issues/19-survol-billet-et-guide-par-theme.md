# 19: Survol, billet et Guide par Thème

Spec parente : `.scratch/skills-library/spec.md` (révision « tickets 17 à 19 »). Vocabulaire : `GLOSSARY.md` et « Vocabulaire du Module » de la spec. Contrat : la Convention.

**What to build:** Ce qui montre un Ensemble suit ses Thèmes : le panneau de survol du radar ne montre que les Skills du Thème du point survolé, et le billet dit dans quels Thèmes est chaque Ensemble et chaque Skill. Le Guide décrit le nouveau modèle.

**Blocked by:** 18

**Status:** resolved

- [x] Panneau de survol (onglet *Radar*, ticket 14) : nom de l'Ensemble, Anneau, le Thème **du point**, et les seules Skills de ce Thème avec leurs étoiles ou « Not evaluated ». Deux points du même Ensemble ouvrent chacun leur panneau. Souris, toucher et clavier comme au ticket 14 ; l'ordre de focus suit les numéros, puis les Thèmes.
- [x] `renderPost` : la légende garde une ligne par Ensemble et y ajoute ses Thèmes ; le tableau des Skills d'une fiche est rangé par Thème et a une colonne Thème. Le reste du billet ne change pas. Une ancienne Édition donne le même billet qu'avant, avec le Thème de l'entrée sur chaque Skill.
- [x] Guide (`guide/guide.md`) : décrire les Ensembles, les 5 Thèmes choisis par Skill, le sélecteur de l'import, les points multiples d'un Ensemble et leur survol. Le Guide parle encore de Skills isolées dans « Quadrant » : le remettre à jour en entier sur le modèle des Ensembles.
- [x] Tests unitaires de `renderPost` : légende avec Thèmes, tableau rangé par Thème, ancienne Édition.
- [x] Test navigateur : survoler les deux points d'un Ensemble à 2 Thèmes et lire des Skills différentes ; au clavier, passer de l'un à l'autre.
