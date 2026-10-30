# 34 : Ajouter les couleurs Noir et Blanc à la palette

Status: needs-triage

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`. Suit le ticket 30 (Jaune).

## Demande

Ajouter à la palette une couleur noire et une couleur blanche.

## État actuel et explication

Lecture du code le 2026-10-30 : la palette `COLORS` (`src/lib/diagram.ts`) compte 16 clés, de `c-gray` à `c-indigo`. Chaque clé définit un fond, une bordure et un texte (`--fill`, `--stroke`, `--text`) en clair et en sombre dans `src/lib/base.css`. Les valeurs claires sont reprises dans `PALETTE` (`src/lib/drawio.ts`). Les couleurs claires actuelles sont des fonds pâles qui deviennent foncés en thème sombre. Aucune ne donne un blanc pur ou un noir pur. La grille des pastilles (`.dg-swatches`, `base.css`) a 8 colonnes et ses 2 rangées sont pleines : deux couleurs de plus ouvrent une 3e rangée. Une flèche prend la bordure de sa couleur (`ArrowPanel.svelte`).

## Choix proposés (à valider)

- Deux nouvelles clés `c-white` (« Blanc » / « White ») et `c-black` (« Noir » / « Black »), placées en tête de palette, avant `c-gray`.
- Blanc : fond `#ffffff`, bordure `#a8a29e` (pour que la forme reste visible sur le fond clair du canevas), texte `#1c1917`.
- Noir : fond `#000000` (ou `#18181b`), bordure `#000000`, texte `#ffffff`.
- Thème sombre : Noir et Blanc **gardent leur fond** dans les deux thèmes, puisqu'on les choisit pour leur valeur exacte. Seules les bordures s'adaptent si besoin pour rester visibles : la bordure du Noir s'éclaircit en sombre (par exemple `#71717a`), sans quoi une flèche noire disparaîtrait sur le fond du canevas.
- Grille : passer à 9 colonnes pour garder 2 rangées pleines (18 pastilles). Sinon, une 3e rangée de 2 pastilles.

## Critères d'acceptation

- [ ] Les pastilles Blanc et Noir apparaissent dans les panneaux des formes et des flèches, dans le style des cellules et dans la boîte des Valeurs par défaut.
- [ ] Une forme blanche reste distincte du fond en clair, une forme noire et une flèche noire restent visibles en sombre. Le texte garde un contraste suffisant sur les deux fonds.
- [ ] Sauvegarde/rechargement et valeurs par défaut acceptent `c-white` et `c-black` ; les diagrammes existants ne changent pas.
- [ ] Les exports PNG et draw.io rendent les deux couleurs.
- [ ] Interface traduite, tests mis à jour (palette, draw.io).

## Comments

- 2026-10-30 : demande recueillie ; aucun code du Module modifié. À trancher avec l'utilisateur : comportement en thème sombre, place dans la palette, disposition de la grille.
