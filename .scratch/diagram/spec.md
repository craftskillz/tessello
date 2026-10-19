# Spec : Module Diagram

**Status:** ready-for-agent

Vocabulaire : `GLOSSARY.md`. Contrat : la Convention (`convention/CONVENTION.md`). Spec de l'Hôte : `.scratch/tessello-v1/spec.md`. Modèle de portage : le ticket 15 (`.scratch/tessello-v1/issues/15-module-survival-kit.md`) et `sample-modules/survival-kit/`.

Source du portage : l'éditeur de diagrammes de living-documentation, rétrodocumenté dans `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md` (éditeur, parcours 1 à 15, Q-013 à Q-017) et `features/diagrams/shape-editor.md` (éditeur de formes, Q-008 à Q-012). Code : `living-documentation/src/frontend-svelte/src/lib/diagram/` (instantané `d800d9a1`, version 3.66.0). Le code sert de référence de comportement, **pas** de code à copier.

## Problem Statement

L'Utilisateur dessine des diagrammes d'architecture et de processus : des formes, des flèches qui les relient, des images et des formes personnalisées. L'éditeur de living-documentation le permet, mais il est lié à un serveur Node et à un dossier de documentation, et il a des défauts gênants, constatés dans le navigateur (Playwright, 2026-10-20) :

1. **Flèches superposées.** Plusieurs flèches entre les deux mêmes formes, ou sur les deux mêmes points d'attache, sont dessinées exactement l'une sur l'autre. Une seule étiquette reste visible. Le trait passe aussi à l'intérieur de la forme de départ, à travers son texte.
2. **Flèches impossibles à sélectionner.** Une flèche courbe attachée à des points d'attache (par exemple A.N → B.N) n'est cliquable que près de son départ. Un clic au milieu ou à la fin de la courbe visible ne fait rien.
3. **Flèches libres pénibles à tracer.** Avec l'outil Flèche, un glisser dans le vide ne crée rien. Il faut deux clics, sans indice, et chaque extrémité libre est un faux nœud caché (`shapeType: "anchor"`).
4. **Pas de flèche coudée.** On ne peut pas ajouter de points à une flèche pour lui donner des angles.

La cause commune des trois premiers défauts est la même. L'éditeur repose sur vis-network, une bibliothèque de graphes à disposition automatique, détournée en éditeur de diagrammes. Une flèche y doit relier deux nœuds, d'où les faux nœuds pour les extrémités libres. Les flèches à points d'attache sont dessinées par un code à part, par-dessus une flèche « fantôme » transparente de vis-network : le dessin et la zone de clic ne coïncident donc pas.

## Solution

