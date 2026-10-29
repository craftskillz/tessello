# 30 : Ajouter la couleur Jaune à la palette

Status: resolved

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`.

## Demande

Ajouter à la palette une couleur jaune de Post-it.

## État actuel et explication

Lecture du code le 2026-10-29 : la palette `COLORS` (`src/lib/diagram.ts`) compte 15 clés, définies en clair et en sombre dans `src/lib/base.css` et reprises dans `src/lib/drawio.ts`. Le Post-it est créé en `c-amber` : fond jaune pâle `#fef9c3`, bordure ambre `#f59e0b`, nommé « Ambre ». Aucune couleur ne s'appelle Jaune, et aucune n'est un jaune franc. La grille des pastilles a 8 colonnes : la 16e case est libre.

## Choix retenus

- Une nouvelle clé `c-yellow`, « Jaune » / « Yellow », jaune franc de Post-it (par exemple un fond `#fef08a` et une bordure `#eab308`), avec sa variante sombre.
- Ambre reste inchangé. Le Post-it garde Ambre comme couleur par défaut, et les diagrammes existants ne changent pas.

## Critères d'acceptation

- [x] La pastille Jaune apparaît dans les panneaux des formes et des flèches, dans le style des cellules et dans la boîte des Valeurs par défaut.
- [x] Le rendu est lisible en clair et en sombre, et le texte garde un contraste suffisant sur le fond.
- [x] Sauvegarde/rechargement et valeurs par défaut acceptent `c-yellow`.
- [x] Les exports PNG et draw.io rendent la couleur.
- [x] Interface traduite, tests mis à jour (palette, draw.io).

## Comments

- 2026-10-29 : demande recueillie ; choix tranchés avec l'utilisateur : nouvelle couleur jaune vif, Ambre conservé. Aucun code du Module modifié.
- 2026-10-29 : réalisé dans `tessello-diagram` (1d501f3). Clé `c-yellow` (« Yellow » / « Jaune ») ajoutée à `COLORS` juste avant `c-amber`, 16e pastille (2 rangées pleines de 8). Clair : fond `#fef08a`, bordure `#eab308`, texte `#713f12` (contraste 7,45) ; sombre : fond `#422006`, bordure `#eab308`, texte `#fef08a` (12,52). Mêmes valeurs claires dans `PALETTE` de `drawio.ts` ; le PNG lit les variables CSS (`getComputedStyle`), rien à ajouter. Panneaux, style des cellules et Valeurs par défaut itèrent `COLORS`. Test unitaire ajouté dans `test/defaults.test.ts` (rouge puis vert) ; le test draw.io de la palette couvre la nouvelle clé. 360 tests unitaires verts, typage sans erreur ; suite navigateur non lancée.
- 2026-10-29 : relecture à deux axes (Standards, Spec) : aucune violation ni écart. Reste ouvert : pas de test PNG ni d'aller-retour de sauvegarde dédié à `c-yellow` (aucune liste blanche dans le stockage) ; Jaune et Ambre sont proches à l'œil, la bordure les distingue.
