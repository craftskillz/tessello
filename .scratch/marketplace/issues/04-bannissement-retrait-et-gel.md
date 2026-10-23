# 04: Bannissement, Retrait et gel

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** Le Mainteneur bannit une version, un Module ou un Espace de noms ; le Créateur retire les siens ; un Espace de noms dont le compte GitHub change est gelé.

**Blocked by:** 03

**Status:** ready-for-human

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
- 2026-10-23 — **Reste à faire, avec l'accord du Mainteneur :** relire les ajouts de `PUBLISHING.md` ; pousser ce commit de `craftskillz/tessello`, monter `.github/tessello-commit` à ce commit dans `tessello-marketplace` puis pousser ; créer le label `namespace-changed` ; essai réel sur `craftskillz/tessello-marketplace-test` : un Retrait fusionné seul, un Bannissement par un Créateur refusé, un Bannissement du Mainteneur (vérifie que le `GITHUB_TOKEN` lit bien l'endpoint de permission), un gel. Puis passer ce ticket à `resolved`.
