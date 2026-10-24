# 10: Un dépôt par Module de @craftskillz

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** Diagram, Watch Later, Survival Kit et Skills Library quittent `sample-modules/` pour un dépôt public chacun sous `craftskillz`, avec leur historique, leur licence MIT et leurs `.zip` servis par GitHub Pages. Le Mainteneur y publie comme n'importe quel Créateur.

**Blocked by:** 05, ticket 13 de tessello-v1 (publication npm du SDK)

**Status:** ready-for-agent

- [ ] `craftskillz/tessello-diagram`, `craftskillz/tessello-watch-later`, `craftskillz/tessello-survival-kit` et `craftskillz/tessello-skills-library` existent, publics, licence MIT reconnue par GitHub, chacun avec l'historique de son dossier (`git subtree split` ou `git filter-repo`).
- [ ] Chaque dépôt se construit et se teste seul (`npm ci`, `npm test`, `npm run build`), sans l'espace de travail de `tessello` : `@tessello/sdk` vient de npm.
- [ ] Chaque dépôt a une CI (GitHub Actions) : tests à chaque pull request ; à chaque tag `v<version>`, le `.zip` est construit et publié sur GitHub Pages à `https://craftskillz.github.io/tessello-<nom>/<version>.zip`, jamais écrasé, servi avec `Access-Control-Allow-Origin: *`.
- [ ] Le Guide d'utilisation, l'icône et le `README.md` de chaque dépôt disent ce qu'est le Module et renvoient à Tessello.
- [ ] Dans `tessello` : `sample-modules/` est supprimé ; `packages/host/e2e/browser.ts` et `packages/cli/test/examples.test.ts`, qui en construisent les paquets, s'appuient sur `examples/` ou sur des fixtures, sans perdre de parcours testé ; les workspaces et la documentation qui citent `sample-modules/` sont à jour.
- [ ] La création des dépôts et l'activation de GitHub Pages ne sont faites qu'avec l'accord explicite du Mainteneur.

## Comments

- 2026-10-24 — **Pourquoi un dépôt par Module** (proposé au Mainteneur) : la fiche exige que `source` soit la racine d'un dépôt (`packages/marketplace/src/entry.ts`), dont la licence est celle de la fiche ; restés dans `tessello`, les quatre Modules pointeraient vers la plateforme. Un dépôt par Module donne une page GitHub Pages par Module, des versions, des tags et des issues à lui, et fait du Mainteneur le premier vrai Créateur, ce qui éprouve les tickets 09 et 13. `examples/` (notes, meteo, prometheus) reste dans `tessello`.
- Ordre proposé : ticket 05, puis ticket 13, puis ce ticket, puis le ticket 08, qui publie depuis ces dépôts.
- 2026-10-24 — **Décisions du Mainteneur :** Skills Library sort aussi dans son propre dépôt et est publié à l'ouverture (ticket 08). Les dépôts sont préfixés `tessello-` (`tessello-diagram`, …), pour qu'on voie d'un coup d'œil ce qu'ils contiennent ; l'Identifiant des Modules ne change pas (`@craftskillz/diagram`, …). `@tessello/sdk` vient de npm : ce ticket attend le ticket 13 de tessello-v1.
