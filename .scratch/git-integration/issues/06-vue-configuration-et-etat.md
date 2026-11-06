# 06: La Vue : configurer et voir l'état du moteur

Spec parente : `.scratch/git-integration/spec.md`. Décision : `docs/adr/0020-git-integration-et-tessello-sync-parlent-par-le-stockage-du-module.md`. Vocabulaire : `GLOSSARY.md`.

**What to build:** La Vue lit le `status` et écrit la `config`. Elle dit si le moteur tourne, donne la commande à lancer, et permet de régler dépôt, push, fréquence et Modules dont les données sont versionnées.

**Blocked by:** 01, 05

**Status:** ready-for-agent

### État

- [ ] Le `status` est relu toutes les 3 s tant que la Vue est visible, et plus du tout quand elle est cachée (`onVisibilityChange`).
- [ ] « Moteur arrêté » quand il n'y a pas de `status`, ou que son `heartbeat` a plus de 2 × `intervalSeconds` + 10 s. La Vue affiche alors la commande à lancer (`npx tessello sync <Dossier des Modules>`), avec un bouton pour la copier.
- [ ] Moteur actif : date du dernier commit (date relative) et Modules qu'il a touchés, date du dernier push.
- [ ] Le problème `no-config` invite à saisir le dépôt.

### Configuration

- [ ] Champs : URL du dépôt distant, push oui/non (activé par défaut), fréquence (secondes, 10 au minimum, 60 par défaut). Écrits dans `config` à chaque modification valide.
- [ ] Liste des Modules installés, d'après `status.installed`, chacun avec une case « Versionner ses données », décochée par défaut. Un Module apparu depuis la dernière visite est signalé comme nouveau.
- [ ] Une phrase sous la liste rappelle que les données peuvent contenir des secrets (jetons d'API).
- [ ] Les données de Git Integration elle-même n'apparaissent pas dans la liste : sa `config` est toujours versionnée.

### Commun

- [ ] Thème de l'Hôte, langue selon `locale` (anglais, français), de 360 px à la largeur d'un ordinateur.
- [ ] Tests avec l'Hôte de test du SDK (ADR 0019) et un `status` pré-rempli : moteur arrêté, moteur actif, nouvelle configuration écrite, Module nouveau signalé.
