# 26 : Escamoter le panneau de style vers la droite quand rien n'est sélectionné

Status: resolved

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`. Pendant du ticket 23 (barre latérale repliable), côté droit.

## Demande

La barre de droite où l'on choisit les styles devient un tiroir : elle disparaît automatiquement vers la droite quand rien n'est sélectionné.

## État actuel et explication

Lecture du code le 2026-10-28 : `Canvas.svelte` affiche toujours un panneau à droite. Sans sélection, c'est `ShapePanel` avec le seul message « Sélectionnez une forme pour changer son style. », qui occupe 232 px pour rien. Le panneau est ancré à côté du canevas (`.dg-panel`, `flex: 0 0 232px`) pour ne jamais masquer le dessin.

## Comportement retenu

- Sans sélection, le panneau glisse vers la droite et sort de l'écran ; la largeur libérée revient au canevas.
- Dès qu'une forme, une flèche ou un élément verrouillé est sélectionné, le panneau revient en glissant depuis la droite.
- Le panneau reste ancré à côté du canevas, il ne passe pas par-dessus le dessin.
- Passer d'une sélection à une autre (forme ↔ flèche ↔ verrouillé) change le contenu du panneau sans le refermer.
- Pas d'animation quand l'utilisateur demande moins de mouvement (`prefers-reduced-motion`).
- Le zoom et le déplacement de la vue ne changent pas à l'ouverture ou à la fermeture du panneau.
- Le message « Sélectionnez une forme… » disparaît, devenu inutile.

## Critères d'acceptation

- [x] Sans sélection, aucun panneau de style n'est affiché ni dans l'ordre de tabulation.
- [x] La sélection d'un élément affiche le panneau ; tout désélectionner (clic dans le vide, Échap) le fait disparaître.
- [x] Le canevas s'élargit quand le panneau disparaît ; zoom et sélection conservés.
- [x] Aucun changement enregistré dans le diagramme du seul fait de l'ouverture ou de la fermeture du panneau.
- [x] Test navigateur : sélectionner puis désélectionner, constater l'apparition puis la disparition du panneau et le gain de largeur du canevas.
- [x] Guide d'utilisation mis à jour.

## Comments

- 2026-10-28 : demande ajoutée au cadrage.
- 2026-10-28 : réalisé dans `tessello-diagram` (d7432f9). Dans `Canvas.svelte`, les panneaux sont enveloppés dans `.dg-drawer`, affiché seulement s'il y a une sélection, avec une transition `drawer` qui anime sa largeur (180 ms, 0 avec `prefers-reduced-motion`). Le panneau garde ses 232 px (`.dg-panel` passe à `flex: none; width: 232px`) et sort par le bord droit. Le message `shape_panel_empty` est supprimé ; pendant la sortie, le panneau est vide. Test navigateur `e2e/panel.test.ts`. `e2e/sidebar.test.ts` attend la fin de l'ouverture du panneau avant de mesurer. Suite complète verte (312 unitaires, 63 navigateur). Effet de bord : le cadrage d'ouverture se fait sans panneau, donc sur toute la largeur. À la première sélection, ce qui touche le bord droit passe sous le panneau. `e2e/tables.test.ts` (liaison depuis une cellule) cadre donc la vue une fois le panneau ouvert.
- 2026-10-28 : relecture à deux axes (Standards, Spec). Corrigé : l'attente de l'ouverture du panneau, répétée dans trois tests, passe dans `e2e/diagram.ts` (`panelSlidIn`, `PANEL_WIDTH`) ; `still` devient `reducedMotion` dans `Canvas.svelte`. Suite navigateur verte (63). Reste ouvert, hors du périmètre du ticket : Échap pressé sur un bouton du panneau ferme le panneau et le focus retombe sur `body` (les raccourcis restent actifs, ils sont écoutés sur `window`) ; pendant les 180 ms de sortie, un `aside` vide reste dans l'arbre d'accessibilité ; le passage forme → flèche → verrouillé et `prefers-reduced-motion` ne sont pas testés.
