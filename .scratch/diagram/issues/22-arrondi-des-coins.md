# 22 : Régler l'arrondi des coins des rectangles

Status: resolved

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`.

## Demande

Pouvoir choisir des coins carrés ou plus arrondis sur les formes, avec le rectangle comme cas explicite.

## État actuel et explication

Lecture du code le 2026-10-28 : `ShapeView.svelte` dessine les rectangles avec `rx="6"`, fixé dans le rendu, et le modèle `Shape` ne stocke aucun rayon. L'export draw.io fixe lui aussi l'arrondi (`rounded=1`, `absoluteArcSize=1`, `arcSize=12`). C'est donc une valeur de présentation fixe, pas une contrainte du moteur SVG.

## Proposition de périmètre

Commencer par les rectangles, avec un champ numérique et un curseur « Arrondi des coins » dans les propriétés. Rayon exprimé en unités du diagramme, identique aux quatre coins : 0 donne des coins carrés ; 6 conserve l'apparence actuelle. Le rayon effectif ne dépasse pas la moitié du plus petit côté. Lors du redimensionnement, conserver le rayon demandé et borner seulement son rendu.

La demande évoque aussi les autres formes. Leur périmètre est à préciser : une ellipse n'a pas de coins, un Post-it a un coin plié, et une image demanderait un découpage de son contenu. Ne pas leur appliquer automatiquement le réglage du rectangle.

## Critères proposés

- [x] Réglage visible pour un rectangle, de 0 jusqu'au maximum utile, avec aperçu immédiat.
- [x] Les rectangles des anciens diagrammes conservent leur arrondi actuel ; une valeur explicite de 0 est préservée à la lecture.
- [x] Les points d'attache et les extrémités automatiques des flèches suivent le contour arrondi, y compris près des coins et après rotation. Aujourd'hui `geometry.ts` traite le contour du rectangle comme carré : revoir ce calcul lorsque le rayon devient significatif.
- [x] Sauvegarde/rechargement, annuler/rétablir et copier/coller préservent le rayon ; la copie de style le transmet entre rectangles.
- [x] Le rendu du canevas et les exports PNG et draw.io restent cohérents.
- [x] Interface traduite et Guide mis à jour ; tests ciblés du rayon, de la compatibilité des anciennes données et des attaches.

## Comments

- 2026-10-28 : proposition ajoutée au cadrage ; extension au-delà du rectangle à trier. Aucun code du Module modifié.
- 2026-10-29 : réalisé dans `tessello-diagram` (2863195), pour les rectangles seulement ; l'extension aux autres formes reste à trier. `Shape.cornerRadius` (rectangles seulement, `CORNER_RADIUS` = 6 à la création et à la lecture d'un rectangle qui n'en a pas ; 0 explicite conservé). `cornerRadiusOf` (`geometry.ts`) borne le rendu à la moitié du plus petit côté ; `outlineFactor` suit l'arc des coins (`roundedFactor`), d'où les extrémités automatiques, les points d'attache, `contains` et `exitPoint`, y compris après rotation. Panneau : curseur et champ « Arrondi des coins » quand toute la sélection est faite de rectangles, chacun borné à son propre maximum utile ; aperçu au curseur, une étape d'annulation. Copie de style : le rayon passe d'un rectangle aux rectangles seulement. draw.io : `arcSize` = 2 × rayon effectif, `rounded=0` à 0 ; PNG via `ShapeView`. Guide et traductions mis à jour. Tests : unitaires (lecture, géométrie, presse-papiers, draw.io) et un test navigateur dans `e2e/panel.test.ts`. Suite complète verte (359 unitaires, 71 navigateur), typage sans erreur.
- 2026-10-29 : le port NE d'un rectangle par défaut se trouve désormais sur l'arc, à (257,6 ; −28,8) au lieu de (260 ; −30) pour un rectangle de 120 × 60 centré en (200 ; 0) : attendu par le critère des attaches ; l'attente de `e2e/arrows.test.ts` est mise à jour en conséquence.
- 2026-10-29 : relecture à deux axes (Standards, Spec). Corrigé : un rayon saisi sur plusieurs rectangles était borné par le plus petit d'entre eux ; chaque rectangle est maintenant borné par le sien. Retouche du commentaire d'en-tête de `ShapePanel`. Reste ouvert (jugement) : le test `type === "rect"` se répète en plusieurs endroits ; pas de test PNG dédié à un rayon non par défaut.
