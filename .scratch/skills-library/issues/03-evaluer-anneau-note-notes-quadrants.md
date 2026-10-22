# 03: Évaluer une skill : Anneau, Note, Notes, Quadrants et filtres

Spec parente : `.scratch/skills-library/spec.md`. Vocabulaire : `GLOSSARY.md` et « Vocabulaire du Module » de la spec. Contrat : la Convention.

**What to build:** Le panneau d'édition d'une Skill, où l'Utilisateur donne son verdict et écrit ce qu'il en pense, les 4 Quadrants renommables, et les filtres de *Library*.

**Blocked by:** 01

**Status:** resolved

- [x] Un clic sur une Skill ouvre le panneau d'édition latéral (en plein écran sous 600 px) : nom, URL, description, Quadrant, Anneau (*Recommended*, *Try*, *Watch*, *Deprecated*), Note (1 à 5 étoiles, au clavier aussi), Notes (zone de texte Markdown). Chaque modification est enregistrée aussitôt et met à jour `updatedAt`.
- [x] Les Notes de plus de 8 000 caractères sont refusées avec un message. Une URL modifiée respecte la règle de doublon du ticket 02.
- [x] Un réglage de *Library* renomme les 4 Quadrants (1 à 40 caractères, requis). Les défauts sont ceux de la spec. Renommer ne change le Quadrant d'aucune Skill.
- [x] *Library* se filtre par Anneau et par Quadrant (plusieurs valeurs possibles), et se cherche par nom (sans tenir compte de la casse ni des accents). Les filtres sont retenus.
- [x] Test navigateur : changer l'Anneau, la Note, les Notes et le Quadrant d'une Skill, renommer un Quadrant, filtrer, recharger, tout est retenu.

## Comments

- Depuis le ticket 02, une Skill ajoutée passe par `select` dans `src/view/View.svelte`, qui la met seulement en évidence : c'est là qu'il faut ouvrir son panneau d'édition.
- Fait. Le panneau d'édition est `src/view/EditPanel.svelte` ; le modèle (`editSkill`, `renameQuadrant`, `filterSkills`, `readFilters`) est dans `src/lib/skills.ts`, et `editUnlessDuplicate` dans `src/lib/github.ts`. Les champs texte s'enregistrent à la frappe, l'URL quand on quitte le champ (ou ferme le panneau), pour ne pas signaler de doublon à chaque touche.
- Une Skill que `show` doit montrer (ajoutée, ou doublon trouvé) efface les filtres qui la cachent.
- Des Notes refusées (plus de 8 000 caractères) restent dans la zone de texte avec le message, mais sont perdues à la fermeture du panneau.
- Entre 600 et 900 px, le panneau recouvre la page, barre du haut comprise ; au-delà, la liste se décale pour lui laisser la place.
