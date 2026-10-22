# Les Modules et leurs données vivent dans un dossier local, versionnable avec git

Tessello est une application modulaire à la manière d'un logiciel à plugins. Chaque Module est un dossier de fichiers web ordinaires, indépendant des autres. L'Hôte est servi par Cloudflare Pages, mais le code et les données des Modules restent sur la machine de l'Utilisateur, dans le **Dossier des Modules** qu'il choisit (API File System Access). Ils ne sont plus dans le stockage du navigateur. Ce stockage peut être vidé sans prévenir (disque plein, règle des 7 jours de Safari), et il est invisible pour l'Utilisateur. Avec un dossier sur disque, rien n'est perdu à l'insu de l'Utilisateur et rien ne quitte sa machine. L'Utilisateur ou le Créateur peut lire et modifier chaque fichier avec ses propres outils, et versionner les Modules avec git. Le prix : l'Hôte ne fonctionne que dans **Chrome et Edge sur ordinateur**, les seuls navigateurs qui laissent une page choisir un dossier. Ce choix revient en partie sur l'ADR 0002, qui gardait tout dans le navigateur.

## Organisation du dossier

```
<Dossier des Modules>/
├── notes/                       ← un Module : son dossier, au nom libre (celui d'un git clone, par exemple)
│   ├── manifest.json
│   └── view/…
├── meteo/
└── .tessello/
    ├── modules.json             ← registre : Identifiant → dossier, version, Permissions accordées
    ├── home.json                ← disposition de l'Accueil
    └── data/@craftskillz/notes/ ← données d'un Module : un fichier JSON indenté par clé
```

- **L'identité d'un Module** est l'Identifiant de son Manifeste, pas le nom de son dossier (ADR 0003). Deux dossiers qui déclarent le même Identifiant sont en conflit : seul celui qui est enregistré tourne, et l'autre est signalé.
- **Les données sont rangées hors du dossier de code.** Un dossier de Module peut ainsi être le dépôt git de son Créateur sans jamais recevoir les données de l'Utilisateur. L'Utilisateur peut aussi versionner tout le Dossier des Modules, données comprises.
- **Un fichier par clé**, JSON indenté. Les différences git restent courtes, et deux machines qui modifient des clés différentes fusionnent sans conflit. Le nom du fichier encode la clé : il doit résister aux systèmes de fichiers insensibles à la casse et à la limite de 255 octets par nom. La clé exacte est donc aussi écrite dans le fichier.
- **Un Module entre dans le Dossier par un dossier** : `git clone`, copie, ou Créateur qui travaille sur place. L'Hôte le détecte, lance le Validateur et demande l'accord des Permissions avant de le faire tourner. Un `.zip` ou une URL n'est qu'un autre moyen de créer ce dossier.

## Considered Options

- **Stockage du navigateur (IndexedDB ou OPFS), avec stockage persistant demandé** : rejeté. Chrome n'accorde `navigator.storage.persist()` qu'à certains sites et refuse les autres sans le dire, et les fichiers resteraient invisibles.
- **Dossier là où le navigateur le permet, stockage du navigateur ailleurs** (téléphones, Firefox, Safari) : rejeté. Deux modes de stockage aux garanties différentes.
- **Données dans IndexedDB, ou dans une base placée dans le dossier** : rejeté. IndexedDB comme SQLite en WebAssembly ne persistent que dans le profil du navigateur. Les données sont donc des fichiers JSON.
- **Données dans le dossier de chaque Module** : rejeté. Un Utilisateur qui pousse vers le dépôt du Créateur y publierait ses données.
- **Un fichier JSON par Module** : rejeté. Toute modification concurrente entre deux machines entre en conflit dans git.

## Consequences

- **Navigateurs** : seulement Chrome et Edge sur ordinateur. Les autres navigateurs, dont tous ceux des téléphones, affichent une page « navigateur non pris en charge ». La PWA reste installable sur ordinateur, mais plus sur téléphone.
- **Autorisation du dossier** : l'Hôte garde la référence du dossier dans IndexedDB. Ce n'est qu'un pointeur : s'il est perdu, l'Utilisateur choisit à nouveau le même dossier et retrouve tout, puisque le registre est dans `.tessello/`. Le navigateur peut redemander l'autorisation à chaque session. Elle appartient à l'origine de l'Hôte (le domaine Cloudflare), donc `localhost` en développement a sa propre autorisation.
- **Sécurité** : un dossier modifié (`git pull`, éditeur) ne gagne jamais d'accès. La CSP suit les Permissions accordées que l'Hôte a enregistrées, jamais le Manifeste relu sur disque. Si de nouvelles Permissions apparaissent, l'Hôte ne présente que celles qui s'ajoutent, et le Module ne tourne pas tant que l'Utilisateur ne les a pas acceptées (ADR 0004).
- **Données et git** : les données peuvent contenir des secrets (jetons d'API). Elles sont toutes sous `.tessello/data/`, et l'Utilisateur décide s'il les versionne. L'Hôte le lui signale quand il choisit son dossier.
- **ADR 0005** : le document `srcdoc` et sa CSP en `<meta>` restent. Les fichiers ne sont plus intégrés en URL `data:` : ils parviennent à l'iframe en URL `blob:`, pour que la taille du document ne dépende plus de celle du Module.
- **Export et import (ADR 0002)** : l'export lit le dossier et l'import l'écrit. Pour qui utilise git, le dépôt joue le même rôle.
