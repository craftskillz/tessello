# Les Modules déclarent leurs Permissions, acceptées en bloc et appliquées par l'Hôte

Les Modules doivent pouvoir faire beaucoup (un Module d'observabilité joint des API, plus tard des commandes locales), mais l'Utilisateur doit savoir avant l'activation ce qui sera permis. Chaque Module déclare donc ses Permissions dans son Manifeste ; l'Hôte les présente avant l'installation, l'Utilisateur les accepte **toutes ou aucune**, et l'Hôte **bloque** tout accès non déclaré. Une mise à jour qui ajoute des Permissions exige un nouvel accord, sans quoi l'ancienne version reste en place ; retirer une Permission passe par la désinstallation.

## Considered Options

- **Réseau libre** (choix initial) : rejeté, l'Utilisateur ne saurait pas où partent ses données.
- **Accord permission par permission, ou à la première utilisation** : rejeté pour la V1, chaque Module devrait gérer le cas « une partie de mes Permissions m'a été refusée », ce qui complique fortement le travail des Créateurs et des LLM.

## Consequences

- Toute capacité future (notifications, fichiers, commandes via le Pont…) s'ajoute comme une nouvelle Permission, en révision mineure de la Convention.
- Le blocage réseau repose sur les mécanismes du navigateur (CSP) ; deux fuites résiduelles ne sont pas couvertes : l'ouverture d'un lien dans un nouvel onglet (gardée pour permettre les liens externes) et WebRTC. Statut mesuré et mécanisme de blocage retenu : ADR 0005.
- Le Pont (exécution de commandes, appels sans contrainte CORS) est prévu mais hors Convention 1 ; il fera l'objet de son propre ADR.
- Une mise à jour peut aussi venir d'un dossier déjà modifié (`git pull`, éditeur) : il n'y a alors plus d'« ancienne version » à garder en place. Tant que l'Utilisateur n'a pas accepté les Permissions ajoutées, le Module ne tourne pas, et ses données restent intactes (ADR 0007).
