# 11: Les Ensembles de bout en bout, à la main

Spec parente : `.scratch/skills-library/spec.md`. Vocabulaire : `GLOSSARY.md` et « Vocabulaire du Module » de la spec. Contrat : la Convention.

**What to build:** La bibliothèque range des **Ensembles** de Skills au lieu de Skills isolées. L'Anneau, le Quadrant, les Notes d'ensemble et l'explication d'un déplacement passent à l'Ensemble ; chaque Skill garde sa Note (ou reste *non évaluée*) et ses Notes. Tout le Module suit : Library, Changements, radar, Éditions, billet, Widget. Les données existantes sont converties. Ce ticket couvre la création à la main ; l'import GitHub vient au ticket 13.

**Blocked by:** aucun

**Status:** resolved

- [x] Modèle de la spec (« Modèle de données ») : Ensemble et Skill, Note facultative, Notes aux deux niveaux, valeurs par défaut. Stockage dans la clé `sets`.
- [x] Migration (« Migration de l'ancien modèle ») : au chargement, chaque ancienne Skill de `skills` devient un Ensemble d'une Skill, écrit dans `sets` ; `skills` n'est pas effacée. `readEdition` convertit à la lecture les Éditions de l'ancienne forme. Tests unitaires : bibliothèque et Édition converties, `id` de l'Ensemble = `id` de l'ancienne Skill, Note et Notes passées à la Skill, migration faite une seule fois.
- [x] Library : « New set » (nom, URL facultative, description) ; liste des Ensembles (nom, Anneau, Quadrant, nombre de Skills dont non évaluées, Changement en attente) ; recherche par nom d'Ensemble ou de Skill ; filtres par Anneau et Quadrant inchangés.
- [x] Panneau d'édition de l'Ensemble : nom, URL, description, Quadrant, Anneau, Notes, explication du déplacement, Archive / Unarchive / Delete (jamais publié seulement). Liste des Skills avec « Add skill » (nom, URL facultative, description) et, par Skill, un dépliant : nom, URL, description, Note avec « Clear », Notes, « Remove from set » (confirmation, possible même après publication).
- [x] Le collage d'une URL GitHub, en attendant le ticket 13, crée un Ensemble d'une Skill avec le flux actuel (un `SKILL.md`).
- [x] Doublons : clé sur la `sourceUrl` de l'Ensemble ; deux Skills de même `sourceUrl` refusées dans un même Ensemble, acceptées dans deux Ensembles.
- [x] `changesSince` par Ensemble, avec le *mis à jour* de la spec (Notes de l'Ensemble, Skill ajoutée ou retirée, Note ou Notes d'une Skill) et le détail des Skills changées ; le compteur exclut toujours *mis à jour*. Tests unitaires de chaque cas.
- [x] Le radar dessine un point par Ensemble (position hachée sur l'`id` de l'Ensemble, inchangée pour un Ensemble migré).
- [x] Publier fige les Ensembles avec leurs Skills (« Éditions ») ; « Delete » seulement pour un Ensemble jamais publié ; onglet *Editions* : nombre d'Ensembles par Anneau.
- [x] `renderPost` reste valide sur le nouveau modèle : une fiche par Ensemble (`### <n>. <Ensemble>`) avec la liste de ses Skills et leurs étoiles. La mise en page complète vient au ticket 12. Les tests existants de `renderPost` sont adaptés.
- [x] Widget : nombre d'Ensembles non archivés par Anneau.
- [x] Tests navigateur : partir d'un stockage à l'ancien modèle (Skills et une Édition), ouvrir la Vue, voir des Ensembles d'une Skill et aucun changement en attente ; créer un Ensemble à la main, y ajouter deux Skills, en noter une, publier, retirer une Skill, voir l'Ensemble *mis à jour* ; déplacer un Ensemble, expliquer, publier ; télécharger le `.zip` de l'ancienne Édition.

## Comments

- La Skill unique d'un Ensemble migré reçoit l'`id` `<id de l'Ensemble>-skill` (`legacySkillId`), déterministe, pour qu'une ancienne Édition convertie à la lecture ait les mêmes `id` de Skill que la bibliothèque migrée : rien n'apparaît comme changé.
- Le détail d'un *mis à jour* liste les Skills ajoutées, retirées et les Notes (étoiles) changées ; un changement des `notes` d'une Skill rend l'Ensemble *mis à jour* sans être détaillé.
- Les points du radar et les lignes de la Library portent `data-set-id` (le ticket 12 y ajoutera `data-number`).
