# 02: La boucle : intervalle, période de calme et verrou

Spec parente : `.scratch/git-integration/spec.md`. Décision : `docs/adr/0020-git-integration-et-tessello-sync-parlent-par-le-stockage-du-module.md`. Vocabulaire : `GLOSSARY.md`.

**What to build:** `npx tessello sync` sans `--once` tourne au premier plan et fait un tour toutes les `intervalSeconds`, en relisant la `config` à chaque tour. Elle ne commite pas pendant que des données changent, et deux instances ne tournent jamais sur le même dossier.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Un tour toutes les `intervalSeconds` (60 par défaut, 10 au minimum, une valeur hors bornes est ramenée dans les bornes). Un changement de `config` prend effet au tour suivant, sans redémarrage.
- [ ] **Période de calme** : si un fichier modifié (d'après `git status --porcelain`) a une date de modification de moins de 10 s, le commit est remis au tour suivant. Le `heartbeat` est écrit quand même.
- [ ] `.tessello/sync.lock` contient le PID. Une seconde instance refuse de démarrer, avec un message. Un verrou dont le PID ne tourne plus est repris.
- [ ] Ctrl+C (SIGINT, SIGTERM) termine le tour en cours, retire le verrou et sort proprement.
- [ ] Une ligne de journal par tour qui fait quelque chose (commit, push, problème), rien pour un tour vide.
- [ ] Tests : calme qui remet le commit puis commit au tour suivant, verrou refusé, verrou périmé repris, `config` modifiée entre deux tours. L'horloge et les durées sont injectables, pour que les tests ne dorment pas.
