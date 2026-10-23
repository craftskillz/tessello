# 17: Cinq Thèmes au lieu de quatre Quadrants

Spec parente : `.scratch/skills-library/spec.md` (révision « tickets 17 à 19 »). Vocabulaire : `GLOSSARY.md` et « Vocabulaire du Module » de la spec. Contrat : la Convention.

**What to build:** Le Quadrant s'appelle désormais **Thème** (*Topic*), et il y en a 5 : *Learning & upskilling* rejoint les 4 premiers. Le radar se partage en 5 secteurs. Dans ce ticket, le Thème reste porté par l'Ensemble ; il passe à la Skill au ticket 18.

**Blocked by:** aucun

**Status:** resolved

- [x] Partout dans l'interface (anglais et français de `i18n.ts`), le Guide et le code, « Quadrant » devient « Topic » / « Thème » : sélecteur du panneau d'édition, colonne de la Library, filtres (« Filter by topic »), réglage « Rename topics », panneau de survol.
- [x] `settings.topics` : 5 noms, par défaut *Design & planning*, *Code & tests*, *Writing & docs*, *Tooling & workflow*, *Learning & upskilling*. Les 5 se renomment (1 à 40 caractères, requis). Un ancien `settings.quadrants` est lu : ses 4 noms gardent leur indice, le 5ᵉ prend le nom par défaut ; les filtres par Quadrant deviennent des filtres par Thème au même indice.
- [x] Un Ensemble peut être rangé dans le 5ᵉ Thème (`quadrant`, renommé ou non dans le code, accepte 0 à 4).
- [x] `renderRadar(entries, topics, options)` dessine autant de secteurs égaux que de noms : 5 pour la prochaine Édition et les nouvelles, 4 pour une Édition publiée avant ce ticket (ses `quadrants`). Les noms sont placés hors du cercle, sans se chevaucher ni sortir du dessin (360 px compris) ; les noms des Anneaux restent lisibles et ne sont pas barrés par un axe. Une 5ᵉ teinte, lisible sur fond clair et sombre.
- [x] Les nouvelles Éditions figent `topics` (5 noms) ; `readEdition` lit encore `quadrants` (4 noms) des anciennes. Le `.zip` d'une ancienne Édition se télécharge et montre ses 4 secteurs.
- [x] Tests unitaires : lecture des anciens réglages, renommage du 5ᵉ Thème, `renderRadar` avec 4 et 5 noms (chaque point dans son secteur, positions stables pour un même `id`), ancienne Édition relue.
- [x] Test navigateur : renommer le 5ᵉ Thème, y ranger un Ensemble, le voir dans le 5ᵉ secteur du radar ; une bibliothèque avec d'anciens réglages s'ouvre avec 5 Thèmes.
