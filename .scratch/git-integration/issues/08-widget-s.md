# 08: Le Widget S : tout va bien, alerte, ou moteur arrêté

Spec parente : `.scratch/git-integration/spec.md`. Décision : `docs/adr/0020-git-integration-et-tessello-sync-parlent-par-le-stockage-du-module.md`. Vocabulaire : `GLOSSARY.md`.

**What to build:** Le Widget montre d'un coup d'œil l'état de la sauvegarde et ouvre la Vue.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] Une pastille et un mot : « À jour » (moteur actif, aucun problème), « Alerte » (un `problem` ou un dépôt public), « Arrêté » (même règle que la Vue).
- [ ] L'heure du dernier commit, en date relative.
- [ ] Le `status` est relu quand le Widget devient visible, puis toutes les 10 s tant qu'il l'est.
- [ ] Un clic ouvre la Vue (`openView`), sur la section de l'alerte s'il y en a une (`params`).
- [ ] Il remplit sa cellule 1 × 1 sans défiler, dans les deux thèmes.
- [ ] Tests avec l'Hôte de test : les trois états, et l'ouverture de la Vue avec ses `params`.
