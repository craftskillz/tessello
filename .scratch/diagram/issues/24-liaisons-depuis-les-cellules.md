# 24 : Tirer des liaisons depuis les cellules d'un tableau

Status: resolved

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`. Suite du ticket 19 (forme Tableau).

## Demande

Sur un tableau, pouvoir tirer une liaison depuis une cellule précise, à partir des points calés sur cette cellule, plutôt que depuis les 4 flèches de liaison communes aux autres formes.

## État actuel et explication

Lecture du code le 2026-10-28 : un tableau a les 8 points d'attache d'un rectangle (`PORTS` dans `src/lib/geometry.ts`). En mode Sélection, il montre les 4 flèches de liaison de toutes les formes, placées à 14 pixels à l'extérieur du milieu de chaque côté, juste à côté des poignées de côté du ticket 19.

Les formes personnalisées ont déjà des points d'attache libres, leurs ancres, données à la géométrie par `outlineOf` (`src/lib/library.ts`). `portsOf`, `portPoint` et `portDirection` les utilisent, mais seulement pour le type `custom`. L'outil Flèche, le tracé des flèches et l'export draw.io (`portOn`) passent tous par ces fonctions. Une flèche attachée à un point qui n'existe plus redevient automatique (`src/lib/arrows.ts`).

## Décisions (2026-10-28)

- Chaque cellule a ses propres points, avec des noms distincts, même lorsque deux cellules voisines ont un point au même endroit. Une flèche est ainsi rattachée à une cellule.
- Seuls les points situés sur le bord extérieur du tableau existent. Une cellule intérieure n'en a aucun ; une cellule de coin en a 5 ; une cellule de bord en a 3 (un seul rang ou une seule colonne : davantage).
- Le tableau n'a plus ses 8 points de contour de rectangle : seulement ceux des cellules. Une flèche attachée automatiquement (sans point) part toujours du contour.

## Proposition de réalisation

- `src/lib/table.ts` : une fonction pure qui donne les ancres d'un tableau à partir de ses cellules et de ses largeurs de colonnes, en parts de sa largeur et de sa hauteur, avec des noms stables tels que `r1c2-NE` (ligne, colonne, direction de la cellule).
- `src/lib/geometry.ts` : utiliser les ancres d'une forme qui en a, au lieu de les réserver au type `custom`. Une ancre peut porter sa direction : vers l'extérieur du côté où elle se trouve, en diagonale pour un coin du tableau. Sans elle, la direction se calcule depuis le centre, comme aujourd'hui.
- `outlineOf` donne au tableau ses ancres, comme aux formes personnalisées.
- Mode Sélection : sur un tableau, les 4 flèches de liaison sont remplacées par les points de la cellule survolée. Le point d'attache reste sur le bord, mais sa poignée est décalée vers l'extérieur, comme les flèches de liaison actuelles. Elle ne doit pas recouvrir les poignées de côté ni les poignées de coin du ticket 19 : avec 3 colonnes, le point `N` de la cellule du milieu tombe exactement sur la poignée du côté haut.

## Critères d'acceptation

- [x] Survoler une cellule de bord montre ses points ; une cellule intérieure n'en montre aucun.
- [x] Une liaison tirée depuis un point d'une cellule part de ce point ; l'outil Flèche vise aussi ces points, au départ comme à l'arrivée.
- [x] Les flèches suivent leur cellule lorsqu'une colonne est élargie, le tableau redimensionné, tourné ou déplacé.
- [x] Ajouter des lignes ou des colonnes conserve les attaches existantes ; en retirer rend automatique une flèche dont le point disparaît, ou dont le point n'est plus sur le bord.
- [x] Les tracés en coude partent perpendiculairement au bord du tableau.
- [x] Les poignées de liaison, de côté, de coin et de rotation restent toutes accessibles, sans chevauchement, à tous les zooms.
- [x] L'export draw.io place les extrémités sur les mêmes points.
- [x] Les formes personnalisées et les autres formes gardent leurs points actuels.
- [x] Tests unitaires des ancres et de leur suivi ; tests navigateur du survol, du tirage d'une liaison depuis une cellule et du redimensionnement d'une colonne. Guide d'utilisation mis à jour.

## Comments

- 2026-10-28 : demande recueillie après la réalisation du ticket 19 ; aucun code du Module modifié.

### Implémentation (2026-10-28)

- Code et tests dans `../tessello-diagram/`, sur `main`. `tableAnchors` et `cellAnchors` (`src/lib/table.ts`) donnent les points de bord de chaque cellule, nommés `r{ligne}c{colonne}-{direction}` à partir de 0, chacun orienté vers l'extérieur (en diagonale aux coins du tableau). `geometry.ts` utilise les ancres de toute forme qui en a ; `outlineOf` les donne au tableau. L'outil Flèche, le tracé, le suivi et l'export draw.io en profitent sans code propre au tableau.
- Mode Sélection : survoler une cellule de bord montre ses points ; les 4 flèches de liaison communes ne s'affichent plus sur un tableau. Pour ne recouvrir ni les poignées de côté et de coin (jusqu'à 5 pixels hors du bord), ni celles de rotation (à partir de 18 pixels), les poignées de cellule sont plus petites (rayon 4,5 pixels au lieu de 9) et placées à 13 pixels vers l'extérieur.
- Validation : 290 tests unitaires et 56 tests navigateur réussis, dont un test de non-chevauchement à 51 %, 100 % et 156 %. Typage sans erreur. Revues Standards et Spec faites ; le format des noms de points n'est plus analysé dans la Vue, et le guide précise le cas d'un point qui quitte le bord quand on ajoute une ligne.
- Non couvert par un test : un tracé en coude depuis un point de coin du tableau ; les libellés français des poignées.

### Retours de test (2026-10-28)

- Les poignées de cellule ont maintenant la taille des flèches de liaison des autres formes (rayon 9 pixels, même flèche), à 15 pixels vers l'extérieur. Sur un tableau, la poignée de rotation est remontée (tige de 36 pixels au lieu de 26) pour rester hors de leur portée.
- Un tableau n'a plus de rotation du texte seul : ni poignée « T », ni boutons dans le panneau. Le texte des cellules ignore `textRotation` ; il tourne seulement avec le tableau. L'export draw.io ne compte plus de rotation perdue pour un tableau.
- Validation : 291 tests unitaires et 56 tests navigateur réussis, typage sans erreur.
