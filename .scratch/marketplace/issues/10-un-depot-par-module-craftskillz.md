# 10: Un dépôt par Module de @craftskillz

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** Diagram, Watch Later, Survival Kit et Skills Library quittent `sample-modules/` pour un dépôt public chacun sous `craftskillz`, avec leur historique, leur licence MIT et leurs `.zip` servis par GitHub Pages. Le Mainteneur y publie comme n'importe quel Créateur.

**Blocked by:** 05, ticket 13 de tessello-v1 (publication npm du SDK)

**Status:** resolved

- [x] `craftskillz/tessello-diagram`, `craftskillz/tessello-watch-later`, `craftskillz/tessello-survival-kit` et `craftskillz/tessello-skills-library` existent, publics, licence MIT reconnue par GitHub, chacun avec l'historique de son dossier (`git subtree split` ou `git filter-repo`).
- [x] Chaque dépôt se construit et se teste seul (`npm ci`, `npm test`, `npm run build`), sans l'espace de travail de `tessello` : `@tessello/sdk` vient de npm.
- [x] Chaque dépôt a une CI (GitHub Actions) : tests à chaque pull request ; à chaque tag `v<version>`, le `.zip` est construit et publié sur GitHub Pages à `https://craftskillz.github.io/tessello-<nom>/<version>.zip`, jamais écrasé, servi avec `Access-Control-Allow-Origin: *`.
- [x] Le Guide d'utilisation, l'icône et le `README.md` de chaque dépôt disent ce qu'est le Module et renvoient à Tessello.
- [x] Dans `tessello` : `sample-modules/` est supprimé ; `packages/host/e2e/browser.ts` et `packages/cli/test/examples.test.ts`, qui en construisent les paquets, s'appuient sur `examples/` ou sur des fixtures, sans perdre de parcours testé ; les workspaces et la documentation qui citent `sample-modules/` sont à jour.
- [x] La création des dépôts et l'activation de GitHub Pages ne sont faites qu'avec l'accord explicite du Mainteneur.

## Comments

- 2026-10-24 — **Pourquoi un dépôt par Module** (proposé au Mainteneur) : la fiche exige que `source` soit la racine d'un dépôt (`packages/marketplace/src/entry.ts`), dont la licence est celle de la fiche ; restés dans `tessello`, les quatre Modules pointeraient vers la plateforme. Un dépôt par Module donne une page GitHub Pages par Module, des versions, des tags et des issues à lui, et fait du Mainteneur le premier vrai Créateur, ce qui éprouve les tickets 09 et 13. `examples/` (notes, meteo, prometheus) reste dans `tessello`.
- Ordre proposé : ticket 05, puis ticket 13, puis ce ticket, puis le ticket 08, qui publie depuis ces dépôts.
- 2026-10-24 — **Décisions du Mainteneur :** Skills Library sort aussi dans son propre dépôt et est publié à l'ouverture (ticket 08). Les dépôts sont préfixés `tessello-` (`tessello-diagram`, …), pour qu'on voie d'un coup d'œil ce qu'ils contiennent ; l'Identifiant des Modules ne change pas (`@craftskillz/diagram`, …). `@tessello/sdk` vient de npm : ce ticket attend le ticket 13 de tessello-v1.
- 2026-10-24 — **Fait.** Les quatre dépôts `craftskillz/tessello-{diagram,watch-later,survival-kit,skills-library}` sont publics, licence MIT reconnue, avec l'historique de leur dossier (`git subtree split`, sans les dossiers `.tessello-backup-*`). Chacun passe seul `npm ci`, `npm run typecheck`, `npm test`, `npm run build` et `npx tessello validate dist`, avec `@tessello/sdk` et `tessello` venus de npm ; sa CI est verte sur `main`. `release.yml` : à un tag `v<version>`, vérifie que le tag est la version du Manifest, teste, construit, valide, puis ajoute `<version>.zip` à la branche `gh-pages`, et échoue si ce fichier y est déjà. GitHub Pages est activé depuis `gh-pages` et sert `Access-Control-Allow-Origin: *` (vérifié sur `.nojekyll` ; pas encore sur un `.zip`). Aucun tag n'est encore poussé, donc `release.yml` n'a jamais tourné : au premier tag (ticket 08), vérifier que `<version>.zip` répond 200 avec cet en-tête. Les fixtures sont construites depuis `main` de ces dépôts jusque-là. Non fait : `release.yml` ne vérifie pas que le tag est sur `main` ; `just module` (montée de version) disparaît avec `sample-modules/`, le README de chaque dépôt dit comment monter la version. README et une section « About » dans chaque Guide d'utilisation renvoient à Tessello.
- Dans `tessello` : `sample-modules/` est supprimé. Les tests navigateur des quatre Modules restent ici (décision du Mainteneur) et installent les paquets publiés gardés dans `packages/host/e2e/fixtures/<nom>.zip` (`moduleFixture`), construits depuis les nouveaux dépôts ; `examples.test.ts` passe le Vérificateur sur chacun. `just fixture <nom> <version>` les rafraîchit depuis GitHub Pages.
