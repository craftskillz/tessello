# 03: Push, et push refusé laissé à l'Utilisateur

Spec parente : `.scratch/git-integration/spec.md`. Décision : `docs/adr/0020-git-integration-et-tessello-sync-parlent-par-le-stockage-du-module.md`. Vocabulaire : `GLOSSARY.md`.

**What to build:** Quand `push` est vrai, la commande règle `origin` sur `remote` et pousse les commits en avance. Un push refusé devient un problème du `status`, retenté à chaque tour, jamais forcé.

**Blocked by:** 01

**Status:** resolved

- [x] `origin` est créé ou corrigé d'après `config.remote`. Un `remote` vide désactive le push.
- [x] Si la branche locale est en avance sur `origin/main` (ou si `origin/main` n'existe pas encore) : `git push -u origin main`. Jamais de `pull`, de fusion, de rebase ni de `--force`.
- [x] Les échecs sont classés à partir de la sortie de git : `push-rejected` (non-fast-forward), `auth` (accès refusé), `remote-unreachable` (réseau, hôte inconnu). Le `message` donne la sortie de git, raccourcie, et `since` garde la date du premier échec de la série.
- [x] Les commits continuent en local pendant un échec. Le push est retenté à chaque tour, et le `problem` disparaît au premier push réussi.
- [x] `lastPush.at` est mis à jour à chaque push réussi.
- [x] git ne demande jamais rien dans le terminal (`GIT_TERMINAL_PROMPT=0`, SSH en `BatchMode`) : un identifiant manquant est un problème `auth`, pas une commande bloquée.
- [x] Tests avec un dépôt nu local comme `origin` : premier push, push suivant, push refusé après un commit fait ailleurs, retour à la normale une fois le conflit réglé à la main, push désactivé.

## Comments

- 2026-11-06 : réalisé. `pushCommits` dans `packages/cli/src/sync-command.ts`, appelé après l'étape de commit, et aussi dans un tour dont le commit est remis par la période de calme (le push est retenté à chaque tour). Un tour sauté pour `.git/index.lock` ne pousse pas (étape 1 de la spec ; `push -u` écrit aussi dans `.git`). Rien à faire quand `push` est faux, `remote` vide ou HEAD sans commit. `origin` est lu par `git config --get remote.origin.url` (l'URL telle qu'enregistrée, pas réécrite par `url.<base>.insteadOf`), ajouté ou corrigé ; quand il change, `refs/remotes/origin/main` est oublié pour que `main` soit poussé sur le nouveau dépôt. En avance d'après `origin/main` connu localement, sans `fetch`. `git push -u origin main` avec `GIT_TERMINAL_PROMPT=0` et `GIT_SSH_COMMAND="<ssh de l'Utilisateur> -o BatchMode=yes"` (`$GIT_SSH_COMMAND`, sinon `core.sshCommand`, sinon `ssh`), délai de 120 s (dépassé : `remote-unreachable`). `classifyPushFailure` (exportée) lit la sortie de git ; ce qu'elle ne reconnaît pas est `remote-unreachable`. Message : `git push failed: ` + stderr sans les lignes `hint:`, 500 caractères au plus. `status.lastPush.at` à chaque push réussi, repris du tour précédent sinon ; `RoundResult.pushed`. Journal : `<iso> Pushed to origin.` ; `--once` ajoute ` Pushed.`. Tests avec un dépôt nu local et un serveur HTTP local qui répond 401 (problème `auth`, sans blocage). 615 tests, typage sans erreur.
- 2026-11-06 : relecture à deux axes. Spec : corrigés avant le commit : un tour sauté pour `index.lock` poussait quand même ; une URL réécrite par `insteadOf` ne correspondait jamais à `config.remote` et relançait un push à chaque tour. Assumés hors ticket : délai de 120 s, oubli de `origin/main` au changement de dépôt, lignes de journal du push. Restent ouverts : `main` est supposé (un dépôt existant sur une autre branche donnerait un `remote-unreachable` trompeur) ; `GIT_SSH` (sans `_COMMAND`) est masqué ; un `[remote rejected]` (hook, branche protégée) est classé `push-rejected` ; `since` repart à zéro quand la nature du problème change. Standards : aucune violation ; jugements : `pushCommits` mêle remote, avance, environnement et classement, son retour `"skipped" | "pushed" | objet` gagnerait à être une union étiquetée, `main`/`origin` en dur.
