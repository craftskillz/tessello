# 36 : Coloration syntaxique des blocs de code

Status: resolved

Blocked by: 35

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`.

## Demande

Une forme en mode code (ticket 35) colore son texte selon son langage, comme un bloc ` ```bash ` ou ` ```json ` dans un rendu Markdown.

## État actuel et explication

Lecture du code le 2026-10-30 : le Module ne dépend que de `@tessello/sdk`. `layoutText` produit des lignes de spans (ticket 32), et `ShapeView` dessine un `tspan` par span, avec gras, italique et souligné, mais sans couleur propre. Pour colorer, il suffit donc de produire des spans portant une classe de jeton.

## Choix retenus

- **Analyseur maison**, sans dépendance. highlight.js, Prism et Shiki sont lourds pour un module, et Shiki charge ses grammaires de façon asynchrone. On écrit un module pur `src/lib/syntax.ts` qui découpe le texte en jetons, avec quelques classes : mot-clé, chaîne, nombre, commentaire, clé (JSON/YAML), ponctuation, variable (bash).
- **Langages d'abord** : `json`, `bash`/`sh`, `yaml`, `js`/`ts`, `sql`, `python`. Un langage inconnu ou vide s'affiche sans couleur, et des alias sont reconnus (`shell`, `yml`, `javascript`, …).
- **Couleurs** : variables CSS par classe de jeton, en clair et en sombre (`base.css`), choisies pour rester lisibles sur toutes les couleurs de la palette. Sinon, on fixe un fond de code neutre qui remplace la couleur de la forme : à trancher.
- **Rendu** : la coloration se calcule au rendu, n'est pas stockée, et ne change ni les mesures ni les positions (chasse fixe).
- **Éditeur** : dans un premier temps, le texte reste sans couleur pendant l'édition ; la coloration en direct est une étape possible.
- **Exports** : draw.io écrit des `<font color="…">` par jeton, avec les valeurs claires. Le PNG copie les couleurs calculées.

## Critères d'acceptation

- [x] Les langages retenus sont colorés ; un langage inconnu s'affiche sans couleur, sans erreur.
- [x] Les couleurs sont lisibles en clair et en sombre, sur les couleurs de la palette ou sur le fond de code retenu.
- [x] Les exports PNG et draw.io conservent la coloration.
- [x] Tests unitaires de l'analyseur par langage (dont chaînes non fermées, échappements et commentaires), de l'export draw.io, et un test navigateur du rendu.

## Comments

- 2026-10-30 : demande recueillie ; aucun code du Module modifié. À trancher avec l'utilisateur : analyseur maison ou dépendance, liste des langages, fond de code imposé ou couleur de la forme.
- 2026-10-30 : tranché avec l'utilisateur : analyseur maison sans dépendance, les six langages proposés et leurs alias, couleurs posées sur la couleur de la forme (pas de fond de code imposé), éditeur sans couleur.
- 2026-10-30 : réalisé dans `tessello-diagram` (76e41ba). Nouveau `src/lib/syntax.ts` : `highlight` (une liste de motifs par famille de langages, le texte lu d'un bloc pour que commentaires de bloc, triples guillemets et gabarits JS passent d'une ligne à l'autre), `isHighlighted`, et une seule table de peintures pour `tokenCss` et `tokenHex`. Plutôt que des variables CSS par jeton dans `base.css`, chaque sorte de jeton est un mélange sRGB d'une teinte dans `--text` de la forme (commentaire et ponctuation : vers `--fill`), ce qui reste lisible sur toute la palette, en clair comme en sombre. `layoutText` donne aux spans d'un bloc de code leur `token` ; `ShapeView` le peint en `fill`. Le PNG copie la couleur calculée (vérifié dans Chromium) ; draw.io écrit un `<font color>` par jeton, avec la palette claire. Guide mis à jour. 486 tests unitaires et 83 tests navigateur verts, typage sans erreur.
- 2026-10-30 : relecture à deux axes. Standards : aucune violation ; import et commentaire de `text.ts` remis en forme et `channels` renommé `rgbOf` avant le commit ; jugements : `ALIASES` et `GRAMMARS` en deux tables, sentinelle `"fill"` dans `PAINTS`. Spec : pas de test automatique de l'export PNG coloré ; lisibilité vérifiée à la main, sans outil de contraste ; une couleur de forme hors palette prend les couleurs de jetons du gris dans draw.io ; pas de `$VAR` coloré dans une chaîne bash ni d'interpolation `${}` dans un gabarit JS.
