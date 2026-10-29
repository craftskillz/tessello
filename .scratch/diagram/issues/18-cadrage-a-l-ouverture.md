# 18 : Centrer et ajuster le diagramme à l'ouverture

Status: resolved

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`.

## Demande

À l'ouverture, montrer le diagramme entier et centré sans devoir dézoomer manuellement. Ajuster la vue, sans modifier les dimensions enregistrées des formes.

## État actuel et explication

Lecture du code le 2026-10-28 : l'effet d'ouverture de `src/view/Canvas.svelte` remet explicitement `zoom` à 1 et place l'origine au centre du canevas. Il ne calcule pas le centre du contenu. Un dessin étendu ou décalé peut donc sortir de la vue. La commande `fit()` calcule déjà le cadrage des formes et des flèches, avec une marge de 40 pixels ; `fitView()` plafonne à 100 % pour ne pas agrandir les petits dessins. Ce comportement n'a pas encore été reproduit par un test dédié.

## Critères d'acceptation

- [x] Une ouverture depuis la liste, un lien ou le Widget centre le contenu et le rend visible avec une marge.
- [x] Un petit diagramme reste au maximum à 100 %. Un diagramme vide s'ouvre à 100 %, origine centrée.
- [x] Le calcul attend des dimensions de canevas utilisables ; il prend en compte les formes tournées et les flèches libres.
- [x] Le cadrage automatique ne se répète pas pendant l'édition, l'annulation ou une simple relecture du même diagramme. Le zoom manuel reste utilisable.
- [x] Aucun déplacement ni redimensionnement des objets n'est écrit dans le stockage du fait du cadrage.
- [x] Test navigateur ciblé avec un dessin étendu et décentré, puis passage à un autre diagramme ; vérification du maintien du cadrage manuel pendant l'édition.

## Comments

- 2026-10-28 : demande recueillie ; implémentation à faire dans le dépôt du Module.

### Implémentation (2026-10-28)

- Code et tests dans `../tessello-diagram/`, commit `b6aff3a` sur `main` : cadrage à l'ouverture, une fois les dimensions du canevas utilisables. Une relecture du même diagramme, une modification ou une annulation préserve le zoom et le déplacement manuels.
- Le cadrage réutilise `fit()` et inclut désormais les courbes des flèches, en plus des formes tournées et des extrémités libres. Aucun objet n'est déplacé ou redimensionné dans le stockage.
- Cinq tests navigateur dédiés dans `e2e/viewport.test.ts` couvrent les ouvertures par liste, lien et Widget, les petits diagrammes et les diagrammes vides, les dimensions différées, le cadrage manuel et les flèches courbes. Le guide décrit le nouveau comportement.
- Validation : 234 tests unitaires et 48 tests navigateur réussis, typage sans erreur, paquet installable avec 0 avertissement. Revues Standards et Spec : aucun constat restant.
