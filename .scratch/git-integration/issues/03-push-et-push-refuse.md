# 03: Push, et push refusé laissé à l'Utilisateur

Spec parente : `.scratch/git-integration/spec.md`. Décision : `docs/adr/0020-git-integration-et-tessello-sync-parlent-par-le-stockage-du-module.md`. Vocabulaire : `GLOSSARY.md`.

**What to build:** Quand `push` est vrai, la commande règle `origin` sur `remote` et pousse les commits en avance. Un push refusé devient un problème du `status`, retenté à chaque tour, jamais forcé.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `origin` est créé ou corrigé d'après `config.remote`. Un `remote` vide désactive le push.
- [ ] Si la branche locale est en avance sur `origin/main` (ou si `origin/main` n'existe pas encore) : `git push -u origin main`. Jamais de `pull`, de fusion, de rebase ni de `--force`.
- [ ] Les échecs sont classés à partir de la sortie de git : `push-rejected` (non-fast-forward), `auth` (accès refusé), `remote-unreachable` (réseau, hôte inconnu). Le `message` donne la sortie de git, raccourcie, et `since` garde la date du premier échec de la série.
- [ ] Les commits continuent en local pendant un échec. Le push est retenté à chaque tour, et le `problem` disparaît au premier push réussi.
- [ ] `lastPush.at` est mis à jour à chaque push réussi.
- [ ] git ne demande jamais rien dans le terminal (`GIT_TERMINAL_PROMPT=0`, SSH en `BatchMode`) : un identifiant manquant est un problème `auth`, pas une commande bloquée.
- [ ] Tests avec un dépôt nu local comme `origin` : premier push, push suivant, push refusé après un commit fait ailleurs, retour à la normale une fois le conflit réglé à la main, push désactivé.
