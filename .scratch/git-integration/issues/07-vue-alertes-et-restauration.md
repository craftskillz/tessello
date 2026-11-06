# 07: La Vue : alertes et restauration sur une autre machine

Spec parente : `.scratch/git-integration/spec.md`. Décision : `docs/adr/0020-git-integration-et-tessello-sync-parlent-par-le-stockage-du-module.md`. Vocabulaire : `GLOSSARY.md`.

**What to build:** La Vue explique chaque problème du `status` et ce qu'il faut faire, avertit pour un dépôt public, liste les dossiers exclus, et décrit la restauration.

**Blocked by:** 03, 04, 06

**Status:** ready-for-agent

### Alertes

- [ ] `push-rejected` : « Le dépôt distant a des commits que cette machine n'a pas. Les commits continuent en local. Réglez le conflit à la main dans <Dossier des Modules> (`git pull`, résolution, `git push`), l'alerte disparaîtra au push suivant. » Avec `since` et le message de git dépliable.
- [ ] `auth`, `remote-unreachable`, `git-missing`, `not-a-modules-folder` : un texte et une action pour chacun.
- [ ] `remoteVisibility: public` : un avertissement visible tant que le dépôt est public, avec le nombre de Modules dont les données sont versionnées.
- [ ] Une recommandation permanente, discrète, d'utiliser un dépôt privé.
- [ ] `ownRepositories` : « Ces dossiers ont leur propre dépôt git et ne sont pas versionnés ici. »

### Restaurer

- [ ] Une section « Restaurer sur une autre machine » : `git clone <remote> <dossier>`, ouvrir l'Hôte, **Choisir un dossier…** sur ce dossier, puis `npx tessello sync <dossier>`. Chaque commande se copie d'un clic, avec le dépôt saisi déjà dedans.
- [ ] Elle dit que les Modules dont les données ne sont pas versionnées repartiront vides, et nomme ceux qui sont dans ce cas.

### Tests

- [ ] Hôte de test : chaque `problem`, dépôt public, dossiers exclus, section de restauration avec le dépôt saisi.
