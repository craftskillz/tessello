# 08: Ouverture avec les Modules de @craftskillz

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** La Marketplace ouvre avec Diagram, Watch Later, Survival Kit et Skills Library, publiés sous `@craftskillz` par le parcours normal des Créateurs.

**Blocked by:** 05, 07, 10, ticket 20 de tessello-v1 (renommage sous `@craftskillz`)

**Status:** ready-for-human

- [ ] Les `.zip` des quatre Modules sont hébergés sur GitHub Pages par leur dépôt `craftskillz/tessello-<nom>` (ticket 10), une URL par version.
- [ ] Une pull request par Module, ouverte par le compte `craftskillz`, passe la CI ; le Mainteneur l'approuve.
- [ ] Les quatre Modules s'installent depuis l'écran Marketplace d'un Hôte déployé, et depuis le bouton du site.
- [ ] Les Modules d'exemple (`examples/` : notes, meteo, prometheus) ne sont pas publiés.

## Comments

- 2026-10-24 — **Décision du Mainteneur :** Skills Library est publié à l'ouverture, avec les trois autres.
