# L'Hôte est local-first, sans compte

La configuration de l'Utilisateur (Modules installés, disposition de l'Accueil) et les données des Modules sont stockées dans le navigateur, sans compte ni backend ; un export/import permet de les sauvegarder ou de les déplacer. Un backend n'existera que pour la marketplace, qui reste optionnelle pour utiliser l'Hôte.

## Consequences

- Pas de synchronisation multi-appareils en V1 ; l'ajouter plus tard supposera des comptes et une stratégie de résolution de conflits.
- La marketplace n'aura finalement pas de backend non plus : c'est un catalogue statique (ADR 0014).
- Le code et les données des Modules ne sont plus dans le navigateur mais dans le Dossier des Modules, sur la machine de l'Utilisateur : voir l'ADR 0007.
