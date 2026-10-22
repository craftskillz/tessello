# 04: Tags et lignes par tag

Spec parente : `.scratch/watch-later/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** On range les vidéos par tags, et la Vue les présente en lignes par tag : chaque ligne défile horizontalement, la page défile verticalement.

**Blocked by:** 03 (Panneau de détail)

**Status:** resolved

### Tags

- [x] Le panneau de détail permet d'ajouter un tag (saisie avec suggestions parmi les tags existants, Entrée valide) et de retirer un tag (×).
- [x] Les tags sont normalisés : espaces en trop retirés, pas de tag vide, pas de doublon quelle que soit la casse (la casse du premier usage est gardée).
- [x] Le champ d'ajout permet de choisir un ou plusieurs tags qui seront posés sur les prochaines vidéos ajoutées (retenus jusqu'à la fermeture de la Vue).

### Lignes

- [x] Une ligne par tag, par ordre alphabétique, puis « Sans tag » en dernier. Une vidéo à plusieurs tags apparaît dans chaque ligne. Chaque ligne affiche son nom et son nombre de vidéos.
- [x] Dans une ligne, les plus récentes d'abord. Une ligne vide (par exemple quand ses vidéos vues sont cachées) n'est pas affichée.
- [x] Les lignes défilent horizontalement (trackpad, Maj+molette, toucher), avec des boutons ‹ › sur ordinateur qui défilent d'une largeur d'écran. La page défile verticalement.
- [x] La disposition marche de 360 px à la largeur d'un ordinateur (§7.2).
- [x] Tests unitaires : regroupement en lignes et tri, normalisation des tags.
- [x] Test navigateur : deux tags donnent deux lignes, une vidéo à deux tags est dans les deux, et retirer son dernier tag la place dans « Sans tag ».
