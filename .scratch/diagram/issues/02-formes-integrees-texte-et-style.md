# 02: Toutes les formes intégrées, leur texte et leur style

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** L'Utilisateur dispose des sept formes intégrées de l'original. Il peut les redimensionner, les tourner, écrire leur texte et les mettre en forme. C'est le parcours 2 et la plus grande partie du parcours 3 de la rétrodoc.

**Blocked by:** 01 (Squelette)

**Status:** ready-for-agent

- [ ] Outils Rectangle (R), Ellipse (E), Database (D), Circle (C), Actor (A), Post-it (P), Free text (T) et Select (S, Échap). Chaque forme a le rendu de l'original (la base de données a son cylindre, le Post-it son coin plié, l'Acteur sa silhouette) et suit le thème clair ou sombre.
- [ ] Redimensionnement par les poignées des coins, avec une taille minimale de 20 unités. Maj garde les proportions, et l'Acteur les garde toujours. Le mode « coin opposé fixe » ou « centre fixe » se choisit dans la barre d'outils.
- [ ] Rotation par une poignée dédiée et par les boutons ±10°. Le texte a sa propre rotation.
- [ ] Le panneau de forme permet de régler :
  - la couleur (palette de l'original, en variantes claire et sombre) ;
  - l'opacité du fond (0–100 %) ;
  - la taille du texte (8–48) ;
  - l'alignement horizontal et vertical ;
  - l'ordre (premier plan, arrière-plan).
- [ ] Double-clic sur une forme, ou bouton « Edit text » : édition du texte sur place, avec retour à la ligne automatique dans la largeur de la forme.
- [ ] Ctrl/Cmd+clic ajoute une forme à la sélection ou l'en retire, et Ctrl/Cmd+A sélectionne tout. Le panneau s'applique à toute la sélection.
- [ ] Les flèches attachées suivent la forme quand elle est redimensionnée ou tournée, avec le contour réel : cercle, ellipse, cylindre et forme tournée.
- [ ] Tests unitaires : contour de chaque forme (intersection d'une demi-droite depuis le centre), y compris tournée.
- [ ] Test navigateur : poser chaque forme, la redimensionner avec Maj, la tourner, changer sa couleur et son texte, puis tout retrouver après un rechargement.
