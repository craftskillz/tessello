# 08: Widget M : répartition par Anneau et changements en attente

Spec parente : `.scratch/skills-library/spec.md`. Vocabulaire : `GLOSSARY.md` et « Vocabulaire du Module » de la spec. Contrat : la Convention.

**What to build:** Le Widget complet sur l'Accueil : il rappelle l'état de la bibliothèque et invite à publier.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] Le Widget (taille **M**) montre le nombre de Skills non archivées par Anneau, la date de la dernière Édition (ou « No edition yet »), et « N changes waiting » quand N > 0 (le compteur de `changesSince`).
- [ ] Un clic ouvre la Vue (`navigation.openView`). Le Widget ne télécharge rien (ADR 0013).
- [ ] Le Widget relit le stockage quand il redevient visible, et suit le thème de l'Hôte.
- [ ] Test navigateur : ajouter des Skills, voir les nombres ; publier, le compteur revient à zéro ; déplacer une Skill, il remonte.
