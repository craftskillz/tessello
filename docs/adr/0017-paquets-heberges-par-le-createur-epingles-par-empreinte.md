# Les paquets sont hébergés par leur Créateur et épinglés par leur empreinte

La Marketplace ne stocke aucun `.zip`. Pour chaque version, la fiche d'un Module donne l'URL du paquet, hébergé par le Créateur, et son empreinte SHA-256. La CI télécharge le paquet, vérifie l'empreinte et lance le Validateur. Elle tire du Manifeste le nom, la description, l'icône, les Permissions, les Widgets et le Guide d'utilisation, et vérifie que l'Identifiant et la version sont ceux de la fiche. L'Hôte télécharge le paquet directement, comme pour l'installation par URL (ADR 0009), et refuse un paquet dont l'empreinte ne correspond pas. Ainsi, une fiche ne peut pas changer de code sans nouvelle version, et la Marketplace ne peut pas afficher d'autres Permissions que celles du paquet.

## Considered Options

- **Copier les paquets dans le dépôt de la Marketplace** : rejeté. Les paquets resteraient toujours disponibles, mais l'historique git grossirait à chaque version, sans fin.
- **Construire le paquet dans la CI à partir du dépôt source** : rejeté. Cela prouverait que le paquet correspond au code publié, mais il faudrait exécuter l'outil de build de chaque Créateur. Sans relecture des mises à jour (ADR 0015), cette preuve ne vaut pas son coût.

## Consequences

- **Hébergement** : le serveur du paquet doit envoyer les en-têtes CORS. GitHub Pages et `raw.githubusercontent.com` le font, les Releases GitHub non (ADR 0009). `PUBLISHING.md` recommande GitHub Pages.
- **Une version publiée ne change plus** : chaque version a sa propre URL, et un paquet publié n'est jamais écrasé. La CI refuse une version déjà publiée ou inférieure à la dernière. Si un Créateur écrase quand même un paquet, l'installation échoue avec un message clair : « ce paquet ne correspond plus à la Marketplace ».
- **Disponibilité** : si un Créateur retire un paquet de son hébergement, l'installation échoue, sans autre conséquence.
- **Source et licence** : la fiche donne le dépôt source, public, et sa licence sous forme d'identifiant SPDX. La CI vérifie que la licence est approuvée par l'OSI et que GitHub rapporte la même. Rien ne prouve que le paquet est construit à partir de ce dépôt.
- **Ce qui n'est pas dans le Manifeste** : jusqu'à trois captures d'écran (PNG ou WebP, 500 Ko au plus chacune) et des tags, dans le dossier de la fiche.
