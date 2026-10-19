# Chaque Module livre un Guide d'utilisation en Markdown, que l'Hôte affiche sans l'exécuter

Le Manifeste nomme un Guide d'utilisation (`guide`), un fichier Markdown du paquet. Ce champ est obligatoire : le Validateur refuse un Module sans Guide d'utilisation, ou dont le Guide est vide. L'Hôte le convertit lui-même en HTML et l'affiche dans une iframe sandbox sans script, dont la CSP n'autorise que les images `data:` et les styles en ligne. Le HTML brut du Markdown s'y affiche comme du texte, et seules les images du paquet sont montrées.

Ce champ obligatoire entre dans la Convention 1, alors que §12 classe un tel ajout comme incompatible (`convention: 2`). C'est une exception : la Convention 1 est encore un brouillon, et aucun Module n'a été publié (ni marketplace, ni paquet npm, tickets 12 et 13). Une fois la Convention 1 publiée, la règle de §12 s'appliquera sans exception.

## Considered Options

- **Une page HTML du Module, comme une troisième surface** : rejeté. Elle aurait demandé un handshake, un thème et une CSP de plus, et un Guide d'utilisation n'a besoin d'aucun code. Le Markdown s'écrit sans effort, à la main comme par un LLM, et se lit tel quel dans un dépôt git.
- **Un Guide facultatif, signalé par un avertissement** : rejeté. L'Utilisateur doit toujours pouvoir apprendre à se servir d'un Module depuis l'Hôte, et une marketplace ne veut pas de Module sans mode d'emploi.
- **Une URL externe (site du Créateur)** : rejeté. Le lien serait périmé hors ligne et pourrait changer sans nouvelle version, ce qui irait contre le local-first (ADR 0002).
- **Un Markdown rendu dans l'iframe du Module, par son propre code** : rejeté. Un Guide qui exécute du code n'apporte rien, et le rendu de l'Hôte donne à tous les Guides la même présentation.

## Consequences

- **Validateur** : `manifest/guide-not-markdown` et `guide/empty` sont des erreurs ; `guide/missing-image` et `guide/remote-image` sont des avertissements.
- **Modules d'exemple et tests** : tous déclarent un Guide d'utilisation.
- **Skill de création (ticket 14)** : elle doit faire écrire un Guide d'utilisation à chaque Module.
- **Langue (ticket 10)** : un Guide par `locale` sera un ajout optionnel au Manifeste, compatible avec cette décision.