Le Module **Diagram** (`@tessello/diagram`, `sample-modules/diagram/`) reprend l'éditeur et l'éditeur de formes dans Tessello. Il est écrit en Svelte 5, compilé par esbuild comme le Survival Kit, et ne déclare aucune Permission. Le canevas est **reconstruit** en SVG, sur un modèle de données propre : une extrémité de flèche est **soit** attachée à une forme (point d'attache nommé, ou « automatique »), **soit** libre (une position x/y). Le dessin, la zone de clic, l'aimantation et l'ordre d'affichage découlent tous de ce seul modèle. Il n'y a ni faux nœud ni dessin fantôme.

Ce que l'original fait bien est gardé : plusieurs points d'attache par forme (on peut viser un coin plutôt que le centre), et les formes personnalisées avec leurs propres points d'attache.

## User Stories

### Diagrammes

1. En tant qu'Utilisateur, je veux créer, renommer, ouvrir et supprimer (après confirmation) plusieurs diagrammes dans une liste, afin de ranger mes dessins.
2. En tant qu'Utilisateur, je veux que chaque modification soit enregistrée aussitôt, avec un indicateur « Enregistré » ou « Échec de l'enregistrement », afin de ne jamais perdre mon travail en changeant de diagramme ou en quittant la Vue (Q-013, Q-014).
3. En tant qu'Utilisateur, je veux ouvrir la Vue directement sur un diagramme depuis le Widget, afin de reprendre mon travail en un clic.

### Formes

4. En tant qu'Utilisateur, je veux poser des Rectangles, Ellipses, Bases de données, Cercles, Acteurs, Post-it et Textes libres, puis les déplacer, les redimensionner (Maj pour garder les proportions), les tourner et écrire leur texte, afin de dessiner mon schéma.
5. En tant qu'Utilisateur, je veux régler la couleur, l'opacité du fond, la taille et l'alignement du texte, et l'ordre avant/arrière, afin de mettre en forme mon schéma.
6. En tant qu'Utilisateur, je veux que les flèches attachées suivent une forme quand je la déplace, la redimensionne ou la tourne, afin que mon schéma reste juste.

### Flèches

7. En tant qu'Utilisateur, je veux tracer une flèche d'un seul geste (appuyer, glisser, relâcher) n'importe où, chaque extrémité s'attachant à la forme sous elle ou restant libre, afin de tracer aussi bien une flèche libre qu'une flèche reliée.
8. En tant qu'Utilisateur, je veux attacher une extrémité à un point d'attache précis (coin, milieu d'un côté, ou point d'une forme personnalisée), ou la laisser automatique, afin de choisir où la flèche touche la forme.
9. En tant qu'Utilisateur, je veux que plusieurs flèches entre les mêmes formes, ou sur le même point d'attache, restent distinctes et cliquables, afin de ne jamais avoir de flèche cachée.
10. En tant qu'Utilisateur, je veux sélectionner une flèche en cliquant n'importe où sur son trait visible, à tout niveau de zoom, ou par une sélection rectangle, afin de ne jamais devoir recharger la page.
11. En tant qu'Utilisateur, je veux choisir pour chaque flèche un tracé droit, courbe ou coudé, et ajouter, déplacer ou retirer des points de passage, afin de dessiner des flèches avec des angles.
12. En tant qu'Utilisateur, je veux régler les pointes, le pointillé, l'épaisseur, la couleur et l'étiquette d'une flèche, et déplacer son étiquette en la glissant, afin de rendre la relation lisible.
13. En tant qu'Utilisateur, je veux que la suppression d'une forme libère les extrémités qui y étaient attachées, sauf si je demande aussi la suppression des flèches, afin que rien ne disparaisse sans que je l'aie demandé.

### Organisation

14. En tant qu'Utilisateur, je veux grouper et dégrouper des formes, les verrouiller et les déverrouiller, copier et coller une sélection, et copier un style sur d'autres formes, afin de travailler vite sur de grands schémas.
15. En tant qu'Utilisateur, je veux annuler et rétablir chaque modification du diagramme, afin d'essayer sans risque (Q-015).
16. En tant qu'Utilisateur, je veux une grille magnétique, des guides d'alignement et un zoom (dont « ajuster la vue »), afin de placer précisément mes formes.
17. En tant qu'Utilisateur, je veux relier une forme à une URL ou à un autre diagramme, suivre ce lien, puis revenir au diagramme d'origine, afin de naviguer entre des schémas liés.
18. En tant qu'Utilisateur, je veux fixer des valeurs par défaut pour les nouvelles formes et flèches, afin de ne pas refaire le même réglage à chaque fois (Q-016).

### Images et formes personnalisées

19. En tant qu'Utilisateur, je veux insérer une image, en la choisissant ou en la collant, avec sa légende, afin d'illustrer mon schéma.
20. En tant qu'Utilisateur, je veux savoir combien de stockage mes images occupent, et qu'une image trop lourde soit refusée avec un message clair, afin de ne pas me heurter au quota sans comprendre.
21. En tant qu'Utilisateur, je veux créer des bibliothèques de formes personnalisées à partir d'images, avec leurs points d'attache, leur placement du texte et leur visibilité dans la palette, afin de réutiliser mes icônes.

### Sortie et reprise

22. En tant qu'Utilisateur, je veux exporter la sélection en PNG et le diagramme en `.drawio`, afin de les utiliser ailleurs.
23. En tant qu'Utilisateur, je veux importer mes diagrammes, mes bibliothèques de formes et mes images de living-documentation, afin de ne pas repartir de zéro.
24. En tant qu'Utilisateur, je veux un Guide d'utilisation, afin de découvrir les gestes du Module.

## Implementation Decisions

### Paquet

- `sample-modules/diagram/`, identifiant `@tessello/diagram`, Svelte 5, construit par esbuild comme le Survival Kit (`scripts/build.ts`, `dist/` non versionné). Aucune Permission.
- La Vue et le Widget (taille **M**) respectent §4 : ni `localStorage`, ni routeur à base d'historique, ni `alert`/`confirm`/`prompt`, ni frame imbriquée. Les confirmations sont des boîtes de dialogue du Module.
- Le thème suit celui de l'Hôte, et la langue suit le `locale` du handshake (anglais par défaut, français). Il n'y a ni bouton de thème, ni texte figé dans une seule langue.
- Le Module se pilote à la souris et au clavier, sur Chrome et Edge pour ordinateur. Le tactile est hors périmètre.

### Modèle de données (un seul modèle, source de tout le rendu)

- **Forme** : `id`, `type` (`rect`, `ellipse`, `database`, `circle`, `actor`, `postit`, `text`, `image`, `custom`), `x`, `y` (centre), `w`, `h`, `rotation`, `text` et son style (taille, alignements, rotation du texte), `color`, `opacity`, `groupId`, `locked`, `link`, `z`, et selon le type `imageKey`, `customShapeRef` (bibliothèque + forme) et `labelPlacement`.
- **Flèche** : `id`, `from` et `to` de forme `Extrémité`, `route` (`straight` | `curved` | `elbow`), `waypoints` (liste de points), `heads` (`none` | `start` | `end` | `both`), `dashed`, `width`, `color`, `label` et son style (taille, largeur, rotation, position le long du trait et décalage), `locked`, `z`.
- **Extrémité** : `{ shapeId, port }` où `port` est un identifiant de point d'attache, ou `{ shapeId, port: null }` pour une extrémité automatique, ou `{ x, y }` pour une extrémité libre.
- **Points d'attache** : 8 pour les formes intégrées (N, NE, E, SE, S, SW, W, NW), posés sur le contour réel de chaque forme (cercle et ellipse sur la circonférence, base de données à la jonction des couvercles). Une forme personnalisée a exactement les points définis dans l'éditeur de formes, éventuellement aucun. Les points suivent la rotation et le redimensionnement de la forme.
- **Extrémité automatique** : elle vise le point suivant de la flèche (l'autre extrémité ou le premier point de passage) et s'arrête au contour de la forme. Le trait n'entre jamais dans une forme.
- Toute la géométrie (contours, points d'attache, tracés, distance d'un point à un trait, écartement des flèches parallèles) est faite de **fonctions pures**, testées unitairement sans navigateur.

### Stockage (§6.1)

- `diagrams` : l'index, `[{ id, title, updatedAt }]`.
- `diagram:<id>` : un diagramme complet (formes, flèches, réglages grille/guides).
- `shapes` : les bibliothèques de formes personnalisées.
- `defaults` : les valeurs par défaut de création.
- `image:<hash>` : une image en data URL. La clé est le hash SHA-256 du contenu, pour qu'une image ne soit stockée qu'une fois. Une image n'est supprimée que lorsque plus aucun diagramme ni aucune forme personnalisée ne s'en sert.
- L'enregistrement est **automatique** : à la fin de chaque geste (glisser, saisie de texte validée, changement de style), et non à chaque image d'animation. Il n'y a pas de bouton Enregistrer. Un échec (`quota_exceeded`, par exemple) est affiché et laisse la modification visible, signalée comme non enregistrée. Un échec de lecture au démarrage bloque l'édition au lieu de montrer un espace vide qui écraserait les données (Q-013).
- La Vue et le Widget relisent le stockage quand ils redeviennent visibles.

### Images

- À l'insertion, une image est réduite (côté le plus long : 1600 px au plus), puis réencodée en WebP, ou en PNG si elle a de la transparence. Les SVG sont gardés tels quels.
- Une image qui dépasse encore environ 900 Ko est refusée avec un message. La Vue affiche l'occupation du stockage, en Mo sur 5 Mo.

### Exports

- Le bac à sable de l'Hôte ne permet ni téléchargement ni écriture d'image dans le presse-papiers. L'Hôte reçoit donc `allow-downloads` sur l'iframe des Vues, ce qui est une révision mineure de la Convention (ticket 13). Le PNG et le `.drawio` sont téléchargés comme fichiers.

### Hors de l'original (retiré)

- La consultation des sources (evidence), « Copier l'id MCP », la mise à jour de l'image d'un document (`img`), les palettes de l'administrateur, l'overlay de débogage, le bouton Enregistrer, la mémoire des styles du navigateur, les tampons et le maintien de 2 s pour déverrouiller.

## Testing Decisions

- **Un bon test** vérifie un comportement observable, comme dans la spec de l'Hôte.
- **Tests unitaires** (`sample-modules/diagram/test`, lancés par `npm test`) sur les fonctions pures :
  - géométrie, contours et points d'attache, y compris en rotation ;
  - extrémités automatiques et tracés droit, courbe et coudé ;
  - écartement des flèches parallèles ;
  - test de clic sur un trait ;
  - historique d'annulation ;
  - lecture défensive des fichiers importés ;
  - conversion `.drawio` ;
  - calcul de l'occupation du stockage.
- **Tests navigateur** (point d'entrée D : paquet construit et zippé, installé dans l'Hôte) pour les parcours de chaque ticket, et surtout les **trois défauts de l'original en tests de non-régression** (ticket 03).
- Le paquet passe le Validateur sans erreur ni avertissement. Le test des exemples couvre `sample-modules/diagram`.

## Out of Scope

- L'import de fichiers `.drawio`. Seul l'export est prévu.
- L'édition à plusieurs et la synchronisation entre deux Vues ouvertes.
- Le tactile et le mobile.
- Le routage automatique des flèches coudées autour des obstacles.
- La consultation des sources, les outils pour agents (MCP), les palettes d'administration.

## Further Notes

- **Reproduction des défauts** (2026-10-20, living-documentation 3.66.0, écritures bloquées par Playwright) :
  - **Défaut 1** : un diagramme avec A(−200,0) et B(200,0), et trois flèches A→B « one », A→B « two » et B→A « back ». Une seule flèche est visible, avec l'étiquette « back ».
  - **Défaut 2** : A(−200,0) et B(200,200), une flèche `fromPort: N` → `toPort: N`, en mode courbe. Un clic sur le haut de la courbe sélectionne la flèche, mais pas un clic au milieu ni vers la fin.
  - **Défaut 3** : avec l'outil Flèche, un glisser dans le vide ne crée aucune flèche, alors que deux clics en créent une.
- La rétrodoc n'a pas été exécutée. Les comportements non vérifiés dans le navigateur (export draw.io, presse-papiers) sont à vérifier pendant l'implémentation.
