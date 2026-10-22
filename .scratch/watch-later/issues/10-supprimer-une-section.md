# 10: Supprimer une section entière

Spec parente : `.scratch/watch-later/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Supprimer d'un coup toutes les vidéos d'une ligne ou d'un groupe, après confirmation.

**Blocked by:** 07

**Status:** resolved

- [x] Un bouton « Supprimer » dans l'en-tête de chaque ligne (« Sans tag » comprise) et de chaque groupe, nommé « Supprimer la section X » pour un lecteur d'écran, visible au survol ou au focus, toujours sur écran tactile.
- [x] Il supprime toutes les vidéos de la section, vues comprises, même cachées. Pour un groupe : celles de tous ses tags, son propre tag compris.
- [x] La confirmation donne le nombre de vidéos, et combien sont aussi dans d'autres sections (elles en disparaissent aussi). Annuler ne supprime rien.
- [x] Tests unitaires : vidéos d'une ligne, d'un groupe, de « Sans tag », compte de celles qui sont ailleurs, suppression groupée.
- [x] Test navigateur : annuler, supprimer une ligne dont une vidéo est dans une autre section, puis un groupe.
