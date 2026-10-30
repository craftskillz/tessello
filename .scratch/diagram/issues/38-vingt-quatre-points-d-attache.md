# 38 : 24 points d'attache par forme au lieu de 8

Status: needs-triage

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`. Prolonge le ticket 03 (connexions et points d'attache).

## Demande

Les formes offrent aujourd'hui 8 points d'attache (4 coins et 4 milieux de côté). Il en faudrait 24, pour pouvoir tracer des flèches aller et retour proches et parallèles entre deux formes.

Disposition voulue, 7 points par côté coins compris :

```
o o o o o o o
o           o
o           o
o           o
o           o
o           o
o o o o o o o
```

## État actuel et explication

Lecture du code le 2026-10-30, dans `src/lib/geometry.ts` :

- `PORTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]` sont les ports des formes intégrées. `PORT_SIDES` donne pour chacun une direction (`{x, y}` dans `[-1, 1]`).
- `portPoint` projette cette direction sur le contour réel de la forme : coins du rectangle, courbe de l'ellipse et du cercle, jonction des couvercles de la base de données (`outlineFactor`, `lidOf`). `portDirection` donne le sens de sortie d'un port.
- Les formes personnalisées et les tableaux ont leurs propres ancres (`anchors`, `hasAnchors`). Les ancres des cellules d'un tableau reprennent `PORTS` (`table.ts`).
- Une extrémité attachée stocke son port par son nom (`Endpoint.port`). Un port inconnu de la forme est ramené à une attache automatique (`arrows.ts`, l.88), et l'export draw.io ignore un tel port (`drawio.ts`, l.256).
- Plusieurs flèches sur un **même** port sont déjà écartées de `FAN` = 8 unités le long du contour (`arrows.ts`). Ce décalage est automatique et ne se choisit pas, d'où la demande de points distincts.
- `Canvas.svelte` (l.1032) dessine un repère par port de `portsOf(shape)` pendant le tracé d'une flèche. Il en dessinerait donc 24.

## Choix proposés (à valider)

- **Disposition** : sur chaque côté de la boîte de la forme, 7 points régulièrement espacés aux fractions 0, 1/6, 2/6, …, 1 de la longueur du côté. Cela fait 4 coins et 5 points intermédiaires par côté, 24 en tout, comme sur le schéma.
- **Noms** : les 8 noms actuels gardent leur place (les coins et le point du milieu de chaque côté), pour que les diagrammes existants ne bougent pas. Les 16 nouveaux points sont nommés par leur décalage par rapport au milieu, du nord dans le sens horaire : `N+1`, `N+2`, `E-2`, `E-1`, `E+1`, `E+2`, etc.
- **Formes rondes** (ellipse, cercle, acteur, base de données) : chaque point de la boîte est projeté depuis le centre sur le contour réel, comme le sont déjà les coins. Les points restent ainsi sur le trait, mais l'espacement n'est plus régulier sur une courbe.
- **Sens de sortie** : celui du côté du point, et non la direction depuis le centre. Deux flèches qui partent de points voisins d'un même côté restent ainsi parallèles en tracé coudé.
- **Hors périmètre** : les formes personnalisées (elles gardent les ancres de leur définition, ticket 09) et les ancres des cellules de tableau (ticket 24).
- **Affichage selon la taille de la forme** (retenu) : 24 repères sur une petite forme se touchent (un cercle de 60 laisse 10 unités entre deux points). Les points intermédiaires d'un côté ne sont donc offerts que si ce côté est assez long. Le seuil se compte en pixels à l'écran, longueur du côté × zoom : par exemple, au moins 12 px entre deux points voisins. En dessous, le côté n'offre que ses 2 coins et son milieu, soit les 8 points actuels pour la forme. Les côtés se décident séparément : un rectangle large et bas peut offrir 7 points en haut et en bas, et 3 sur ses petits côtés. Un point caché ne sert pas non plus à l'accroche. Une flèche déjà posée dessus reste attachée et se dessine au même endroit.
- **Traçage** : le décalage `FAN` reste pour des flèches posées sur un même point.

## Critères d'acceptation

- [ ] Les formes intégrées (rectangle, ellipse, cercle, acteur, Post-it, Texte, base de données, image) offrent 24 points d'attache disposés comme sur le schéma, sur le contour réel, et qui suivent la rotation.
- [ ] Une flèche s'attache à chacun d'eux par tirage et par déplacement de son extrémité ; deux flèches aller et retour entre deux points voisins sont parallèles, en tracé droit comme en tracé coudé.
- [ ] Les diagrammes existants gardent exactement leurs attaches (les 8 noms actuels sont inchangés) ; sauvegarde/rechargement, annuler/rétablir et copier/coller conservent les nouveaux ports.
- [ ] L'export draw.io place les extrémités sur les nouveaux points (`exitX`/`entryX`…), et l'export PNG les dessine au même endroit.
- [ ] Un côté trop court à l'écran n'offre que ses coins et son milieu, et ses points intermédiaires apparaissent quand on agrandit la forme ou le zoom. Une flèche déjà posée sur un point caché reste attachée.
- [ ] Guide mis à jour, tests unitaires (`portPoint`/`portDirection` des nouveaux ports, rotation, formes rondes, lecture d'un port inconnu, draw.io) et test navigateur d'une attache sur un point intermédiaire.

## Comments

- 2026-10-30 : demande recueillie, avec le schéma de l'utilisateur ; aucun code du Module modifié. À trancher avec l'utilisateur : nommage des ports, sens de sortie des points sur les formes rondes, affichage des repères sur les petites formes ou à faible zoom.
- 2026-10-30 : tranché avec l'utilisateur : les points intermédiaires s'affichent selon la taille de la forme, côté par côté (voir Choix proposés, Affichage).
