# 06: La Vue : configurer et voir l'état du moteur

Spec parente : `.scratch/git-integration/spec.md`. Décision : `docs/adr/0020-git-integration-et-tessello-sync-parlent-par-le-stockage-du-module.md`. Vocabulaire : `GLOSSARY.md`.

**What to build:** La Vue lit le `status` et écrit la `config`. Elle dit si le moteur tourne, donne la commande à lancer, et permet de régler dépôt, push, fréquence et Modules dont les données sont versionnées.

**Blocked by:** 01, 05

**Status:** resolved

### État

- [x] Le `status` est relu toutes les 3 s tant que la Vue est visible, et plus du tout quand elle est cachée (`onVisibilityChange`).
- [x] « Moteur arrêté » quand il n'y a pas de `status`, ou que son `heartbeat` a plus de 2 × `intervalSeconds` + 10 s. La Vue affiche alors la commande à lancer (`npx tessello sync <Dossier des Modules>`), avec un bouton pour la copier.
- [x] Moteur actif : date du dernier commit (date relative) et Modules qu'il a touchés, date du dernier push.
- [x] Le problème `no-config` invite à saisir le dépôt.

### Configuration

- [x] Champs : URL du dépôt distant, push oui/non (activé par défaut), fréquence (secondes, 10 au minimum, 60 par défaut). Écrits dans `config` à chaque modification valide.
- [x] Liste des Modules installés, d'après `status.installed`, chacun avec une case « Versionner ses données », décochée par défaut. Un Module apparu depuis la dernière visite est signalé comme nouveau.
- [x] Une phrase sous la liste rappelle que les données peuvent contenir des secrets (jetons d'API).
- [x] Les données de Git Integration elle-même n'apparaissent pas dans la liste : sa `config` est toujours versionnée.

### Commun

- [x] Thème de l'Hôte, langue selon `locale` (anglais, français), de 360 px à la largeur d'un ordinateur.
- [x] Tests avec l'Hôte de test du SDK (ADR 0019) et un `status` pré-rempli : moteur arrêté, moteur actif, nouvelle configuration écrite, Module nouveau signalé.

## Comments

- 2026-11-06 : réalisé dans `craftskillz/tessello-git-integration` (commit `3649cf9`). La logique (lecture de `config` et `status`, moteur actif ou arrêté, liste des Modules, dates relatives) est dans `src/lib/sync.ts`, testée en Node ; la Vue (`src/view/View.svelte`) est testée dans Chromium avec l'Hôte de test du SDK 0.2.0 (`e2e/`), en CI et avant `just publish`. Choix faits :
  - La Vue ne connaît pas le chemin du Dossier des Modules : elle demande d'ouvrir un terminal dans ce dossier et d'y lancer `npx tessello sync` (sans argument, la commande prend le dossier courant), et c'est cette commande que le bouton copie.
  - Les Modules déjà vus sont gardés sous une clé `seen` du Module (versionnée, comme `config`). À la première visite, aucun Module n'est signalé comme nouveau.
  - La fréquence est bornée à 3600 s, comme dans `tessello sync`.
  - Un problème n'est affiché que si le moteur tourne : celui d'un moteur arrêté date de son dernier tour.
  - Le `heartbeat` est jugé avec la fréquence de la `config` que la Vue a lue ou écrite (60 s sans `config`).
  - « Plus de lecture quand la Vue est cachée » n'a pas de test : il faudrait une attente fixe. Le test vérifie que la Vue relit le `status` dès qu'elle redevient visible.
