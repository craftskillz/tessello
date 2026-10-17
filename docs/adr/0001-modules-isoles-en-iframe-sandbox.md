# Les Modules s'exécutent dans une iframe sandbox

Les Modules sont du code non fiable : publiés par n'importe quel Créateur, souvent générés par un LLM, et installés par un grand public qui ne les relit pas. Chaque Module s'exécute donc dans une `<iframe sandbox>` et ne communique avec l'Hôte que par messages (`postMessage`), via l'API définie par la Convention.

## Considered Options

- **Même contexte que l'Hôte** (Web Components, Module Federation) : plus simple et plus fluide, mais un Module pourrait lire les données des autres Modules (tout est stocké localement, dans la même origine) et figer l'Hôte entier. Rejeté : la revue de la marketplace serait alors l'unique barrière de sécurité.
- **Hybride** (même contexte pour les Modules « de confiance ») : rejeté, car il crée deux Conventions à maintenir.

## Consequences

- Le coût habituel de l'iframe (intégration visuelle fine) est faible ici : une seule Vue plein écran est visible à la fois.
- Toute capacité d'un Module (stockage, réseau, navigation…) doit passer par l'API de messages de l'Hôte : cette API *est* la Convention.
