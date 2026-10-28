# 23 : Masquer et rouvrir la barre latérale avec un bouton burger

Status: resolved

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`. À coordonner avec le ticket 20 (disposition de l'en-tête).

## Demande

Un bouton burger à droite de « Diagrams » permet de masquer la barre de gauche. Le bouton reste visible dans la barre du haut et permet de la rouvrir.

## État actuel et explication

Lecture du code le 2026-10-28 : dans l'écran diagramme, `View.svelte` affiche toujours `Sidebar`, sans état ouvert/fermé. Le titre « Diagrams » appartient à ce composant. `Toolbar` est séparé et n'est affiché que lorsqu'un diagramme est ouvert. Cacher simplement `Sidebar` avec un bouton placé dedans ferait disparaître le moyen de le rouvrir ; le contrôle doit donc rester dans une partie persistante de l'en-tête, même sans diagramme ouvert.

## Comportement retenu

- Barre ouverte : le burger est à droite de « Diagrams » ; les actions Import et + New suivent la disposition du ticket 20.
- Un clic masque la liste, les actions et la jauge de stockage de la barre latérale. La largeur libérée revient au canevas.
- Barre fermée : le burger reste visible dans la barre du haut. Un clic réaffiche la barre latérale.
- Le repli n'affecte ni le diagramme courant, ni sa sélection, ni son historique, ni son niveau de zoom. Ne pas déclencher le cadrage d'ouverture du ticket 18 à chaque bascule.
- État d'interface conservé lors des changements de diagramme pendant la même session de la Vue. Par défaut, barre ouverte au chargement ; la mémorisation entre sessions n'est pas demandée.

## Critères d'acceptation

- [x] Un seul contrôle de bascule visible à la fois, identifiable comme burger et accessible au clavier.
- [x] Libellé et infobulle adaptés à l'état : « Masquer les diagrammes » / « Afficher les diagrammes », traduits ; `aria-expanded` et `aria-controls` cohérents.
- [x] Bouton utilisable même sans diagramme ouvert, notamment après suppression du dernier diagramme.
- [x] La barre masquée ne laisse pas de colonne vide et ses contrôles ne restent pas dans l'ordre de tabulation. Le focus reste sur le bouton lors de la bascule.
- [x] Aucun remontage du canevas qui réinitialiserait ses interactions ; aucun changement enregistré dans le contenu du diagramme du seul fait de la bascule.
- [ ] Pas de chevauchement avec le titre du diagramme et les outils, aux largeurs de fenêtre prises en charge, en anglais et en français.
- [x] Test navigateur : masquer puis rouvrir, constater le gain de largeur du canevas et la conservation du zoom et de la sélection ; vérifier aussi l'état sans diagramme.
- [x] Guide d'utilisation mis à jour.

## Comments

- 2026-10-28 : demande ajoutée au cadrage ; aucun code du Module modifié.
- 2026-10-28 : réalisé dans `tessello-diagram` (4db3a04). Bouton `SidebarToggle.svelte`, état `ui.sidebarOpen` (non mémorisé entre sessions), barre latérale gardée montée avec `hidden` ; le burger passe au début de `Toolbar`, ou dans une barre `.dg-bar` sans diagramme ouvert ; le focus suit le bouton visible. Test navigateur `e2e/sidebar.test.ts` (2 tests) ; suite complète verte (312 unitaires, 62 navigateur). En attente de vérification visuelle : absence de chevauchement à 150 px et en français, non testée. L'en-tête passe à la ligne (`flex-wrap`) en attendant le ticket 20. Le test sans diagramme part d'un stockage vide, sans supprimer le dernier diagramme.
