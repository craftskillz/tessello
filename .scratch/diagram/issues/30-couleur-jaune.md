# 30 : Ajouter la couleur Jaune à la palette

Status: ready-for-agent

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`.

## Demande

Ajouter à la palette une couleur jaune de Post-it.

## État actuel et explication

Lecture du code le 2026-10-29 : la palette `COLORS` (`src/lib/diagram.ts`) compte 15 clés, définies en clair et en sombre dans `src/lib/base.css` et reprises dans `src/lib/drawio.ts`. Le Post-it est créé en `c-amber` : fond jaune pâle `#fef9c3`, bordure ambre `#f59e0b`, nommé « Ambre ». Aucune couleur ne s'appelle Jaune, et aucune n'est un jaune franc. La grille des pastilles a 8 colonnes : la 16e case est libre.

## Choix retenus

- Une nouvelle clé `c-yellow`, « Jaune » / « Yellow », jaune franc de Post-it (par exemple un fond `#fef08a` et une bordure `#eab308`), avec sa variante sombre.
- Ambre reste inchangé. Le Post-it garde Ambre comme couleur par défaut, et les diagrammes existants ne changent pas.

## Critères d'acceptation

- [ ] La pastille Jaune apparaît dans les panneaux des formes et des flèches, dans le style des cellules et dans la boîte des Valeurs par défaut.
- [ ] Le rendu est lisible en clair et en sombre, et le texte garde un contraste suffisant sur le fond.
- [ ] Sauvegarde/rechargement et valeurs par défaut acceptent `c-yellow`.
- [ ] Les exports PNG et draw.io rendent la couleur.
- [ ] Interface traduite, tests mis à jour (palette, draw.io).

## Comments

- 2026-10-29 : demande recueillie ; choix tranchés avec l'utilisateur : nouvelle couleur jaune vif, Ambre conservé. Aucun code du Module modifié.
