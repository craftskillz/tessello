# 29 : Redimensionner la hauteur de chaque ligne d'un tableau

Status: ready-for-agent

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`.

## Demande

Pouvoir changer la hauteur de chaque ligne d'un tableau en glissant la séparation entre deux lignes, comme on change déjà la largeur d'une colonne.

## État actuel et explication

Lecture du code le 2026-10-29 : `src/lib/table.ts` indique que toutes les lignes ont la même hauteur. La forme stocke `columns`, la part de la largeur de chaque colonne, mais aucune valeur équivalente pour les lignes. `cellAt`, `cellBox`, `tableAnchors`/`cellAnchors` et le rendu divisent `shape.h` par le nombre de lignes. Le canevas dessine une poignée invisible par séparation de colonnes (`columnEdges`, `dragSeparator`, `TablePart` `{ column }`), et aucune pour les lignes. `MIN_ROW` (12) existe déjà comme hauteur minimale.

## Proposition de périmètre

Symétrique des colonnes :

- champ `rows` (parts de la hauteur), lu par `readTable` avec un repli sur des parts égales ;
- `rowEdges` et une séparation glissable entre deux lignes (`{ row }`), qui garde le haut du tableau fixe et fait grandir ou rétrécir sa hauteur ;
- ajout et retrait de lignes (`setRowCount`) qui donnent aux nouvelles la hauteur moyenne ;
- redimensionner le tableau garde les proportions des lignes.

## Critères d'acceptation

- [ ] Une poignée, avec le curseur `row-resize`, entre deux lignes change la hauteur de la ligne au-dessus, bornée à `MIN_ROW`, y compris pour un tableau tourné.
- [ ] Les cellules, leur texte, leur sélection, la saisie et les points d'attache des cellules (ticket 24) suivent les hauteurs réelles.
- [ ] Les anciens diagrammes, sans `rows`, s'ouvrent avec des lignes égales.
- [ ] Sauvegarde/rechargement, annuler/rétablir, copier/coller et ajout ou retrait de lignes préservent les hauteurs.
- [ ] Les exports PNG et draw.io gardent la hauteur de chaque ligne.
- [ ] Guide mis à jour ; tests unitaires (`table.ts`, lecture, draw.io) et test navigateur dans `e2e/tables.test.ts`.

## Comments

- 2026-10-29 : demande recueillie ; aucun code du Module modifié.
