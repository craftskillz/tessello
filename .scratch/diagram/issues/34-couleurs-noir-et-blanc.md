# 34 : Ajouter les couleurs Noir et Blanc à la palette

Status: resolved

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`. Suit le ticket 30 (Jaune).

## Demande

Ajouter à la palette une couleur noire et une couleur blanche.

## État actuel et explication

Lecture du code le 2026-10-30 : la palette `COLORS` (`src/lib/diagram.ts`) compte 16 clés, de `c-gray` à `c-indigo`. Chaque clé définit un fond, une bordure et un texte (`--fill`, `--stroke`, `--text`) en clair et en sombre dans `src/lib/base.css`. Les valeurs claires sont reprises dans `PALETTE` (`src/lib/drawio.ts`). Les couleurs claires actuelles sont des fonds pâles qui deviennent foncés en thème sombre. Aucune ne donne un blanc pur ou un noir pur. La grille des pastilles (`.dg-swatches`, `base.css`) a 8 colonnes et ses 2 rangées sont pleines : deux couleurs de plus ouvrent une 3e rangée. Une flèche prend la bordure de sa couleur (`ArrowPanel.svelte`).

## Choix retenus

- Deux nouvelles clés `c-white` (« Blanc » / « White ») et `c-black` (« Noir » / « Black »), placées en tête de palette, avant `c-gray`.
- Blanc : fond `#ffffff`, bordure `#a8a29e`, texte `#1c1917`.
- Noir : fond `#000000`, bordure `#000000`, texte `#ffffff`.
- Thème sombre : Noir et Blanc gardent leur fond dans les deux thèmes. Seule la bordure du Noir s'éclaircit en sombre (`#71717a`), pour qu'une flèche noire reste visible.
- Grille : 9 colonnes, 2 rangées pleines de 9 pastilles.

## Critères d'acceptation

- [x] Les pastilles Blanc et Noir apparaissent dans les panneaux des formes et des flèches, dans le style des cellules et dans la boîte des Valeurs par défaut.
- [x] Une forme blanche reste distincte du fond en clair, une forme noire et une flèche noire restent visibles en sombre. Le texte garde un contraste suffisant sur les deux fonds.
- [x] Sauvegarde/rechargement et valeurs par défaut acceptent `c-white` et `c-black` ; les diagrammes existants ne changent pas.
- [x] Les exports PNG et draw.io rendent les deux couleurs.
- [x] Interface traduite, tests mis à jour (palette, draw.io).

## Comments

- 2026-10-30 : demande recueillie ; aucun code du Module modifié. À trancher avec l'utilisateur : comportement en thème sombre, place dans la palette, disposition de la grille.
- 2026-10-30 : choix tranchés avec l'utilisateur : fonds conservés en sombre (seule la bordure du Noir passe à `#71717a`), Noir et Blanc en tête de palette, grille de 9 colonnes, noir pur `#000000`.
- 2026-10-30 : réalisé dans `tessello-diagram` (4ff0051). `c-white` et `c-black` ajoutés en tête de `COLORS`, avant `c-gray` ; variantes claire et sombre dans `base.css` ; `.dg-swatches` passe à `repeat(9, 1fr)` ; mêmes valeurs claires dans `PALETTE` de `drawio.ts` ; le PNG lit les variables CSS. Libellés en et fr. Panneaux, style des cellules et Valeurs par défaut itèrent `COLORS` ; la validation des valeurs par défaut (`oneOf(COLORS)`) accepte les deux clés, et le chargement ne filtre pas les couleurs. Test unitaire ajouté dans `test/defaults.test.ts` (rouge puis vert) ; le test draw.io de la palette couvre les nouvelles clés. 392 tests unitaires verts, typage sans erreur ; suite navigateur non lancée.
- 2026-10-30 : relecture à deux axes (Standards, Spec) : aucune violation ni écart. Reste ouvert : aucun test ne fixe la variante sombre (bordure `#71717a` du Noir) ni l'ordre de la palette ; la visibilité du Noir sur le fond sombre de l'Hôte n'a pas été vérifiée à l'œil ; la ligne `.dark .c-white` répète la claire, gardée pour l'appariement clair/sombre du fichier.
