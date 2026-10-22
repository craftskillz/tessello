# 12: Le billet du blog par Ensemble, et les infobulles du radar

Spec parente : `.scratch/skills-library/spec.md`. Vocabulaire : `GLOSSARY.md` et « Vocabulaire du Module » de la spec. Contrat : la Convention.

**What to build:** Le billet suit la mise en page des Ensembles de la spec (« Billet du blog ») ; chaque point du radar SVG porte une infobulle native qui liste les Skills de l'Ensemble et leurs Notes.

**Blocked by:** 11

**Status:** ready-for-human

- [x] Fiche complète d'un Ensemble dans « Ce qui bouge » : `### <n>. <Ensemble>`, badge, explication, description, lien, Notes de l'Ensemble (titres décalés pour que le plus haut soit `####`), détail des Skills pour un Ensemble *déplacé*, tableau des Skills (nom en lien, étoiles ou *Pas encore évaluée*, description), puis `#### <Skill>` et ses Notes (titres décalés à `#####` au plus haut) pour chaque Skill dont les Notes ne sont pas vides ni réduites au modèle.
- [x] Légende numérotée : numéro, Ensemble, Anneau, nombre de Skills. « Le reste du radar » : `- **<n>.** <Ensemble en lien> (<k> skills)`, *mis à jour* et le détail des Skills changées. « Retirés du radar » : Ensemble et Anneau quitté.
- [x] `renderRadar` : chaque point porte un `<title>` (« <n>. <Ensemble> — <Anneau> » puis une ligne par Skill avec ses étoiles, ou « (not evaluated) » / « (pas encore évaluée) » selon les libellés passés), et `data-set-id`, `data-number`. Le SVG reste sur une seule ligne dans le billet.
- [x] Tests unitaires de `renderPost` : tableau des Skills, Skill non évaluée, Notes vides ou réduites au modèle omises, décalage des titres aux deux niveaux, détail d'un Ensemble déplacé, première Édition, Édition de l'ancien modèle. Tests de `renderRadar` : `<title>` et attributs `data-`, caractères échappés.
- [x] Test navigateur : publier un Ensemble de trois Skills (une non évaluée), télécharger le `.zip`, vérifier le tableau, les fiches des Skills et les `<title>` du SVG.
- [ ] Vérification manuelle (notée en commentaire du ticket) : décompresser le `.zip` dans `craftskillz-blog`, `npm run dev`, survoler un point : l'infobulle native liste les Skills.

## Comments

- Fait, sauf la vérification manuelle. `renderRadar` (`src/lib/radar.ts`) prend les Skills de chaque entrée (`RadarEntry.skills`, facultatif) et le libellé `notEvaluated` de `RadarLabels` ; `stars` y est exporté et partagé avec le billet. L'onglet *Radar* a la même infobulle (« not evaluated »).
- Billet (`src/lib/post.ts`) : le détail des Skills d'un Ensemble *déplacé* est une liste à puces (`- Ajoutées : …`, `- Retirées : …`, `- Notes : …`) entre les Notes de l'Ensemble et le tableau ; dans « Le reste du radar », il suit `— *mis à jour* :` sur la même ligne, séparé par ` ; `. L'en-tête du tableau est `| Skill | Note | Description |`. Des Notes de Skill sont « réduites au modèle » quand elles ne contiennent que des titres et des lignes vides. La légende des marqueurs du billet passe au masculin (« Inchangé ou mis à jour », etc.), comme celle de la Vue.
- Reste : décompresser un `.zip` dans `craftskillz-blog`, `npm run dev`, survoler un point : l'infobulle native liste les Skills.
