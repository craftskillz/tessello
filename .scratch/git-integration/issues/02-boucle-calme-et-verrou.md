# 02: La boucle : intervalle, période de calme et verrou

Spec parente : `.scratch/git-integration/spec.md`. Décision : `docs/adr/0020-git-integration-et-tessello-sync-parlent-par-le-stockage-du-module.md`. Vocabulaire : `GLOSSARY.md`.

**What to build:** `npx tessello sync` sans `--once` tourne au premier plan et fait un tour toutes les `intervalSeconds`, en relisant la `config` à chaque tour. Elle ne commite pas pendant que des données changent, et deux instances ne tournent jamais sur le même dossier.

**Blocked by:** 01

**Status:** resolved

- [x] Un tour toutes les `intervalSeconds` (60 par défaut, 10 au minimum, une valeur hors bornes est ramenée dans les bornes). Un changement de `config` prend effet au tour suivant, sans redémarrage.
- [x] **Période de calme** : si un fichier modifié (d'après `git status --porcelain`) a une date de modification de moins de 10 s, le commit est remis au tour suivant. Le `heartbeat` est écrit quand même.
- [x] `.tessello/sync.lock` contient le PID. Une seconde instance refuse de démarrer, avec un message. Un verrou dont le PID ne tourne plus est repris.
- [x] Ctrl+C (SIGINT, SIGTERM) termine le tour en cours, retire le verrou et sort proprement.
- [x] Une ligne de journal par tour qui fait quelque chose (commit, push, problème), rien pour un tour vide.
- [x] Tests : calme qui remet le commit puis commit au tour suivant, verrou refusé, verrou périmé repris, `config` modifiée entre deux tours. L'horloge et les durées sont injectables, pour que les tests ne dorment pas.

## Comments

- 2026-11-06 : réalisé. `npx tessello sync [dossier]` tourne au premier plan (`syncLoop` dans `packages/cli/src/sync-command.ts`) ; `--once` garde un seul tour. L'intervalle est relu à chaque tour et ramené dans [10, 3600] s (60 sans `config` valide). Période de calme : `git status --porcelain -z`, différence absolue entre `now` et la date de modification (un fichier daté dans le futur ne bloque pas pour toujours), fichiers supprimés ignorés ; le `.gitignore` n'est exempté que si la commande vient de réécrire sa section dans ce tour. Verrou dans `packages/cli/src/sync-lock.ts`, pris aussi par `--once`, vérifié après le contrôle du Dossier des Modules (un mauvais dossier ne reçoit pas de `.tessello/`). Un verrou périmé est mis de côté par `rename` puis relu : si ce n'était plus le verrou périmé (une autre instance l'a repris entre-temps), il est remis en place. Journal : `<iso> Committed <sha>: <Modules>` ou `<iso> <message du problème>`, rien pour un tour vide ou remis ; un tour qui lève une erreur est journalisé (`Round failed`) et la boucle reprend 60 s plus tard. 601 tests, typage sans erreur.
- 2026-11-06 : relecture à deux axes. Spec : corrigés avant le commit : la reprise d'un verrou périmé pouvait supprimer le verrou neuf d'une autre instance (course), et une modification du `.gitignore` par l'Utilisateur échappait à la période de calme. Hors ticket mais assumés : borne haute de 3600 s, reprise après un tour en erreur. Pas de test qui interrompt au milieu d'un tour (le signal n'est lu qu'entre deux tours). Standards : aucune violation ; restent des jugements : `syncCommand` mêle arguments, verrou et signaux, `sync-command.ts` porte maintenant la boucle (à sortir dans son module comme le verrou), `finish(false, undefined, true)` est un drapeau booléen anonyme, `pid: 0` pour un PID illisible. Le verrou, l'intervalle et la période de calme pourraient entrer dans l'ADR 0020 ou le GLOSSARY.
