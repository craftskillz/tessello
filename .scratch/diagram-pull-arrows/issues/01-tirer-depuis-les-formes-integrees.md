# 01 : Tirer une flèche depuis les quatre côtés d'une forme intégrée ou d'une image

**Status:** ready-for-agent

**Blocked by:** Aucun (peut commencer immédiatement ; les connexions, l'historique et les valeurs par défaut existent déjà).

Spec parente : [tirer une flèche depuis une forme](../spec.md). Les hypothèses et règles communes de cette spec font partie des critères de ce ticket.

**What to build:** Avec l'outil Sélection, l'Utilisateur survole une forme intégrée ou une image, puis tire depuis l'une des quatre poignées pour tracer une flèche. Il peut relier une autre forme ou laisser l'arrivée libre, sans choisir l'outil Flèche. Le geste fonctionne de bout en bout, avec aperçu, enregistrement, annulation et découverte dans le Guide d'utilisation.

## Critères d'acceptation

- [ ] Au survol, et sur une forme sélectionnée seule, quatre poignées reconnaissables proposent le haut, la droite, le bas et la gauche. Elles sont atteignables depuis la forme sans disparaître ; quitter la zone les masque selon les règles de la spec.
- [ ] Le comportement couvre Rectangle, Ellipse, Base de données, Cercle, Acteur, Post-it, Texte libre et Image. La source utilise respectivement N, E, S ou W sur le contour réel et suit rotation et redimensionnement.
- [ ] La taille et la zone de prise des poignées restent constantes à l'écran. Le geste vise le bon point avec zoom et panoramique ; il reste utilisable aux bornes de zoom autorisées.
- [ ] Le glisser depuis une poignée ne déplace pas la forme. Le déplacement depuis son corps, le redimensionnement, la rotation, la sélection multiple, les groupes et le panoramique conservent les priorités définies dans la spec.
- [ ] Une forme verrouillée, une sélection multiple, la saisie de texte et les autres outils ne proposent pas ces poignées. Les formes personnalisées sont traitées par le ticket 02 ; elles restent des cibles possibles selon les règles existantes.
- [ ] Pendant le glisser, un aperçu part du point d'attache choisi et respecte le tracé par défaut. La cible montre ses points d'attache et met en évidence celui qui est visé. Maj contraint par pas de 45°.
- [ ] L'arrivée réutilise les règles existantes : point nommé, attache automatique ou extrémité libre, y compris sur une forme verrouillée et pour les boucles admissibles. Aucun nouveau point d'attache ni format de données n'est ajouté.
- [ ] Un clic sans glisser ou un relâchement à moins de 3 pixels écran du départ ne crée rien. Échap et `pointercancel` annulent réellement le geste, sans écriture ni entrée d'historique ; un relâchement ultérieur ne crée pas de flèche.
- [ ] Une validation crée exactement une flèche selon les valeurs par défaut, sélectionne cette flèche et garde l'outil Sélection. L'enregistrement automatique, son indicateur d'échec, Annuler et Rétablir fonctionnent comme pour une création avec l'outil Flèche.
- [ ] Les poignées et aperçus sont absents des exports PNG et `.drawio` et du Widget.
- [ ] Les noms et infobulles existent en anglais et en français, et les poignées sont lisibles dans les deux thèmes.
- [ ] Le Guide d'utilisation explique comment découvrir les poignées, tirer vers une forme ou le vide, abandonner et annuler le geste ; il distingue ce raccourci de l'outil Flèche.

## Validation attendue

- [ ] Tests unitaires des décisions géométriques ajoutées : correspondance direction/point, position sur le contour avec rotation, et compensation du zoom si extraite en fonction pure.
- [ ] Parcours navigateur dans l'Hôte : tirer depuis les quatre directions ; viser un point nommé, le corps d'une cible et le vide ; vérifier une source tournée et un canevas zoomé puis déplacé.
- [ ] Vérifier les données enregistrées après réouverture : source attachée au point attendu, arrivée correcte, valeurs par défaut conservées. Vérifier qu'Annuler retire une seule flèche et que Rétablir la restaure.
- [ ] Couvrir clic simple, Échap suivi d'un relâchement, annulation du pointeur, forme verrouillée et sélection multiple. Après chaque abandon, un nouveau tracé fonctionne.
- [ ] Les parcours existants de l'outil Flèche, du déplacement, des transformations et des exports restent verts ; la construction et la validation du paquet réussissent.
