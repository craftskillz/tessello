# 20 : Répartir le titre et les actions de la liste sur deux lignes

Status: resolved

Spec parente : `.scratch/diagram/spec.md`. Code du Module : `../tessello-diagram/src/view/Sidebar.svelte`.

## Demande

Séparer « Diagrams » et les boutons « Import » / « + New » sur deux lignes, avec un alignement et des espacements réguliers.

## État actuel et explication

Lecture du code le 2026-10-28 : `.dg-sidebar-head` utilise une disposition flex horizontale, avec `justify-content: space-between`, dans une barre de 220 pixels qui passe à 150 pixels sur petit écran. Le titre et les actions se partagent donc la même ligne étroite.

## Proposition

Titre sur la première ligne, puis les deux actions sur la seconde, alignés à gauche avec un espacement vertical explicite. La formulation « en dessus » de la demande laisse l'ordre à confirmer ; une question a été posée.

Complément : le ticket 23 ajoute un bouton burger à droite de « Diagrams ». Prévoir sa place dans cette ligne de titre. Le bouton doit rester accessible dans la barre du haut lorsque la barre latérale est repliée ; les deux tickets sont à réaliser ensemble pour éviter deux dispositions concurrentes.

## Critères d'acceptation

- [x] Titre et actions sur deux lignes, dans l'ordre confirmé.
- [x] Le bouton burger du ticket 23 est aligné à droite du titre et reste accessible après repli de la barre latérale.
- [x] Boutons lisibles et espacés sans débordement, en anglais et en français, aux deux largeurs de la barre.
- [x] Vérification visuelle dans le navigateur.

## Comments

- 2026-10-28 : demande recueillie ; ordre des lignes à confirmer.
- 2026-10-28 : ordre confirmé : titre et burger sur la première ligne, « Import » et « + New » sur la seconde, alignés à gauche.
- 2026-10-28 : réalisé dans `tessello-diagram` (8446b98), en CSS seulement (`Sidebar.svelte`) : en-tête en colonne avec 10 px d'écart, burger poussé à droite du titre, boutons sans coupure de mots. À 150 px, le rembourrage horizontal des boutons passe à 6 px pour que « Import » et « + New » tiennent sur une ligne. Écart connu : en français à 150 px, « Importer » et « + Nouveau » (environ 109 px de texte pour 126 px disponibles) ne tiennent pas côte à côte ; « + Nouveau » passe sous « Importer », aligné à gauche, plutôt que de déborder ou de couper ses mots. Test navigateur ajouté dans `e2e/sidebar.test.ts` (anglais et français, 220 et 150 px), avec une option `locale` pour `openView`. Le repli reste couvert par les tests du ticket 23. Captures vérifiées aux quatre combinaisons. Suite complète verte (319 unitaires, 65 navigateur).
