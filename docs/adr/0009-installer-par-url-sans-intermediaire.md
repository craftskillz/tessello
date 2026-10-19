# Installer un Module par URL sans intermédiaire

Pour installer un Module depuis une URL, l'Hôte télécharge le `.zip` directement depuis le navigateur. Aucun serveur ne relaie la requête. L'Hôte reste un site statique sans backend (ADR 0002), et rien ne passe par une machine de Tessello. Le prix : le téléchargement ne fonctionne que si le serveur du paquet envoie les en-têtes CORS. C'est le cas de GitHub Pages et de `raw.githubusercontent.com`. Les fichiers des Releases GitHub et le « Download ZIP » d'un dépôt ne les envoient pas.

## Considered Options

- **Un proxy, par exemple un Cloudflare Worker, qui relaie le téléchargement** : rejeté. Il règle CORS pour tous les hébergements, mais c'est un service à faire tourner. Son coût croît avec l'usage, et il voit passer chaque installation, ce qui va contre le local-first.
- **Le Pont, qui fera des appels sans contrainte CORS** : écarté pour l'instant. Le Pont aura son propre grilling et son propre ADR, et l'installation par URL n'en dépendra pas.

## Consequences

- **Message d'erreur** : le navigateur ne distingue pas un refus CORS d'un échec réseau. L'Hôte donne donc un seul message, qui propose de télécharger le `.zip` soi-même et de le déposer dans l'Hôte.
- **Convention** : une note « Publishing your Module » dit aux Créateurs où héberger un `.zip` pour qu'il soit installable par URL.
- **CSP de l'Hôte** : si l'Hôte reçoit sa propre politique de sécurité de contenu (ticket 12), `connect-src` doit autoriser `https:` et `http://localhost` / `http://127.0.0.1` pour les Créateurs.
- **Revenir sur ce choix** reste possible : ajouter un proxy plus tard ne change ni le lien d'installation ni la Convention.
