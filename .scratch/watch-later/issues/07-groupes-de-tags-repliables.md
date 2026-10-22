# 07: Groupes de tags repliables

Spec parente : `.scratch/watch-later/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Deux niveaux de tags. Un tag écrit `Groupe/Tag` (par exemple `Musique/Jazz`) range la vidéo dans le tag `Jazz` du groupe `Musique`. La Vue montre chaque groupe comme une section repliable qui contient une ligne par tag du groupe. Les tags sans groupe restent des lignes simples, à côté des sections.

**Blocked by:** 04

**Status:** resolved

### Modèle

- [x] Le modèle ne change pas : `tags` reste une liste de chaînes. Les données déjà enregistrées restent valides, sans migration.
- [x] Le groupe est ce qui précède le premier `/`. Les espaces autour du `/` sont retirés (`Musique / Jazz` vaut `Musique/Jazz`). Un côté vide ne compte pas : `Musique/` vaut `Musique`, et `/` seul n'est pas un tag.
- [x] Le groupe garde la casse de son premier usage : `musique/Rock` s'écrit `Musique/Rock` quand `Musique/Jazz` est déjà là.

### Vue

- [x] Les groupes et les tags sans groupe sont classés ensemble par ordre alphabétique, puis vient « Sans tag ».
- [x] Une section de groupe affiche son nom et son nombre de vidéos (chaque vidéo comptée une seule fois). Dans la section, il y a une ligne par tag, par ordre alphabétique.
- [x] Un tag simple qui porte le nom d'un groupe (`Musique` à côté de `Musique/Jazz`) est la première ligne de ce groupe.
- [x] Un clic sur l'en-tête replie ou déplie la section (`aria-expanded`). Le choix est retenu dans `settings.collapsed`.
- [x] Une section dont toutes les vidéos sont cachées n'est pas affichée.
- [x] Le Widget et la Home ne changent pas.
- [x] Tests unitaires : normalisation avec `/`, casse du groupe, regroupement en sections et ordre, lecture de `settings.collapsed`.
- [x] Test navigateur : deux tags d'un groupe donnent une section avec deux lignes, la section se replie, et elle reste repliée après un rechargement.
