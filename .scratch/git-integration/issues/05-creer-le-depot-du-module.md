# 05: Créer le dépôt du Module Git Integration

Spec parente : `.scratch/git-integration/spec.md`. Décision : `docs/adr/0020-git-integration-et-tessello-sync-parlent-par-le-stockage-du-module.md`. Vocabulaire : `GLOSSARY.md`.

**What to build:** Le dépôt `craftskillz/tessello-git-integration`, à partir du template Svelte.

**Blocked by:** aucun

**Status:** ready-for-human

La commande crée un dépôt **public** sur GitHub et active GitHub Pages : le Mainteneur la lance ou la confirme.

- [ ] `just new-module git-integration` dans `tessello`. Le Module est cloné dans `../tessello-git-integration`.
- [ ] Le Manifeste : `@craftskillz/git-integration`, nom « Git Integration », aucune Permission, Widget de taille **S**, une icône.
- [ ] Le compteur du template est retiré, et le paquet passe `tessello validate` sans erreur ni avertissement.
