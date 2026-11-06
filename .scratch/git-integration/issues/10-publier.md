# 10: Publier la commande et le Module

Spec parente : `.scratch/git-integration/spec.md`. Décision : `docs/adr/0020-git-integration-et-tessello-sync-parlent-par-le-stockage-du-module.md`. Vocabulaire : `GLOSSARY.md`.

**What to build:** `tessello sync` sur npm et Git Integration sur la Marketplace.

**Blocked by:** 09

**Status:** ready-for-human

- [ ] Version du CLI relevée, puis `just npm-publish` (compte npm du Mainteneur, code à deux facteurs).
- [ ] `just publish minor` dans `tessello-git-integration`, puis `y` pour lister la version 0.1.0.
- [ ] Label `approved` sur la pull request de `tessello-marketplace` (premier Module : Approbation du Mainteneur).
- [ ] `just fixture git-integration 0.1.0` dans `tessello` si le test du ticket 09 utilise le paquet publié.
- [ ] README de `tessello` : Git Integration ajouté à la liste des Modules de @craftskillz.
