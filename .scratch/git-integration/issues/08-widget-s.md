# 08: Le Widget S : tout va bien, alerte, ou moteur arrêté

Spec parente : `.scratch/git-integration/spec.md`. Décision : `docs/adr/0020-git-integration-et-tessello-sync-parlent-par-le-stockage-du-module.md`. Vocabulaire : `GLOSSARY.md`.

**What to build:** Le Widget montre d'un coup d'œil l'état de la sauvegarde et ouvre la Vue.

**Blocked by:** 06

**Status:** resolved

- [x] Une pastille et un mot : « À jour » (moteur actif, aucun problème), « Alerte » (un `problem` ou un dépôt public), « Arrêté » (même règle que la Vue).
- [x] L'heure du dernier commit, en date relative.
- [x] Le `status` est relu quand le Widget devient visible, puis toutes les 10 s tant qu'il l'est.
- [x] Un clic ouvre la Vue (`openView`), sur la section de l'alerte s'il y en a une (`params`).
- [x] Il remplit sa cellule 1 × 1 sans défiler, dans les deux thèmes.
- [x] Tests avec l'Hôte de test : les trois états, et l'ouverture de la Vue avec ses `params`.

## Comments

- 2026-11-06 : réalisé dans `craftskillz/tessello-git-integration` (commit `b9ce983`). La règle de l'état est `widgetState` dans `src/lib/sync.ts`, testée en Node ; le Widget (`src/widget/Widget.svelte`) est testé dans Chromium avec l'Hôte de test du SDK (`e2e/widget.test.ts`). Choix faits :
  - « Arrêté » l'emporte sur tout, même sur un dépôt public : le Widget dit d'abord que rien n'est sauvegardé. La Vue, elle, montre l'avertissement « dépôt public » même moteur arrêté (ticket 07).
  - Les `params` sont `{ section: "engine" }` pour un problème, `{ section: "settings" }` pour `no-config` (c'est là qu'on saisit le dépôt) et pour un dépôt public ; un problème l'emporte sur le dépôt public. Sans alerte, `openView()` sans `params`.
  - La Vue fait défiler jusqu'à la section demandée, à l'ouverture (`context.params`) comme quand elle est déjà chargée (`onNavigationParams`) ; une autre valeur est ignorée.
  - Le Widget n'affiche rien avant sa première lecture, pour ne pas montrer « Arrêté » à tort ; une lecture qui échoue est retentée au tour suivant.
  - Le nom accessible du bouton contient l'état et l'heure du dernier commit.
  - La lecture toutes les 10 s n'a pas de test (il faudrait une attente fixe) ; le test vérifie la relecture quand le Widget redevient visible.
  - `src/widget/main.ts` règle maintenant la langue (`setLocale`), ce qu'il ne faisait pas.
