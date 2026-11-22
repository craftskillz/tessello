---
status: accepted
---
# Un Module peut lire et écrire des dossiers que l'Utilisateur lui accorde un par un

Le Module Living Documentation (`@craftskillz/living-documentation`) garde des documents Markdown à côté du code, lus et modifiés aussi par des agents de code et par `git`. Le stockage du Module (Convention §6.1) ne convient pas : il écrit chaque clé dans un fichier JSON échappé sous `.tessello/data/`, illisible pour un agent. Proposition : une nouvelle capacité **`files.*`** (Convention 1.x, révision mineure) donne à un Module l'accès en lecture et écriture à des **dossiers accordés** par l'Utilisateur. Chaque dossier est choisi dans le sélecteur de dossiers de l'Hôte au moment où le Module le demande, pas déclaré dans le Manifeste, car il n'est pas connu à l'installation. L'Hôte possède déjà la mécanique : il tient le Dossier des Modules par l'API File System Access (ADR 0007).

Un prototype jetable (Chrome 157, macOS, 2026-11-22, dans `tessello-living-documentation/prototypes/`) a validé la forme ci-dessous depuis une iframe `srcdoc` avec le `sandbox`, le `allow` et la CSP exacts d'une View.

## Forme

- **Manifeste** : une Permission `folders` (sans entrées) déclare que le Module *peut demander* des dossiers. Elle est **sensible** : l'écran d'accord la met en évidence.
- **Accord** : `folders.request` ouvre le sélecteur de l'Hôte. Le choix de l'Utilisateur vaut accord. Le Module reçoit un identifiant opaque et un nom d'affichage, jamais le chemin absolu. Un dossier déjà accordé (même entrée) rend son identifiant existant. `folders.list` (avec l'état `granted` ou `prompt`), `folders.reconnect` et `folders.release` complètent. L'Hôte liste les dossiers accordés dans les réglages du Module et permet de les révoquer.
- **Geste de l'Utilisateur** : le sélecteur et la reconnexion exigent l'activation de la page. Un clic dans l'iframe active aussi l'Hôte, mais brièvement : le Module doit envoyer `folders.request` et `folders.reconnect` directement depuis le clic, sans attente préalable. Sinon l'Hôte répond `user_gesture_required`.
- **Fichiers** : `files.list`, `files.read`, `files.write`, `files.move` et `files.delete`. Chaque requête porte l'identifiant du dossier et un chemin relatif confiné à ce dossier (`..`, chemins absolus et liens symboliques sortants sont refusés). Le contenu est texte ou binaire ; le binaire passe en `ArrayBuffer` transférable (des fichiers de paquets git font des dizaines de Mo).
- **Concurrence** : `files.list` et `files.read` renvoient une version (`lastModified:size`). `files.write` accepte `ifVersion` et échoue avec `conflict` si le fichier a changé depuis : le prototype détecte une sauvegarde faite dans un éditeur extérieur.
- **Déplacement** : `files.move` déplace un fichier par `FileSystemFileHandle.move`. Chrome n'offre pas `move` pour un dossier du système de fichiers local : l'Hôte copie l'arborescence puis supprime la source, et refuse si la destination existe. Une copie interrompue laisse les deux arborescences ; l'Hôte le dit dans l'erreur.
- **Dossier englobant** : `folders.request` accepte une option `mustContain: <identifiant>` ; l'Hôte refuse avec `not_containing` un dossier choisi qui ne contient pas ce dossier déjà accordé (`FileSystemDirectoryHandle.resolve`). Living Documentation : dépôt git qui contient le dossier de documentation, lu par isomorphic-git.
- **Test** : l'Hôte de test public du SDK (ADR 0019) offre les mêmes requêtes sur un dossier en mémoire, avec de quoi simuler une modification extérieure et un accord perdu.

## Considered Options

- **Des clés du stockage écrites en fichiers bruts (par exemple, une clé finissant par `.md`)** : écartée. Les noms de fichiers sont échappés et à plat, sans vrais sous-dossiers, et l'emplacement reste caché sous `.tessello/data/`.
- **Un serveur local déclaré en `localNetwork`** : écartée pour les raisons de l'ADR 0020 (même origine `null` pour tous les Modules, Permission sensible, CORS).

## Consequences

- Un Module qui a reçu un dossier peut y écrire n'importe quel fichier : l'accord porte sur le dossier entier, comme le sélecteur de Chrome.
- Les dossiers accordés sont hors du Dossier des Modules : ni l'export de l'Hôte ni `tessello sync` ne les couvrent. Leur versionnement relève de leur propre dépôt.
- Après un redémarrage de Chrome, chaque dossier accordé revient à l'état `prompt` (constaté par le prototype). Le Module le voit « indisponible » et propose **Reconnecter** ; un clic par dossier le rend `granted`.
- Le déplacement d'un dossier n'est pas atomique.
