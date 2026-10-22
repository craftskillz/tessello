# 04: Bannissement, Retrait et gel

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** Le Mainteneur bannit une version, un Module ou un Espace de noms ; le Créateur retire les siens ; un Espace de noms dont le compte GitHub change est gelé.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Le Vérificateur reconnaît les types `withdrawal` et `ban`. Un Retrait par le propriétaire de l'Espace de noms est fusionné automatiquement ; il n'efface jamais un Bannissement. Seul le Mainteneur ajoute ou lève un Bannissement, et il en donne la raison.
- [ ] Un Module banni n'accepte plus de version ; un Espace de noms `banned` ou `frozen` n'accepte plus rien, et le Bannissement d'un Espace de noms bannit tous ses Modules dans l'index.
- [ ] Gel : si le nom d'un compte ne correspond plus à son identifiant numérique, ou si le compte n'existe plus, la CI refuse et signale le cas au Mainteneur, qui tranche à la main dans `namespaces.json`.
- [ ] L'index et le site reflètent chaque état.
- [ ] `PUBLISHING.md` décrit le Retrait et le signalement par issue.
- [ ] Tests unitaires : chaque cas, dont un Retrait qui tente d'effacer un Bannissement et un nouveau compte qui reprend un ancien nom.
