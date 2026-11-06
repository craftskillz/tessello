# Git Integration et `tessello sync` se parlent par les fichiers du stockage du Module

Versionner le Dossier des Modules avec git demande de lire tous ses fichiers et de lancer `git`, ce qu'aucun Module ne peut faire depuis son iframe (Convention §4, §6). Le moteur est donc une commande du CLI, `tessello sync`, que l'Utilisateur lance dans son Dossier des Modules. L'écran de configuration et de suivi est un Module ordinaire de la Marketplace, `@craftskillz/git-integration`. Les deux ne se parlent qu'à travers les fichiers du stockage de ce Module, `.tessello/data/@craftskillz/git-integration/` (ADR 0007). Le Module écrit la clé `config`, que la commande lit sur le disque. La commande écrit la clé `status`, que le Module relit par `storage.get`, puisque l'Hôte relit le disque à chaque requête, sans cache. Ainsi, le Module ne demande aucune Permission, et rien n'écoute sur un port de la machine.

## Considered Options

- **Un Module qui parle à un serveur local de `tessello sync` (`localNetwork`, `http://localhost:<port>`)** : rejeté. Toutes les iframes de Modules ont la même origine `null`, donc tout Module qui déclare ce port pourrait piloter git : il faudrait un jeton d'appairage. Il faudrait aussi une Permission sensible et la question d'accès au réseau local de Chrome (ADR 0012).
- **git dans l'Hôte (isomorphic-git sur le Dossier des Modules)** : rejeté. Le commit marcherait, mais pas le push : le git HTTP de GitHub n'envoie pas d'en-têtes CORS, et un proxy irait contre l'ADR 0009. Ce serait aussi beaucoup de code dans l'Hôte pour une fonction optionnelle.
- **Une configuration dans un fichier propre à `tessello sync`, sans Module** : écarté comme seule interface. L'Utilisateur veut configurer et voir les alertes depuis l'Hôte. Le canal choisi ne l'empêche pas : `config.json` reste un fichier lisible et modifiable à la main.

## Consequences

- **Couplage** : `tessello sync` dépend du format interne du Dossier des Modules (un fichier `{ "key", "value" }` par clé, nom de fichier encodé, registre `.tessello/modules.json`), pas seulement de la Convention. C'est acceptable parce que la commande vit dans le même dépôt que l'Hôte. Un changement de ce format doit mettre à jour les deux.
- **Si l'Hôte ajoute un jour un cache du stockage**, le Module ne verrait plus le `status`. Ce canal devient alors une contrainte de l'Hôte : il doit relire le disque, ou détecter les changements faits hors de lui.
- **Écritures** : seul le Module écrit `config`, seule la commande écrit `status`. La commande écrit de façon atomique (fichier temporaire sans extension `.json`, que l'Hôte ignore, puis renommage).
- **Pas de push en temps réel** : le Module relit `status` à intervalle régulier quand il est visible. Le délai d'affichage est de quelques secondes.
- **Le Pont** : ce n'est pas lui. Le Pont reste à concevoir. Le jour où il existera, Git Integration pourra passer par lui sans changer ce que voit l'Utilisateur.
- **Ce que fait la commande** : uniquement commit et push, jamais de `pull`, de fusion ni de `--force`. Un push refusé devient une alerte du Module, que l'Utilisateur règle à la main (spec `.scratch/git-integration/spec.md`).
