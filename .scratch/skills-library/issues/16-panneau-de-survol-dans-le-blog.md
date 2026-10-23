# 16: Panneau de survol du radar dans craftskillz-blog

Spec parente : `.scratch/skills-library/spec.md`. Vocabulaire : `GLOSSARY.md` et « Vocabulaire du Module » de la spec. Contrat : la Convention. Dépôt : `craftskillz-blog` (Next.js, hors de ce dépôt).

**What to build:** Dans le billet publié, survoler un point du radar ouvre un panneau riche (Ensemble, Anneau, Skills et leurs Notes) au lieu de la seule infobulle native. Le travail se fait dans le code du blog ; le Module ne change pas.

**Blocked by:** 12

**Status:** ready-for-human

- [ ] Un script du blog, chargé sur les billets qui contiennent un radar, trouve les points par `data-set-id` / `data-number` et lit leur `<title>` (aucune autre donnée n'est ajoutée au billet).
- [ ] Le panneau s'ouvre au survol, au toucher et au focus clavier, se ferme en sortant, d'un toucher ailleurs ou par Échap, et suit le thème clair et sombre du blog. L'infobulle native est masquée quand le panneau est actif, et reste le repli sans JavaScript.
- [ ] Les billets d'Édition déjà publiés en profitent sans être régénérés, s'ils ont été produits après le ticket 12.
- [ ] Vérification manuelle (notée en commentaire du ticket) : `npm run dev` dans le blog, un billet d'Édition, survol à la souris, au toucher (outils de développement) et au clavier, thèmes clair et sombre.

## Comments

**2026-10-23 — révision des Thèmes (tickets 17 à 19).** Après le ticket 18, un Ensemble peut avoir **plusieurs points** sur le radar (un par Thème), qui partagent `data-set-id` et `data-number`. Chaque point porte en plus `data-topic`, et son `<title>` ne liste que les Skills de ce Thème. Le script du blog doit donc traiter chaque point à part (lire le `<title>` du point, pas celui du premier point de même `data-set-id`). Les billets publiés avant le ticket 18 n'ont qu'un point par Ensemble et pas de `data-topic` : le script doit marcher sans.
