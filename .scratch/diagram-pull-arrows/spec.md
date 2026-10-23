# Spec : tirer une flèche depuis une forme

**Status:** ready-for-agent

Contexte : [Module Diagram](../diagram/spec.md), notamment les tickets 03 (connexions), 07 (annuler/rétablir), 09 (formes personnalisées), 11 (valeurs par défaut) et 16 (Guide d'utilisation), déjà résolus. Vocabulaire : `GLOSSARY.md`.

## Problème

L'Utilisateur veut pouvoir tirer une flèche depuis le haut, la droite, le bas ou la gauche d'une forme, comme dans le geste qu'il décrit dans draw.io. Aujourd'hui, le Module sait déjà tracer et attacher des flèches, mais il faut choisir l'outil Flèche. Avec l'outil Sélection, glisser une forme la déplace : aucun raccourci visible ne permet de commencer une connexion.

## Résultat attendu

Avec l'outil Sélection, survoler une forme fait apparaître quatre petites poignées directionnelles. Appuyer sur l'une d'elles, glisser, puis relâcher crée une flèche attachée à cette forme, sans changer d'outil. L'Utilisateur peut ainsi enchaîner déplacement des formes et création de connexions.

Exemple : survoler A, saisir sa poignée droite, glisser vers le point gauche de B, puis relâcher. Une flèche relie A.E à B.W ; elle est sélectionnée et l'outil Sélection reste actif.

## Hypothèses de périmètre

Les choix suivants rendent les tickets implémentables ; ce sont des propositions de conception, pas des comportements supplémentaires explicitement demandés par l'Utilisateur.

- Les poignées apparaissent au survol et restent disponibles sur une forme sélectionnée seule. Aucun changement préalable d'outil n'est nécessaire.
- Relâcher dans le vide laisse une extrémité libre, conformément au modèle existant. Une question sur ce choix a été posée à l'Utilisateur ; faute de réponse, cette valeur est le défaut retenu pour les tickets.
- Le geste crée seulement une flèche. La duplication d'une forme, la création d'une nouvelle forme à l'arrivée et un menu de choix de forme ne font pas partie de cette amélioration.
- Les directions suivent le repère et la rotation de la forme, comme ses points d'attache actuels.

## Comportement commun

### Découverte et priorité des gestes

- Quatre poignées distinctes des poignées de redimensionnement et de rotation, placées à l'extérieur des côtés. Leur taille, leur zone de prise et leur écart à la forme restent constants en pixels à l'écran, quel que soit le zoom.
- Au survol, une seule forme propose ses poignées : celle qui est au premier plan sous le pointeur. À défaut de survol, une forme sélectionnée seule les propose. Une sélection multiple ne propose pas de poignées de connexion.
- Le pointeur peut passer de la forme à une poignée sans que celle-ci disparaisse dans l'intervalle. Quitter cet ensemble masque les poignées de survol ; commencer un geste garde sa source jusqu'à la fin.
- Les poignées sont absentes pendant la saisie de texte, sur une forme verrouillée, avec un autre outil ou pendant un autre geste. Elles restent lisibles dans les thèmes clair et sombre ; leurs noms et infobulles existent en anglais et en français.
- Saisir une poignée commence une flèche ; saisir le corps de la forme continue à déplacer la sélection. Le panoramique avec Espace ou le bouton central reste prioritaire. Les poignées de transformation conservent leur fonction.
- Une poignée appartient à une forme, jamais au cadre d'un groupe. Sur une sélection multiple, même un groupe sélectionné, aucune poignée de connexion n'est proposée. Alt+clic permet toujours de sélectionner un membre seul puis de tirer depuis ce membre.

### Tracé et validation

- Pour les formes intégrées et les images, les quatre sources sont les points d'attache existants N, E, S et W, sur le contour réel de la forme. La poignée est décalée visuellement, mais le trait part du point d'attache, pas de la poignée.
- Le geste utilise le même choix d'extrémité que l'outil Flèche : point d'attache visé, sinon attache automatique sur une forme, sinon extrémité libre. Une forme verrouillée ne peut pas être source et donne une extrémité libre à l'arrivée.
- La forme cible montre ses points d'attache et celui qui est visé est mis en évidence. L'aperçu suit les extrémités visées et le tracé choisi dans les valeurs par défaut. Maj conserve la contrainte angulaire existante par pas de 45°.
- Les règles existantes sur les boucles restent valables : une forme peut être reliée à elle-même entre deux points d'attache distincts ; une attache à soi-même non admissible devient libre, comme avec l'outil Flèche.
- Un clic sans glisser, ou un relâchement à moins de 3 pixels écran du point de pression, ne crée rien. Échap ou `pointercancel` abandonne le tracé. Après abandon, un relâchement tardif ne crée rien et le canevas accepte le geste suivant.
- Avant validation, le tracé est un aperçu : aucune flèche persistée, aucune entrée d'historique, aucun déplacement de la source. L'abandon laisse les données et la sélection inchangées.
- Une validation ajoute exactement une flèche avec les valeurs par défaut courantes, la sélectionne, conserve l'outil Sélection et enregistre la modification. Un seul Annuler retire cette flèche ; Rétablir la remet. L'échec d'enregistrement utilise l'indicateur existant.

### Formes personnalisées

- Le second ticket étend le même geste aux formes personnalisées, sans leur inventer de nouveaux points d'attache.
- Pour chaque direction, choisir l'ancre existante la plus proche du milieu correspondant du cadre local : N=(0,5 ; 0), E=(1 ; 0,5), S=(0,5 ; 1), W=(0 ; 0,5). La distance est euclidienne dans les coordonnées normalisées de la définition ; en cas d'égalité, la première ancre dans cette définition gagne.
- Plusieurs directions peuvent donc choisir la même ancre. L'aperçu montre le véritable départ, même si l'ancre n'est pas au milieu du côté. Les poignées restent disposées autour des quatre côtés du cadre.
- Sans ancre, ou si la définition a été supprimée, la source est une attache automatique. Son point de sortie suit alors la destination, comme toute attache automatique ; la poignée ne garantit pas un côté de sortie fixe.
- Le choix d'ancre est capturé au début du geste. Après création, les modifications et suppressions d'ancres suivent les règles de repli existantes.

## Contraintes

- Réutiliser le modèle d'extrémités, les valeurs par défaut, la géométrie, les règles d'aimantation, l'historique et le stockage existants. Aucun nouveau format de diagramme ni migration.
- Les poignées et aperçus sont des éléments d'édition temporaires : ils n'apparaissent ni dans les PNG, ni dans les exports `.drawio`, ni dans le Widget.
- Aucun changement de Permission, de Convention ou de dépendance réseau. Les ADR existants restent applicables, notamment le Guide d'utilisation livré avec le Module (ADR 0010).
- Périmètre ordinateur, souris et clavier, Chrome et Edge, comme la spec du Module. Le tactile et un nouveau parcours complet de connexion au clavier restent hors périmètre.

## Découpage et validation

1. [Poignées et geste complet sur les formes intégrées et les images](issues/01-tirer-depuis-les-formes-integrees.md). Aucun ticket ouvert bloquant.
2. [Même geste sur les formes personnalisées](issues/02-tirer-depuis-les-formes-personnalisees.md). Bloqué par 01.

Chaque ticket livre le comportement visible, ses tests pertinents et la mise à jour du Guide d'utilisation. Les tests navigateur exercent le Module construit et installé dans l'Hôte ; les tests unitaires couvrent les choix géométriques. Conserver les parcours existants de l'outil Flèche, de déplacement, de transformation et de sélection.
