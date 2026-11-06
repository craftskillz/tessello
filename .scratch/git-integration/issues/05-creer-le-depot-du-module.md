# 05: Créer le dépôt du Module Git Integration

Spec parente : `.scratch/git-integration/spec.md`. Décision : `docs/adr/0020-git-integration-et-tessello-sync-parlent-par-le-stockage-du-module.md`. Vocabulaire : `GLOSSARY.md`.

**What to build:** Le dépôt `craftskillz/tessello-git-integration`, à partir du template Svelte.

**Blocked by:** aucun

**Status:** resolved

La commande crée un dépôt **public** sur GitHub et active GitHub Pages : le Mainteneur la lance ou la confirme.

- [x] `just new-module git-integration` dans `tessello`. Le Module est cloné dans `../tessello-git-integration`.
- [x] Le Manifeste : `@craftskillz/git-integration`, nom « Git Integration », aucune Permission, Widget de taille **S**, une icône.
- [x] Le compteur du template est retiré, et le paquet passe `tessello validate` sans erreur ni avertissement.

## Comments

- 2026-11-06 : réalisé. Le Mainteneur a lancé `just new-module git-integration` : dépôt public `craftskillz/tessello-git-integration` créé, cloné dans `../tessello-git-integration`, renommé, commité et poussé ; branche `gh-pages` poussée et GitHub Pages servi depuis `gh-pages`. La recette a échoué à sa dernière étape (`gh: GitHub Pages is already enabled. (HTTP 409)`) : GitHub avait déjà activé Pages en recevant `gh-pages`. Corrigé dans le `justfile` : si le `POST` échoue, la recette vérifie que Pages sert déjà `gh-pages`, sinon elle s'arrête. Dans le Module : description du Manifeste et de `package.json`, icône d'une branche git, compteur retiré (`src/lib/count.ts`, son test, la Vue, le Widget, le README, le Guide). Le Manifeste était déjà conforme au ticket (Identifiant, nom, aucune Permission, Widget S, icône). `tessello validate dist` : 0 avertissement.
