# 01 : Tirer une flèche depuis les quatre côtés d'une forme intégrée ou d'une image

**Status:** resolved

**Blocked by:** Aucun (peut commencer immédiatement ; les connexions, l'historique et les valeurs par défaut existent déjà).

Spec parente : [tirer une flèche depuis une forme](../spec.md). Les hypothèses et règles communes de cette spec font partie des critères de ce ticket.

**What to build:** Avec l'outil Sélection, l'Utilisateur survole une forme intégrée ou une image, puis tire depuis l'une des quatre poignées pour tracer une flèche. Il peut relier une autre forme ou laisser l'arrivée libre, sans choisir l'outil Flèche. Le geste fonctionne de bout en bout, avec aperçu, enregistrement, annulation et découverte dans le Guide d'utilisation.

## Critères d'acceptation

- [x] Au survol, et sur une forme sélectionnée seule, quatre poignées reconnaissables proposent le haut, la droite, le bas et la gauche. Elles sont atteignables depuis la forme sans disparaître ; quitter la zone les masque selon les règles de la spec.
- [x] Le comportement couvre Rectangle, Ellipse, Base de données, Cercle, Acteur, Post-it, Texte libre et Image. La source utilise respectivement N, E, S ou W sur le contour réel et suit rotation et redimensionnement.
- [x] La taille et la zone de prise des poignées restent constantes à l'écran. Le geste vise le bon point avec zoom et panoramique ; il reste utilisable aux bornes de zoom autorisées.
- [x] Le glisser depuis une poignée ne déplace pas la forme. Le déplacement depuis son corps, le redimensionnement, la rotation, la sélection multiple, les groupes et le panoramique conservent les priorités définies dans la spec.
- [x] Une forme verrouillée, une sélection multiple, la saisie de texte et les autres outils ne proposent pas ces poignées. Les formes personnalisées sont traitées par le ticket 02 ; elles restent des cibles possibles selon les règles existantes.
- [x] Pendant le glisser, un aperçu part du point d'attache choisi et respecte le tracé par défaut. La cible montre ses points d'attache et met en évidence celui qui est visé. Maj contraint par pas de 45°.
- [x] L'arrivée réutilise les règles existantes : point nommé, attache automatique ou extrémité libre, y compris sur une forme verrouillée et pour les boucles admissibles. Aucun nouveau point d'attache ni format de données n'est ajouté.
- [x] Un clic sans glisser ou un relâchement à moins de 3 pixels écran du départ ne crée rien. Échap et `pointercancel` annulent réellement le geste, sans écriture ni entrée d'historique ; un relâchement ultérieur ne crée pas de flèche.
- [x] Une validation crée exactement une flèche selon les valeurs par défaut, sélectionne cette flèche et garde l'outil Sélection. L'enregistrement automatique, son indicateur d'échec, Annuler et Rétablir fonctionnent comme pour une création avec l'outil Flèche.
- [x] Les poignées et aperçus sont absents des exports PNG et `.drawio` et du Widget.
- [x] Les noms et infobulles existent en anglais et en français, et les poignées sont lisibles dans les deux thèmes.
- [x] Le Guide d'utilisation explique comment découvrir les poignées, tirer vers une forme ou le vide, abandonner et annuler le geste ; il distingue ce raccourci de l'outil Flèche.

## Validation attendue

- [x] Tests unitaires des décisions géométriques ajoutées : correspondance direction/point, position sur le contour avec rotation, et compensation du zoom si extraite en fonction pure.
- [x] Parcours navigateur dans l'Hôte : tirer depuis les quatre directions ; viser un point nommé, le corps d'une cible et le vide ; vérifier une source tournée et un canevas zoomé puis déplacé.
- [x] Vérifier les données enregistrées après réouverture : source attachée au point attendu, arrivée correcte, valeurs par défaut conservées. Vérifier qu'Annuler retire une seule flèche et que Rétablir la restaure.
- [x] Couvrir clic simple, Échap suivi d'un relâchement, annulation du pointeur, forme verrouillée et sélection multiple. Après chaque abandon, un nouveau tracé fonctionne.
- [x] Les parcours existants de l'outil Flèche, du déplacement, des transformations et des exports restent verts ; la construction et la validation du paquet réussissent.

## Comments

Implémenté : les quatre poignées de connexion utilisent les extrémités et la géométrie existantes, sans migration. Le geste partage les valeurs par défaut, l’aperçu, l’enregistrement et l’historique de l’outil Flèche. Le Guide d’utilisation et les libellés anglais/français sont à jour.

Validation : tests unitaires de géométrie (`sample-modules/diagram/test/geometry.test.ts`), parcours du Module construit et installé dans l’Hôte (`packages/host/e2e/diagram.test.ts`), `npm run typecheck`, suite complète `npm test` (1 071 tests) et suite complète `npm run test:browser` (189 tests). Une régression navigateur supplémentaire couvre les poignées et leur corridor au-dessus d’une forme voisine, ainsi que le survol de la forme au premier plan.

Revue : aucun constat Standards ; le constat Spec sur l’accès aux poignées près d’une autre forme a été corrigé et sa résolution confirmée.

Paquet local reconstruit avec `just module diagram` : `dist/` et `diagram.zip` à jour, Validateur sans avertissement. La seconde suite navigateur complète a réussi 189 tests sur 190 : seule la lecture concurrente d’un fichier du test d’import Survival Kit a levé `NotReadableError` ; la relance isolée de ce fichier a réussi ses 7 tests. Le test de régression final sur le corridor a également réussi après la dernière correction.
