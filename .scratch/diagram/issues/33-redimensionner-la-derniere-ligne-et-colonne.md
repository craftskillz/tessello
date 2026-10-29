# 33 : Redimensionner la dernière colonne et la dernière ligne d'un tableau

Status: resolved

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`. Prolonge les tickets 19 (colonnes) et 29 (lignes).

## Demande

Dans un tableau, on peut changer la largeur de chaque colonne et la hauteur de chaque ligne, mais pas celles de la dernière colonne ni de la dernière ligne. Il faut pouvoir les redimensionner aussi.

## État actuel et explication

Lecture du code le 2026-10-29 : `Canvas.svelte` dessine une poignée invisible (`.dg-separator`) par séparation intérieure seulement : `columnEdges(shape).slice(1, -1)` et `rowEdges(shape).slice(1, -1)`. Le bord droit et le bord bas n'en ont pas. Le modèle sait déjà les traiter : `dragSeparator` et `dragRowSeparator` acceptent l'index de la dernière colonne ou ligne (« The last column's separator is the right side of the table »). Les poignées de côté `e` et `s` (`resizeSide`) redimensionnent tout le tableau en gardant les proportions.

## Choix retenus

- Le bord droit sert de séparation à la dernière colonne et le bord bas à la dernière ligne : on les glisse comme les autres séparations (curseurs `col-resize` / `row-resize`), le côté gauche et le haut restent fixes.
- Les poignées de côté et de coin restent au-dessus de ces bandes et gardent leur rôle (redimensionner tout le tableau en proportion).

## Critères d'acceptation

- [x] Glisser le bord droit change la largeur de la dernière colonne seule (bornée à `MIN_COLUMN`), y compris pour un tableau tourné ; idem pour le bord bas et la dernière ligne (bornée à `MIN_ROW`).
- [x] Les poignées de côté et de coin, les poignées de liaison des cellules et les barres de sélection gardent leur rôle et ne sont pas couvertes.
- [x] Annuler rétablit la taille d'avant.
- [x] Guide mis à jour si besoin ; test navigateur dans `e2e/tables.test.ts`.

## Comments

- 2026-10-29 : demande recueillie (« toutes sauf la dernière, c'est un problème »).
- 2026-10-29 : réalisé dans `tessello-diagram` (d5b9a82). `Canvas.svelte` dessine une bande par séparation, bords droit et bas compris (`columnEdges(shape).slice(1)`, `rowEdges(shape).slice(1)`), placée avant les poignées de coin et de côté, qui restent au-dessus. Guide : une phrase par puce de séparateur. Tests navigateur dans `e2e/tables.test.ts` : bord droit et bord bas, droit puis tourné de 30°, annulation, et la poignée de côté qui garde les proportions. Suite complète verte (391 unitaires, 78 navigateur), typage sans erreur.
- 2026-10-29 : relecture à deux axes (Standards, Spec). Corrigé : bandes pleine longueur (la première version ne couvrait qu'une moitié du bord), guide mis à jour, aides du test regroupées avec les autres. Reste ouvert : là où une poignée de liaison d'une cellule (au survol) se trouve sur le bord, c'est elle qui prend le pointeur ; le plancher `MIN_COLUMN`/`MIN_ROW` du dernier élément n'a pas de test navigateur (il est couvert par les tests unitaires de `dragSeparator`/`dragRowSeparator`) ; les blocs colonne et ligne restent jumeaux.
