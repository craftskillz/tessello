# 03: Évaluer une skill : Anneau, Note, Notes, Quadrants et filtres

Spec parente : `.scratch/skills-library/spec.md`. Vocabulaire : `GLOSSARY.md` et « Vocabulaire du Module » de la spec. Contrat : la Convention.

**What to build:** Le panneau d'édition d'une Skill, où l'Utilisateur donne son verdict et écrit ce qu'il en pense, les 4 Quadrants renommables, et les filtres de *Library*.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Un clic sur une Skill ouvre le panneau d'édition latéral (en plein écran sous 600 px) : nom, URL, description, Quadrant, Anneau (*Recommended*, *Try*, *Watch*, *Deprecated*), Note (1 à 5 étoiles, au clavier aussi), Notes (zone de texte Markdown). Chaque modification est enregistrée aussitôt et met à jour `updatedAt`.
- [ ] Les Notes de plus de 8 000 caractères sont refusées avec un message. Une URL modifiée respecte la règle de doublon du ticket 02.
- [ ] Un réglage de *Library* renomme les 4 Quadrants (1 à 40 caractères, requis). Les défauts sont ceux de la spec. Renommer ne change le Quadrant d'aucune Skill.
- [ ] *Library* se filtre par Anneau et par Quadrant (plusieurs valeurs possibles), et se cherche par nom (sans tenir compte de la casse ni des accents). Les filtres sont retenus.
- [ ] Test navigateur : changer l'Anneau, la Note, les Notes et le Quadrant d'une Skill, renommer un Quadrant, filtrer, recharger, tout est retenu.

## Comments

- Depuis le ticket 02, une Skill ajoutée passe par `select` dans `src/view/View.svelte`, qui la met seulement en évidence : c'est là qu'il faut ouvrir son panneau d'édition.
