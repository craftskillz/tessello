# 27 : Afficher le titre complet d'un diagramme de la liste

Status: ready-for-agent

Spec parente : `.scratch/diagram/spec.md`. Code et tests du Module : `../tessello-diagram/`.

## Demande

Dans la barre latérale, un titre long est tronqué par « … ». Une info-bulle au survol doit afficher le titre en entier.

## État actuel et explication

Lecture du code le 2026-10-29 : dans `src/view/Sidebar.svelte`, le bouton `.dg-open` de chaque diagramme coupe son texte (`overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`) et ne porte pas d'attribut `title`. Seul le bouton de suppression a une info-bulle (« Supprimer »). Le titre complet n'est donc jamais visible.

## Proposition de périmètre

Info-bulle native (`title`) sur le bouton d'ouverture, avec le titre affiché (`titleOf(entry.title)`, donc « Sans titre » pour un titre vide). Elle peut s'afficher pour tout titre, ou seulement pour un titre réellement tronqué. Le second cas demande de mesurer la largeur au survol.

## Critères d'acceptation

- [ ] Le survol d'un titre tronqué de la liste affiche le titre complet.
- [ ] Le diagramme ouvert (en gras) et un titre vide sont aussi couverts.
- [ ] Le nom accessible du bouton reste le titre ; l'info-bulle ne le double pas inutilement pour les lecteurs d'écran.
- [ ] Test navigateur ciblé dans `e2e/sidebar.test.ts`.

## Comments

- 2026-10-29 : demande recueillie ; aucun code du Module modifié.
