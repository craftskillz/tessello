# 07: La Vue : alertes et restauration sur une autre machine

Spec parente : `.scratch/git-integration/spec.md`. Décision : `docs/adr/0020-git-integration-et-tessello-sync-parlent-par-le-stockage-du-module.md`. Vocabulaire : `GLOSSARY.md`.

**What to build:** La Vue explique chaque problème du `status` et ce qu'il faut faire, avertit pour un dépôt public, liste les dossiers exclus, et décrit la restauration.

**Blocked by:** 03, 04, 06

**Status:** resolved

### Alertes

- [x] `push-rejected` : « Le dépôt distant a des commits que cette machine n'a pas. Les commits continuent en local. Réglez le conflit à la main dans <Dossier des Modules> (`git pull`, résolution, `git push`), l'alerte disparaîtra au push suivant. » Avec `since` et le message de git dépliable.
- [x] `auth`, `remote-unreachable`, `git-missing`, `not-a-modules-folder` : un texte et une action pour chacun.
- [x] `remoteVisibility: public` : un avertissement visible tant que le dépôt est public, avec le nombre de Modules dont les données sont versionnées.
- [x] Une recommandation permanente, discrète, d'utiliser un dépôt privé.
- [x] `ownRepositories` : « Ces dossiers ont leur propre dépôt git et ne sont pas versionnés ici. »

### Restaurer

- [x] Une section « Restaurer sur une autre machine » : `git clone <remote> <dossier>`, ouvrir l'Hôte, **Choisir un dossier…** sur ce dossier, puis `npx tessello sync <dossier>`. Chaque commande se copie d'un clic, avec le dépôt saisi déjà dedans.
- [x] Elle dit que les Modules dont les données ne sont pas versionnées repartiront vides, et nomme ceux qui sont dans ce cas.

### Tests

- [x] Hôte de test : chaque `problem`, dépôt public, dossiers exclus, section de restauration avec le dépôt saisi.

## Comments

- 2026-11-06 : réalisé dans `craftskillz/tessello-git-integration` (commit `3864d7d`). Les commandes de restauration et la liste des Modules qui repartiront vides sont dans `src/lib/sync.ts` (`restoreFolder`, `restoreCommands`, `unversionedModules`), testées en Node ; la Vue est testée avec l'Hôte de test du SDK. Choix faits :
  - Comme au ticket 06, la Vue ne connaît pas le chemin du Dossier des Modules : les alertes disent « votre Dossier des Modules ».
  - Un problème n'est toujours affiché que si le moteur tourne ; l'avertissement « dépôt public » l'est dès que le `status` dit `public`, moteur arrêté ou non.
  - Le nombre de Modules dans l'avertissement ne compte pas Git Integration elle-même (sa `config` est toujours versionnée).
  - Le dossier de `git clone` est le dernier segment du dépôt sans `.git` (`tessello` s'il n'est pas sûr à coller dans un shell) ; un dépôt avec des caractères spéciaux est mis entre apostrophes ; sans dépôt saisi, la commande montre `<remote>`.
  - Le message de git est dans un `<details>` replié pour chaque problème, pas seulement `push-rejected`.
