# 19 : Ajouter une forme Tableau

Status: resolved

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`.

## Demande

Une forme Tableau avec un nombre initial de colonnes, redimensionnable globalement et en hauteur, et dont chaque colonne peut changer de largeur. Lors d'un redimensionnement diagonal de l'ensemble, l'Utilisateur envisage une adaptation de la police.

## État actuel et explication

Lecture du code le 2026-10-28 : `src/lib/diagram.ts` ne définit aucun type Tableau. Une forme possède un texte unique et une taille de police, sans cellules ni dimensions de colonnes. Le geste de redimensionnement dans `Canvas.svelte` modifie la position et les dimensions, sans modifier la police. Un tableau éditable nécessite donc un modèle de cellules, un rendu et des gestes propres.

## Proposition à préciser

- Une grille de cellules éditables, initialement 3 colonnes × 3 lignes ; nombres modifiables ensuite.
- Une poignée de côté change la largeur ou la hauteur globale sans changer la police.
- Une séparation verticale ajuste une colonne. Proposition : conserver la largeur totale en compensant sur la colonne voisine, avec une largeur minimale pour chacune.
- Une poignée de coin redimensionne proportionnellement l'ensemble, police comprise ; les largeurs relatives des colonnes sont conservées.
- Le texte revient à la ligne lorsque la largeur de cellule diminue.

## Questions ouvertes

- Confirmer que chaque cellule contient du texte, ainsi que les nombres de lignes et colonnes à la création.
- Confirmer les règles proposées pour les séparateurs et les coins, et si la hauteur doit aussi se régler ligne par ligne.
- Préciser si une ligne d'en-tête distincte est souhaitée.

## Décisions (2026-10-28)

- Chaque cellule contient du texte brut. Création depuis la palette : 3 colonnes × 3 lignes ; nombres modifiables ensuite dans les propriétés.
- Séparateur de colonnes : seule la colonne déplacée change de largeur ; le tableau s'élargit ou se rétrécit d'autant, bord gauche fixe. Largeur minimale par colonne.
- Lignes de hauteur égale : seule la hauteur globale se règle, pas de séparateurs horizontaux.
- Pas de ligne d'en-tête distincte pour l'instant.
- Poignée de côté : largeur ou hauteur globale, police inchangée, largeurs relatives des colonnes conservées. Poignée de coin : redimensionnement proportionnel, police comprise.

## Critères d'acceptation

- [x] Création depuis la palette, modification du texte de chaque cellule et des nombres de lignes/colonnes.
- [x] Redimensionnements conformes aux règles retenues, y compris après rotation et zoom.
- [x] Sauvegarde/rechargement, annuler/rétablir, copier/coller et verrouillage conservent les cellules et leurs dimensions.
- [x] Les flèches peuvent s'attacher au contour du tableau et suivent ses transformations.
- [x] Les exports PNG et draw.io conservent le tableau et ses textes.
- [x] Interface traduite et Guide d'utilisation mis à jour.
- [x] Tests des dimensions et de la persistance, puis tests navigateur des gestes et de l'édition des cellules.

## Comments

- 2026-10-28 : cadrage initial ; les propositions ci-dessus ne sont pas encore des décisions validées.

### Implémentation (2026-10-28)

- Code et tests dans `../tessello-diagram/`, sur `main`. Modèle : type `table`, `cells` (texte brut par ligne et colonne) et `columns` (largeurs relatives), lus défensivement. Géométrie pure dans `src/lib/table.ts`.
- Outil « Table » dans la barre ; double-clic sur une cellule pour l'éditer, Tab / Maj+Tab entre cellules ; « Lignes » / « Colonnes » dans les propriétés (ajout et retrait en fin de tableau, le tableau grandit ou rétrécit).
- Poignées de côté (taille sans police), de coin (proportionnel, police comprise), séparateurs de colonnes (une seule colonne, le tableau s'élargit, bord gauche fixe). Chaque geste est une seule étape d'annulation.
- Export draw.io en tableau natif (`shape=table`, lignes et cellules). Le PNG et le Widget passent par le même rendu SVG.
- Validation : 270 tests unitaires et 53 tests navigateur réussis, typage sans erreur. Revues Standards et Spec faites ; petites corrections appliquées.
- Limites connues : le champ d'édition d'une cellule ignore la rotation du tableau, comme celui des autres formes. Aucun test navigateur dédié pour l'export PNG d'un tableau, le verrouillage, ni une flèche suivant un tableau redimensionné (couverts par le modèle commun et des tests unitaires). Le redimensionnement d'un groupe ne change pas la police d'un tableau.
