# 04: Bannissement, Retrait et gel

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** Le Mainteneur bannit une version, un Module ou un Espace de noms ; le Créateur retire les siens ; un Espace de noms dont le compte GitHub change est gelé.

**Blocked by:** 03

**Status:** resolved

- [x] Le Vérificateur reconnaît les types `withdrawal` et `ban`. Un Retrait par le propriétaire de l'Espace de noms est fusionné automatiquement ; il n'efface jamais un Bannissement. Seul le Mainteneur ajoute ou lève un Bannissement, et il en donne la raison.
- [x] Un Module banni n'accepte plus de version ; un Espace de noms `banned` ou `frozen` n'accepte plus rien, et le Bannissement d'un Espace de noms bannit tous ses Modules dans l'index.
- [x] Gel : si le nom d'un compte ne correspond plus à son identifiant numérique, ou si le compte n'existe plus, la CI refuse et signale le cas au Mainteneur, qui tranche à la main dans `namespaces.json`.
- [x] L'index et le site reflètent chaque état.
- [x] `PUBLISHING.md` décrit le Retrait et le signalement par issue.
- [x] Tests unitaires : chaque cas, dont un Retrait qui tente d'effacer un Bannissement et un nouveau compte qui reprend un ancien nom.

## Comments

- 2026-10-23 — **Implémentation** (`packages/marketplace`).
  - Vérificateur : nouveaux types `withdrawal` et `ban`. Un Retrait n'ajoute que des `withdrawn: true` (aucun levé, rien d'autre) ; il est fusionné automatiquement et ne vérifie ni la source ni la licence, pour qu'un Créateur puisse toujours retirer. Tout changement d'une marque `banned` est un `ban` : `ban/maintainer-only` si l'auteur n'est pas le Mainteneur (c'est ce qui refuse un Retrait qui efface un Bannissement) ; le Bannissement du Mainteneur vient seul (`ban/not-alone`) et sa décision est `maintainer` (il fusionne lui-même). Lever un Retrait part au Mainteneur (`other`).
  - Le Mainteneur est l'auteur qui a la permission `write`, `maintain` ou `admin` sur le dépôt de la Marketplace (`GET /repos/{dépôt}/collaborators/{login}/permission`).
  - `module/banned`, `namespace/frozen`, `namespace/banned` ; gel : `namespace/account-gone` et `namespace/id-mismatch` donnent `freeze` dans `result.json`, une phrase dans le commentaire, et le label `namespace-changed` posé par la CI.
  - Index : un Espace de noms `banned` dans `namespaces.json` bannit tous ses Modules (raison du Module d'abord, sinon celle de l'Espace de noms) ; `frozen` ne change pas l'index. `build-site` lit `namespaces.json`.
  - Dans `../tessello-marketplace` : `PUBLISHING.md` (Retrait, Bannissements et gel, signalement) et `check.yml` (label du gel).
- 2026-10-23 — **Reste à faire, avec l'accord du Mainteneur :** pousser `craftskillz/tessello` (commit `d9162de`), puis `tessello-marketplace` ; créer le label `namespace-changed` ; essai réel sur `craftskillz/tessello-marketplace-test` : un Retrait fusionné seul, un Bannissement par un Créateur refusé, un Bannissement du Mainteneur (vérifie que le `GITHUB_TOKEN` lit bien l'endpoint de permission), un gel. Puis passer ce ticket à `resolved`.
- 2026-10-23 — Le Mainteneur a relu et accepté les ajouts de `PUBLISHING.md`. Commit local `410d976` dans `tessello-marketplace` : `PUBLISHING.md`, le label du gel dans `check.yml` et l'outil épinglé à `d9162de`. Rien n'est poussé.
- 2026-10-23 — `craftskillz/tessello` est poussé et le label `namespace-changed` est créé dans `craftskillz/tessello-marketplace`. Le commit de la Marketplace est sur la branche `marketplace-ticket-04` (`68240bb`, à partir de `main`). Le dépôt de test `craftskillz/tessello-marketplace-test` n'existe plus : l'essai réel reste à organiser.
- 2026-10-23 — **Décision du Mainteneur : pas d'essai réel.** Le ticket est résolu sur la foi des tests unitaires ; le premier Retrait ou Bannissement réel servira d'essai. Point non vérifié : la lecture de la permission d'un collaborateur par le `GITHUB_TOKEN` de la CI. Si elle échoue, l'étape de vérification échoue (aucune fusion à tort). Reste à fusionner la branche `marketplace-ticket-04` dans `main` de `tessello-marketplace`.
