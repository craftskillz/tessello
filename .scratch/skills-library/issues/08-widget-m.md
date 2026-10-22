# 08: Widget M : répartition par Anneau et changements en attente

Spec parente : `.scratch/skills-library/spec.md`. Vocabulaire : `GLOSSARY.md` et « Vocabulaire du Module » de la spec. Contrat : la Convention.

**What to build:** Le Widget complet sur l'Accueil : il rappelle l'état de la bibliothèque et invite à publier.

**Blocked by:** 06

**Status:** resolved

- [x] Le Widget (taille **M**) montre le nombre de Skills non archivées par Anneau, la date de la dernière Édition (ou « No edition yet »), et « N changes waiting » quand N > 0 (le compteur de `changesSince`).
- [x] Un clic ouvre la Vue (`navigation.openView`). Le Widget ne télécharge rien (ADR 0013).
- [x] Le Widget relit le stockage quand il redevient visible, et suit le thème de l'Hôte.
- [x] Test navigateur : ajouter des Skills, voir les nombres ; publier, le compteur revient à zéro ; déplacer une Skill, il remonte.

## Comments

- Depuis le ticket 06, l'index `editions` (`readEditionIndex` dans `src/lib/editions.ts`, la plus récente en premier) donne la date de la dernière Édition sans lire les Éditions complètes ; le compteur en attente demande les entrées de la dernière (`storage.readEditions()` puis `changesSince`).
- Résolu : `widgetSummary(skills, editions)` (`src/lib/widget.ts`) donne le nombre de Skills non archivées par Anneau, la date de la dernière Édition et le compteur de `changesSince`. Le Widget lit les Éditions complètes (`storage.readEditions()`) et non l'index seul : une Skill *de retour* se reconnaît dans une Édition plus ancienne que la dernière. Seul le bouton « Open ↗ » ouvre la Vue, comme avant ce ticket. Le test navigateur revient à l'Accueil par le lanceur, sans recharger la page : il éprouve la relecture quand le Widget redevient visible.
