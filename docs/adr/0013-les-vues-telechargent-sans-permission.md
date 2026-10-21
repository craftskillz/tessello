# Les Vues téléchargent sans Permission, les Widgets jamais

L'Hôte ajoute `allow-downloads` au bac à sable des iframes des **Vues** (`VIEW_SANDBOX`), et pas à celui des **Widgets** (`WIDGET_SANDBOX`). Sans ce jeton, le navigateur bloque tout téléchargement lancé dans l'iframe : une Vue ne pouvait remettre aucun fichier à l'Utilisateur, ni l'export `.drawio` ni le PNG du Module Diagram. Aucune Permission n'est demandée pour cela. Le Manifeste ne change pas, et la Convention (§4) le documente en révision mineure : elle ajoute une capacité sans rien retirer, et le §12 range désormais les capacités de l'environnement d'exécution parmi les ajouts mineurs.

Pas de Permission, parce que télécharger un fichier que l'Utilisateur vient de demander ne lui donne aucun accès nouveau. Le fichier ne quitte pas sa machine, aucun serveur n'est joint, et le Module n'écrit que là où le navigateur range les téléchargements, ou là où l'Utilisateur l'a choisi. C'est une exception assumée à l'ADR 0004, selon lequel toute capacité future s'ajoute comme une Permission : l'écran d'accord dirait « peut vous proposer des fichiers à télécharger », ce qui n'apprend rien à l'Utilisateur et allonge la liste qu'il doit lire.

Pas de téléchargement depuis un Widget, parce qu'un Widget est un aperçu, affiché sur l'Accueil à côté des autres. Un fichier doit venir d'un geste dans la Vue, où l'on sait quel Module le propose. Un Widget qui veut proposer un fichier ouvre sa Vue (`navigation.openView`).

## Mesures (ticket 13)

Test navigateur `packages/host/e2e/downloads.test.ts`, Chromium (Playwright) :

- Un lien `download` vers un `blob:` créé dans l'origine opaque de la Vue (`URL.createObjectURL`) produit un téléchargement, avec le nom demandé et le contenu exact. Il en va de même pour un `data:` URL.
- Le même lien dans un Widget ne produit aucun téléchargement : le clic atteint bien le script, mais aucun événement `download` n'arrive dans la seconde qui suit.

Firefox et Safari n'ont pas été mesurés : l'Hôte ne tourne aujourd'hui que dans Chrome et Edge (ADR 0007).

## Considered Options

- **Une Permission `downloads`, présentée à l'installation** : écartée. Elle ne protège de rien (voir plus haut). Elle obligerait aussi tout Module qui exporte à la déclarer, et une mise à jour qui l'ajoute demanderait un nouvel accord (ADR 0004).
- **`allow-downloads` aussi pour les Widgets** : écarté. Un Widget pourrait déclencher un téléchargement depuis l'Accueil, sans que l'Utilisateur sache d'où il vient.
- **Faire passer le fichier par l'Hôte (une requête du protocole, l'Hôte téléchargeant à la place du Module)** : écarté. Le résultat est le même pour l'Utilisateur, mais il faut un nouveau message, une limite de taille et du code dans le SDK, alors que le navigateur le fait déjà.

## Consequences

- **Modules** : une Vue propose un fichier par un lien `download` vers un `blob:` ou un `data:` URL, à la suite d'un geste de l'Utilisateur. Seul ce cas a été mesuré : un téléchargement lancé sans geste n'a pas été essayé.
- **Validateur** : rien ne change. Il ne peut pas savoir statiquement si un lien `download` est créé dans une Vue ou dans un Widget, et le blocage dans le Widget est réel.
- **Presse-papiers** : `allow-downloads` ne change rien au presse-papiers d'images, toujours refusé dans le bac à sable (ticket 15 de tessello-v1). Ce point reste ouvert.
