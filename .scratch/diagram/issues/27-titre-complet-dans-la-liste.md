# 27 : Afficher le titre complet d'un diagramme de la liste

Status: resolved

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`.

## Demande

Dans la barre latérale, un titre long est tronqué par « … ». Une info-bulle au survol doit afficher le titre en entier.

## État actuel et explication

Lecture du code le 2026-10-29 : dans `src/view/Sidebar.svelte`, le bouton `.dg-open` de chaque diagramme coupe son texte (`overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`) et ne porte pas d'attribut `title`. Seul le bouton de suppression a une info-bulle (« Supprimer »). Le titre complet n'est donc jamais visible.

## Proposition de périmètre

Info-bulle native (`title`) sur le bouton d'ouverture, avec le titre affiché (`titleOf(entry.title)`, donc « Sans titre » pour un titre vide). Elle peut s'afficher pour tout titre, ou seulement pour un titre réellement tronqué. Le second cas demande de mesurer la largeur au survol.

## Critères d'acceptation

- [x] Le survol d'un titre tronqué de la liste affiche le titre complet.
- [x] Le diagramme ouvert (en gras) et un titre vide sont aussi couverts.
- [x] Le nom accessible du bouton reste le titre ; l'info-bulle ne le double pas inutilement pour les lecteurs d'écran.
- [x] Test navigateur ciblé dans `e2e/sidebar.test.ts`.

## Comments

- 2026-10-29 : demande recueillie ; aucun code du Module modifié.
- 2026-10-29 : réalisé dans `tessello-diagram` (f7db12e). Le bouton `.dg-open` de `Sidebar.svelte` porte `title={title}`, le titre affiché (`titleOf`, donc « Untitled » pour un titre vide), pour tout titre : pas de mesure au survol. Lecteurs d'écran : Chromium n'expose aucune description lorsque le `title` égale le nom accessible, donc rien n'est doublé et aucun attribut de plus n'est nécessaire. Guide : « point at a long title that is cut short to see it in full ». Test navigateur dans `e2e/sidebar.test.ts` : titre long ouvert (`aria-current`) et réellement tronqué, titre vide, puis nom et absence de description lus dans l'arbre d'accessibilité par CDP ; rouge puis vert. Suite complète verte (342 unitaires, 70 navigateur), typage sans erreur.
- 2026-10-29 : relecture à deux axes (Standards, Spec). Corrigé : `{@const title}` par ligne au lieu de trois appels à `titleOf` ; noms et type des nœuds d'accessibilité éclaircis dans le test. Reste ouvert : l'absence de description n'est vérifiée que dans Chromium (Safari/VoiceOver non vérifié) ; l'info-bulle native elle-même n'est pas observable par Playwright, le test vérifie l'attribut.
