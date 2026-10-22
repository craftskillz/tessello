# 07: Exporter une Édition en billet pour le blog (.zip)

Spec parente : `.scratch/skills-library/spec.md`. Vocabulaire : `GLOSSARY.md` et « Vocabulaire du Module » de la spec. Contrat : la Convention.

**What to build:** « Download .zip » sur chaque Édition de l'onglet *Editions* remet un `.zip` à décompresser à la racine de `craftskillz-blog` : le billet Markdown en français, avec le radar en SVG, et son image de couverture. Le format suit les billets existants du blog (`_posts/*.md`, `gray-matter`, `remark-gfm` + `remark-html` sans assainissement).

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] `renderPost` produit le billet de la spec : frontmatter (titre, `excerpt` tiré du premier paragraphe de l'introduction, `coverImage`, `date`, `author.picture`, `ogImage`), introduction, radar SVG sur une seule ligne avec la légende numérotée, `## Ce qui bouge`, `## Le reste du radar`, `## Retirées du radar`, note de bas de page « Inspiré du Technology Radar de Thoughtworks ». Anneaux et Changements en français, Quadrants et Notes tels qu'écrits.
- [ ] Tests unitaires de `renderPost` : le frontmatter est relu par `gray-matter` avec les bonnes valeurs (y compris des guillemets et des retours à la ligne dans l'introduction) ; le SVG ne contient aucune ligne vide ; les titres des Notes sont abaissés à `####` au plus haut ; à la première Édition, toutes les Skills ont leur fiche complète ; une Skill déplacée montre « Déplacé : <ancien> → <nouveau> » et son explication.
- [ ] La couverture est le radar seul en PNG 1200 × 630 sur fond plein (même méthode que `src/view/png.ts` de Diagram).
- [ ] Le `.zip` (`fflate`) contient `_posts/skills-radar-edition-<n>.md` et `public/assets/blog/skills-radar-edition-<n>/cover.png`. Il se télécharge par un lien `download` vers un `blob:` (ADR 0013), pour n'importe quelle Édition, depuis la Vue.
- [ ] Test navigateur : publier deux Éditions, télécharger le `.zip` de la première puis de la seconde, les décompresser, vérifier les chemins, le frontmatter et les sections de chaque billet.
- [ ] Vérification manuelle (notée en commentaire du ticket) : décompresser un `.zip` dans `craftskillz-blog`, lancer `npm run dev`, le billet s'affiche avec le radar et la couverture, en thème clair et sombre.
