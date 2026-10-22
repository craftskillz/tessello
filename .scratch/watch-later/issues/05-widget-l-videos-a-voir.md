# 05: Widget L : les vidéos à voir

Spec parente : `.scratch/watch-later/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Le Widget du Module, de taille L (2 × 2), est un aperçu des vidéos à voir et un point d'entrée vers la Vue.

**Blocked by:** 01 (Squelette)

**Status:** ready-for-agent

- [ ] L'en-tête affiche le nombre de vidéos à voir et un bouton « Open ↗ » qui ouvre la Vue (`navigation.openView`).
- [ ] Le Widget montre en grille les miniatures (avec le titre) des 4 vidéos à voir ajoutées le plus récemment. Un clic ouvre la vidéo sur YouTube dans un nouvel onglet.
- [ ] S'il n'y a aucune vidéo à voir, le Widget affiche un message et un bouton « + Ajouter » qui ouvre la Vue.
- [ ] Le Widget relit le stockage quand il redevient visible, ne défile pas et s'adapte à sa cellule (§7.1).
- [ ] Test navigateur : le Widget affiche une vidéo ajoutée dans la Vue, et ne l'affiche plus une fois marquée comme vue.
