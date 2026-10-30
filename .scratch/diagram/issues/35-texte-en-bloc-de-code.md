# 35 : Afficher le texte d'une forme comme un bloc de code

Status: needs-triage

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`. La coloration syntaxique fait l'objet du ticket 36.

## Demande

Pouvoir indiquer qu'une forme contenant du texte affiche ce texte comme du code, à la manière d'un bloc Markdown ` ```bash … ``` ` ou ` ```json … ``` `.

## État actuel et explication

Lecture du code le 2026-10-30 :

- `Shape.text` est du texte brut, avec en plus des styles sur la forme (`bold`/`italic`/`underline`, ticket 21) et des plages stylées `textRuns` (ticket 32).
- `layoutText` / `wrap` (`src/lib/text.ts`) coupent les lignes **entre les mots**, sur les espaces, et mesurent dans la police de la Vue. Un code indenté perdrait donc ses espaces de tête, et une longue ligne serait coupée au milieu d'une instruction.
- `ShapeView.svelte` dessine chaque ligne en `tspan`. Le SVG fusionne les espaces consécutifs par défaut, donc l'indentation disparaîtrait aussi au rendu.
- Une police à chasse fixe existe déjà (`--mono` dans `base.css`), mais elle ne sert qu'à l'interface.
- L'éditeur riche (`TextEditor.svelte`) applique sur Entrée et ajoute une ligne sur Maj+Entrée. Ce n'est pas pratique pour saisir du code.
- L'export draw.io écrit le texte en HTML échappé. Le PNG copie les styles calculés, `font-family` compris (`png.ts`).

## Choix proposés (à valider)

- **Modèle** : un champ facultatif `code?: { language: string }` sur la forme. Absent, la forme reste en texte normal, et les anciens diagrammes ne changent pas. `language` est une étiquette libre (`bash`, `json`, `yaml`, `ts`, `sql`, …), éventuellement vide.
- **Portée** : toutes les formes qui portent un texte, sauf le Tableau et l'Image. Les cellules et les étiquettes de flèches restent hors périmètre.
- **Activation** :
  - dans le panneau de style, un interrupteur « Code », puis un champ de langage avec suggestions ;
  - raccourci Markdown : si le texte appliqué commence par ` ```<langage> ` et finit par ` ``` `, la forme passe en mode code avec ce langage, et les clôtures sont retirées du texte. Désactiver « Code » rend le texte normal, sans le modifier.
- **Rendu** :
  - police `--mono` et espaces conservés (`xml:space="preserve"` / `white-space: pre`) ;
  - **pas de retour à la ligne automatique**, et ce qui dépasse est rogné au bord de la forme (on redimensionne la forme pour tout voir) ;
  - alignement imposé à gauche et en haut, les commandes d'alignement étant masquées ;
  - le langage s'affiche en petit, discrètement, dans un coin de la forme.
- **Styles** : en mode code, Gras/Italique/Souligné et les `textRuns` sont ignorés à l'affichage et masqués dans le panneau, mais conservés pour un retour en texte normal. La taille de police et la couleur de la forme restent réglables.
- **Édition** : en mode code, Entrée ajoute une ligne et Tab insère deux espaces. On applique avec Ctrl/Cmd+Entrée ou un clic hors de la forme, et Échap abandonne. Un collage reste en texte brut.
- **Exports** : draw.io écrit `fontFamily` à chasse fixe, les espaces en `&nbsp;` et `align=left;verticalAlign=top`. Le PNG garde la police et l'indentation.

## Critères d'acceptation

- [ ] Une forme passe en mode code et en sort par le panneau, et un texte saisi entre clôtures ` ```lang … ``` ` l'active avec son langage.
- [ ] Le texte s'affiche en chasse fixe, indentation et espaces conservés, sans retour à la ligne automatique, rogné au bord de la forme, et le langage est visible.
- [ ] L'éditeur, en mode code, garde la même police et les mêmes espaces que le rendu ; Entrée, Tab, Ctrl/Cmd+Entrée et Échap se comportent comme décrit.
- [ ] Sauvegarde/rechargement, annuler/rétablir, copier/coller de formes et « Copier le style » conservent le mode code et le langage ; un `code` invalide lu dans le stockage est ignoré.
- [ ] Les exports PNG et draw.io gardent la police et l'indentation.
- [ ] Interface traduite, Guide mis à jour, tests unitaires (lecture, mise en page sans coupure, clôtures Markdown, draw.io) et test navigateur de l'édition.

## Comments

- 2026-10-30 : demande recueillie ; aucun code du Module modifié. À trancher avec l'utilisateur : propriété de forme ou nouveau type « Code », rognage ou retour à la ligne des longues lignes, comportement d'Entrée dans l'éditeur.
