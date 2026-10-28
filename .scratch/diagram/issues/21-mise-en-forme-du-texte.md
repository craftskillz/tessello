# 21 : Gras, italique et souligné dans la forme Texte

Status: resolved

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`.

## Demande

Pouvoir mettre le contenu de la forme Texte en gras, en italique et en souligné. D'autres styles pourront être précisés : le « … » de la demande ne constitue pas une liste arrêtée.

## État actuel et explication

Lecture du code le 2026-10-28 : `Shape.text` est une chaîne de texte brut. `Canvas.svelte` l'édite avec un `textarea`, et `ShapeView.svelte` l'affiche en SVG avec une taille et des alignements, sans propriétés de gras, d'italique ou de soulignement. `text.ts` mesure la police normale pour calculer les retours à la ligne. La limitation vient du modèle et de l'édition actuels ; le rendu SVG peut porter ces styles.

## Choix retenus

- Portée : tout le texte de la forme, par des propriétés de style au niveau de la forme (`bold`, `italic`, `underline`). Pas de style par mots.
- Formes : toutes les formes qui portent un texte, et non la seule forme Texte. Le Tableau les avait déjà, ainsi que ses cellules (ticket 25). Les étiquettes de flèches restent hors périmètre.

## Critères d'acceptation

- [x] Commandes Gras, Italique et Souligné, combinables, avec indication de leur état.
- [x] Portée conforme au choix retenu : tout le texte de la forme ; pas de sélection partielle à conserver.
- [x] Rendu cohérent pendant et après l'édition ; les mesures et les retours à la ligne tiennent compte du style réel de police.
- [x] Sauvegarde/rechargement, annuler/rétablir et copier/coller préservent les styles ; les anciens diagrammes restent lisibles avec leur apparence actuelle.
- [x] Export PNG et export draw.io conservent la mise en forme.
- [x] Interface traduite, Guide mis à jour, tests des styles et des gestes d'édition retenus.

## Comments

- 2026-10-28 : demande ajoutée au cadrage ; aucun code du Module modifié.
- 2026-10-28 : choix tranchés avec l'utilisateur : tout le texte, sur toutes les formes qui portent un texte.
- 2026-10-28 : réalisé dans `tessello-diagram` (7b9d363). `readShape` lit `bold`/`italic`/`underline` pour toute forme, seulement à `true` (absent : désactivé, les anciens diagrammes ne changent pas). `layoutText` mesure par défaut dans le gras et l'italique de la forme. « Copier le style » emporte toujours les trois styles et les colle sur toute forme, et plus seulement sur les tableaux : coller le style d'une forme sans mise en forme l'efface donc sur la cible. L'export draw.io écrit `fontStyle` (gras 1, italique 2, souligné 4, via `fontStyleOf`, partagé avec les cellules), sauf sur la forme d'un tableau, dont les cellules portent le leur. Le PNG copiait déjà les styles calculés. Dans le panneau, le groupe Gras/Italique/Souligné s'affiche pour toute sélection. `ShapeView` dessine le texte dans le style de la forme, et l'éditeur de texte l'affiche dans ce même style. Guide mis à jour (panneau, copier le style). Tests unitaires (lecture, retours à la ligne, copier le style, draw.io) et test navigateur `e2e/shapes.test.ts` (rectangle et texte libre : état des boutons, enregistrement, rendu, éditeur, annuler/rétablir, rechargement). Suite complète verte (319 unitaires, 64 navigateur).
- 2026-10-28 : relecture à deux axes (Standards, Spec) : rien de bloquant. Reste ouvert, au choix : les trois booléens circulent sous plusieurs formes (`Font`, `CellStyle`, paramètre de `fontStyleOf`, attributs SVG répétés dans `ShapeView`) et pourraient partager un même type ; les commandes s'affichent aussi pour une image sans texte ; les valeurs par défaut d'un type de forme n'incluent pas ces styles.
