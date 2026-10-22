# La Marketplace est un catalogue statique tenu dans un dépôt git public

La Marketplace n'a ni backend, ni base de données, ni comptes. C'est un dépôt GitHub public, `craftskillz/tessello-marketplace`, qui contient une fiche par Module. Un Créateur publie en ouvrant une pull request, et la CI du dépôt vérifie chaque fiche. À chaque fusion, la CI construit un `index.json`, les captures d'écran et le site de la Marketplace, servis par un projet Cloudflare Pages gratuit, distinct de celui de l'Hôte. L'Hôte connaît l'adresse de l'index et le lit comme un simple fichier. La Marketplace reste gratuite, pour les Créateurs comme pour les Utilisateurs.

## Considered Options

- **Un backend (Worker et base de données) avec comptes de Créateurs, formulaire d'envoi et API de publication** : rejeté. Le confort de publication ne vaut pas un service à faire tourner, à sécuriser et peut-être à payer. L'ADR 0002 prévoyait un backend pour la marketplace : ce n'est plus nécessaire.
- **Un dépôt privé** : rejeté. Les pull requests des Créateurs viennent de leurs forks, ce qui exige un dépôt public. La publicité de l'historique rend aussi les Approbations et les Bannissements traçables (ADR 0015), et GitHub Actions est gratuit sans limite pour un dépôt public.
- **Netlify** : écarté. Son offre gratuite a un quota mensuel, et un dépassement met le site en pause : la Marketplace disparaîtrait pour tous les Utilisateurs. Cloudflare Pages sert les fichiers statiques sans limite de bande passante.
- **Plusieurs catalogues, ajoutés par l'Utilisateur** (comme les dépôts F-Droid) : écarté pour l'instant. L'installation par URL ou par fichier couvre déjà tout ce qui est hors de la Marketplace. Le format de l'index est documenté, pour que cela reste possible.

## Consequences

- **Vie privée** : l'Hôte télécharge un fichier statique, qui ne dit à personne ce que l'Utilisateur a installé. Il n'y a ni télémétrie, ni compteur de téléchargements, ni notes.
- **Recherche** : elle se fait dans l'Hôte et sur le site, sur l'index téléchargé.
- **Ajouter un backend plus tard** reste possible sans changer ce que lit l'Hôte, tant que l'index garde son format.
- **Commande `publish`** : elle n'existe pas encore. Le jour où elle existera, elle préparera la fiche et ouvrira la pull request, sans parler à un serveur de Tessello.
