# 29 : Redimensionner la hauteur de chaque ligne d'un tableau

Status: resolved

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

- [x] Une poignée, avec le curseur `row-resize`, entre deux lignes change la hauteur de la ligne au-dessus, bornée à `MIN_ROW`, y compris pour un tableau tourné.
- [x] Les cellules, leur texte, leur sélection, la saisie et les points d'attache des cellules (ticket 24) suivent les hauteurs réelles.
- [x] Les anciens diagrammes, sans `rows`, s'ouvrent avec des lignes égales.
- [x] Sauvegarde/rechargement, annuler/rétablir, copier/coller et ajout ou retrait de lignes préservent les hauteurs.
- [x] Les exports PNG et draw.io gardent la hauteur de chaque ligne.
- [x] Guide mis à jour ; tests unitaires (`table.ts`, lecture, draw.io) et test navigateur dans `e2e/tables.test.ts`.

## Comments

- 2026-10-29 : demande recueillie ; aucun code du Module modifié.
- 2026-10-29 : réalisé dans `tessello-diagram` (ab03861). Modèle : champ `rows` (parts de la hauteur) créé avec le tableau et lu par `readTable` avec repli sur des parts égales, comme `columns`. `src/lib/table.ts` gagne `rowEdges` et `dragRowSeparator` (seule la ligne au-dessus change, bornée à `MIN_ROW`, haut du tableau fixe) ; `cellBox`, `cellAt` et `tableAnchors` suivent les hauteurs réelles ; `setRowCount` donne aux nouvelles lignes la hauteur moyenne ; les redimensionnements gardent les proportions des lignes, et la hauteur minimale devient `MIN_ROW` sur la ligne la plus basse. Export draw.io : chaque ligne a son `y` et sa hauteur. Canevas : une poignée `row-resize` par séparation de lignes (`{ row }`), barres de sélection des lignes et lignes de la grille sur `rowEdges`. Libellés « Resize row {n} » / « Redimensionner la ligne {n} ». Guide : une puce sur le séparateur de lignes. Tests unitaires (`table`, `diagram`, `drawio`, `arrows`, `clipboard`) et test navigateur dans `e2e/tables.test.ts` (glisser, tableau tourné de 30°, sélection de la ligne agrandie, annulation). Suite complète verte (341 unitaires, 67 navigateur), typage sans erreur.
- 2026-10-29 : relecture à deux axes (Standards, Spec). Corrigé : `columnEdges` et `rowEdges` partagent `edgesAlong`, réutilisé par `tableAnchors`. Reste ouvert : `dragRowSeparator` et `setRowCount` dupliquent encore leurs jumeaux de colonnes. Pas de test navigateur dédié au PNG, au rechargement de la page, au curseur ni au champ d'édition d'une cellule après redimensionnement d'une ligne : ils passent par `ShapeView`, `readTable` et `cellBox`, couverts par ailleurs.
