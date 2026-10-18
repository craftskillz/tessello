# 05: Accueil et Widgets

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** L'Utilisateur dispose d'un Accueil qui regroupe les Widgets de ses Modules dans une grille, peut les réordonner, et passe d'un Widget à la Vue correspondante. Le Module « Notes » gagne un Widget.

**Blocked by:** 03 (Thème, visibilité, navigation et erreurs du protocole), 04 (Premier Module dans le navigateur), 04 bis (Le code et les données des Modules dans le Dossier des Modules)

**Status:** ready-for-agent

- [ ] L'Accueil affiche les Widgets des Modules installés dans une grille où S occupe 1×1 cellule, M 2×1 et L 2×2.
- [ ] L'Utilisateur peut réordonner les Widgets et l'ordre est conservé après rechargement.
- [ ] Un Module sans Widget n'apparaît pas sur l'Accueil mais reste accessible par le Lanceur.
- [ ] Le Module « Notes » propose un Widget S ; interagir avec lui ouvre sa Vue, avec des paramètres le cas échéant.
- [ ] Les Widgets masqués (Accueil caché par une Vue) et les Vues masquées reçoivent `visibility` à faux, puis à vrai quand ils redeviennent visibles.
- [ ] Un Widget qui plante ou ne termine pas son handshake est remplacé par un message d'erreur sans affecter les autres Widgets.
- [ ] Des tests navigateur couvrent l'affichage de l'Accueil, le réordonnancement et l'ouverture de la Vue depuis un Widget.
