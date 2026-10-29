# 32 : Gras, italique et souligné sur une partie du texte d'une forme

Status: resolved

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`. Prolonge le ticket 21, qui avait retenu « tout le texte de la forme ; pas de style par mots ».

## Demande

Dans la zone de texte d'une forme, pouvoir mettre en gras, en italique ou en souligné une partie choisie du texte, et non seulement tout le texte à la fois.

## État actuel et explication

Lecture du code le 2026-10-29 : `Shape.text` est une chaîne de texte brut, et `bold`/`italic`/`underline` portent sur la forme entière (ticket 21). `Canvas.svelte` édite le texte dans un `textarea`, qui ne peut pas afficher plusieurs styles. `layoutText` (`src/lib/text.ts`) renvoie des lignes de texte brut mesurées dans une seule police, et `ShapeView.svelte` dessine chaque ligne en un `tspan`. L'export draw.io écrit le texte en HTML échappé, avec un seul `fontStyle` pour la forme.

## Choix retenus

- Portée : le texte de toutes les formes qui en portent. Les cellules de tableau et les étiquettes de flèches gardent un style sur tout le texte.
- Styles : gras, italique et souligné. La taille, la couleur et les alignements restent ceux de toute la forme.
- Modèle : `text` reste le texte brut. Un champ facultatif `textRuns` liste des plages `{ start, end, bold?, italic?, underline? }` (positions dans `text`) qui s'écartent du style de la forme. Une clé absente suit la forme, et une forme sans plage s'affiche comme aujourd'hui.
- Édition : un éditeur riche remplace le `textarea` des formes (pas celui des cellules ni des étiquettes) et affiche les styles pendant la saisie. Une sélection dans l'éditeur se met en forme par **Ctrl/Cmd+B/I/U** ou par les boutons du panneau, qui indiquent l'état de la sélection. Sans sélection, la commande vaut pour les caractères tapés ensuite. Entrée applique, Maj+Entrée ajoute une ligne, Échap abandonne, comme aujourd'hui. Un collage n'insère que du texte brut.
- Hors édition, les boutons du panneau portent sur tout le texte : ils sont enfoncés si tout le texte a ce style, et un clic l'applique à tout le texte, ou le retire de tout le texte, en effaçant les écarts des plages pour ce style. « Coller le style » fait de même.

## Critères d'acceptation

- [x] Dans l'éditeur, une partie sélectionnée se met en gras, en italique ou en souligné, au clavier et par les boutons, qui indiquent l'état de la sélection, et les styles se combinent.
- [x] L'éditeur affiche les styles pendant la saisie, et le rendu SVG est le même après l'édition. Les retours à la ligne sont mesurés dans la police réelle de chaque partie.
- [x] Hors édition, les boutons du panneau et « Coller le style » portent sur tout le texte, comme décrit ci-dessus.
- [x] Sauvegarde/rechargement, annuler/rétablir et copier/coller de formes conservent les plages. Des plages invalides lues dans le stockage sont ignorées ou ramenées dans le texte, et les anciens diagrammes ne changent pas.
- [x] L'export draw.io écrit les parties stylées en HTML (`<b>`, `<i>`, `<u>`), et l'export PNG les conserve.
- [x] Interface traduite, Guide mis à jour, tests unitaires (modèle, lecture, mise en page, draw.io, style collé) et test navigateur de l'éditeur.

## Comments

- 2026-10-29 : demande recueillie ; choix tranchés avec l'utilisateur : formes seulement, gras/italique/souligné, éditeur riche.
- 2026-10-29 : réalisé dans `tessello-diagram` (d5cd4fb). Modèle pur `src/lib/richtext.ts` (`spansOf`, `fromSpans`, `styleRange`, `insertText`, `deleteRange`, `rangeStyle`, `wholeStyle`, `styleWhole`) ; `readShape` lit `textRuns` (plages entières, ramenées dans le texte, chevauchements résolus par la dernière, plages identiques au style de la forme retirées). `layoutText` renvoie des lignes de spans, chacun mesuré dans sa police ; `ShapeView` dessine un `tspan` par span (le PNG copiait déjà ces styles). draw.io : `<b>`/`<i>`/`<u>` et `fontStyle` neutre pour une forme à plages, inchangé sinon. Éditeur riche `src/view/TextEditor.svelte` (contenteditable, les spans font foi) : Ctrl/Cmd+B/I/U et boutons du panneau sur la sélection, style en attente au curseur, collage en texte brut, Maj+Entrée, et un historique propre (Ctrl/Cmd+Z par mot, Ctrl/Cmd+Maj+Z), une seule étape d'annulation du diagramme une fois appliqué. Hors édition, les boutons et « Coller le style » passent par `styleWhole`. Cellules et étiquettes inchangées. Le garde clavier du canevas reconnaît désormais un `contenteditable` (sinon Échap désélectionnait la forme). Guide mis à jour. Tests : unitaires (modèle, lecture, mise en page, draw.io, style collé) et cinq tests navigateur dans `e2e/shapes.test.ts`. Suite complète verte (391 unitaires, 76 navigateur), typage sans erreur.
- 2026-10-29 : relecture à deux axes (Standards, Spec). Corrigé : l'annulation native bloquée dans l'éditeur (remplacée par son historique) ; les doublons du triplet de styles (`baseOf`, `sameStyle` partagés) et du balisage des `tspan` (snippet). Reste ouvert : pas de test dédié de l'export PNG ; « Copier le style » emporte le style de la forme et non l'état mélangé de son texte ; un texte entièrement en gras avec plages s'exporte en `<b>` par span plutôt qu'en `fontStyle=1` ; la saisie IME n'est pas testée ; `TextEditor.svelte` (~300 lignes) pourrait sortir ses aides DOM⇄positions dans un module `.ts`.
