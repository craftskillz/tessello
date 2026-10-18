# 04 bis: Les Modules et leurs données dans le Dossier des Modules

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Décision : ADR 0007. Contrat : la Convention (§6.1, §8).

**What to build:** Prioritaire : à faire avant le ticket 05. Tessello devient ce qu'il doit être : une application à plugins dont chaque Module est un dossier de fichiers web ordinaires, rangé avec ses données dans le **Dossier des Modules** que l'Utilisateur choisit sur sa machine et peut versionner avec git. L'Hôte reste servi par Cloudflare Pages, et rien du dossier n'est envoyé où que ce soit.

Ce ticket corrige deux défauts graves du ticket 04 :

- le navigateur peut effacer sans prévenir le code et les données des Modules ;
- l'Hôte charge en mémoire, au démarrage, tout le code de tous les Modules, puis l'intègre en base64 dans le document de chaque Vue.

L'Hôte ne fonctionne plus que dans Chrome et Edge sur ordinateur (ADR 0007).

**Blocked by:** 04 (Premier Module dans le navigateur)

**Status:** resolved

### Le dossier

- [x] Dans un navigateur qui ne permet pas de choisir un dossier (pas de `showDirectoryPicker` : Firefox, Safari, tous les téléphones), l'Hôte affiche seulement une page claire : « Tessello a besoin de Chrome ou Edge sur ordinateur ».
- [x] Au premier lancement, l'Utilisateur choisit son Dossier des Modules avant toute autre action. Le texte qui accompagne ce choix dit que les données des Modules seront sous `.tessello/data/`, et qu'elles peuvent contenir des secrets à exclure de git si besoin.
- [x] L'Hôte retient le dossier d'une visite à l'autre. Quand le navigateur redemande l'autorisation, l'Hôte propose de reconnecter le dossier en un clic, et rien d'autre n'est utilisable d'ici là.
- [x] Choisir un dossier qui contient déjà un `.tessello/` retrouve l'espace tel quel : Modules, Permissions accordées, données. C'est le cas après une perte de la référence du dossier, ou après un `git clone` sur une autre machine.
- [x] Un réglage montre le Dossier des Modules et permet d'en choisir un autre, où l'Hôte copie Modules et `.tessello/`, sans toucher à l'ancien.

### Les Modules

- [x] Au démarrage, l'Hôte parcourt les dossiers de premier niveau et ne lit que le Manifeste et l'icône de chacun. Les fichiers d'un Module ne sont lus qu'à l'ouverture de sa Vue.
- [x] Un dossier apparu dans le Dossier des Modules (`git clone`, copie, Créateur qui travaille sur place) figure dans le Lanceur comme « nouveau, à activer ».
- [x] L'activer lance le Validateur. Si le Module n'est pas conforme, l'Hôte affiche son rapport. Sinon, il affiche la même fiche que l'installation d'un `.zip`, puis enregistre le Module dans `.tessello/modules.json` (dossier, version, Permissions accordées). Un Module n'est jamais activé sans l'Utilisateur.
- [x] Déposer un `.zip` valide le décompresse dans un nouveau dossier au nom de son Module (suffixé s'il est pris), puis l'active. Si le Validateur refuse le paquet, rien n'est écrit.
- [x] Le nom du dossier ne compte pas, seul l'Identifiant compte. Un second dossier qui déclare un Identifiant déjà enregistré est signalé en conflit et ne tourne pas.
- [x] Un dossier modifié (éditeur, `git pull`) est pris en compte à la prochaine ouverture de la Vue. L'Hôte relance alors le Validateur, et si le Module n'est plus conforme, le rapport remplace la Vue. Un changement de version met à jour le registre et garde les données.
- [x] Un dossier modifié ne gagne jamais d'accès : la CSP suit les Permissions accordées du registre, jamais le Manifeste relu sur disque. Si le Manifeste déclare des Permissions de plus, le Module ne tourne pas : l'Hôte liste seulement celles qui s'ajoutent et demande l'accord. Refuser laisse le Module inactif, données intactes. L'écran d'accord en langage simple reste au ticket 06 ; ici, une liste brute suffit.
- [x] Un Module enregistré dont le dossier a disparu (supprimé, renommé, déplacé) apparaît comme introuvable dans le Lanceur, sans casser l'Hôte. S'il réapparaît sous un autre nom, son Identifiant le rattache à son enregistrement et à ses données.

### Les données

- [x] Le stockage d'un Module (Convention §6.1) est rangé sous `.tessello/data/<Identifiant>/`, à raison d'un fichier JSON indenté par clé. Le fichier contient la clé exacte et sa valeur. Les quotas ne changent pas (ADR 0006).
- [x] Le nom de fichier dérivé de la clé résiste aux systèmes de fichiers insensibles à la casse (les clés `A` et `a` ne se confondent pas) et à la limite de 255 octets, pour une clé de 256 caractères quelconques.
- [x] Une écriture interrompue ne laisse jamais un fichier à moitié écrit.
- [x] La file d'attente par Module du stockage est conservée.

### L'affichage

- [x] Le document `srcdoc` d'une Vue ne contient plus les fichiers du Module. Les fichiers parviennent à l'iframe en URL `blob:`, et la taille du document ne dépend pas de celle du Module. Un test D le vérifie avec un Module d'environ 9 Mo.

### Tests

- [x] Les tests du ticket 04 passent toujours.
- [x] Des tests navigateur couvrent :
  - la page « non pris en charge » ;
  - le choix, la reconnexion et le changement de dossier ;
  - la réouverture d'un dossier existant ;
  - l'installation d'un `.zip` dans un dossier ;
  - l'activation d'un dossier ajouté ;
  - un conflit d'Identifiant ;
  - la modification d'un fichier ;
  - des Permissions ajoutées sur disque ;
  - un Module introuvable ;
  - les fichiers de données (une clé par fichier, clés à casse différente) ;
  - la taille du document.

## Notes pour l'implémentation

- **Tests D** : Playwright ne pilote pas le sélecteur de dossier natif. Les tests remplacent `showDirectoryPicker` par un script d'initialisation qui renvoie un dossier de l'OPFS (`navigator.storage.getDirectory()`), car il a la même interface `FileSystemDirectoryHandle`. Pour la reconnexion, `queryPermission` est remplacé et répond `"prompt"`. Pour la page « non pris en charge », `showDirectoryPicker` est supprimé. Les modifications « à la main » (ajout de dossier, édition, `git pull`) sont simulées en écrivant dans ce dossier OPFS. Les tests ne tournent plus qu'en Chromium (`BROWSER` disparaît).
- **Cœur de l'Hôte** : l'interface `Persistence` reste la frontière, avec une implémentation en mémoire pour le point d'entrée C. Elle se sépare en trois :
  - le registre, dans `.tessello/modules.json` ;
  - la lecture d'un Module : son Manifeste et son icône, ou tous ses fichiers ;
  - le stockage.

  La règle « Permissions de plus sur disque, le Module ne tourne pas » se teste au point d'entrée C. L'implémentation IndexedDB du ticket 04 est remplacée : seule la référence du dossier reste dans IndexedDB.
- **Nom de fichier d'une clé** : une piste est de garder `[a-z0-9_-]` tels quels et d'échapper tout le reste, majuscules comprises, en `%XX` (UTF-8). Au-delà d'environ 200 octets, le nom est tronqué et suffixé d'un hachage de la clé. Lister les clés revient à lire le champ `key` de chaque fichier.
- **URL `blob:`** : le mécanisme est à vérifier par un test D au début du ticket. La piste : un petit chargeur dans le `srcdoc`, placé après la CSP, reçoit les fichiers transférés par `postMessage` (`ArrayBuffer`), crée les URL `blob:` dans l'iframe, puis écrit le document de l'entrée réécrit (`document.open/write`). Il faut vérifier que la CSP du `<meta>` reste appliquée après `document.write`. Le chargeur n'accepte qu'un seul message de l'Hôte, avant que le code du Module ne tourne. L'import map et la réécriture des imports (`es-module-lexer`) restent nécessaires.
- **Cloudflare et origine** : l'autorisation du dossier et sa référence appartiennent à l'origine de l'Hôte. Le domaine Cloudflare et `localhost` en développement sont donc deux espaces distincts, à signaler à l'Utilisateur. Le contenu du dossier, lui, est le même.
- **Écriture sûre** : `createWritable()` écrit dans un fichier temporaire et ne remplace l'original qu'à `close()`. Il faut s'appuyer dessus.
- **Fichiers ignorés** : en plus de ce qu'ignore déjà le Validateur (`__MACOSX/`, `.DS_Store`), la lecture d'un Module ignore `.git/`. Le parcours du Dossier ignore `.tessello/` et tout dossier caché.

## Conséquences sur les autres tickets

- 05 (Accueil et Widgets) : un Widget se lit comme une Vue, depuis le dossier. La disposition de l'Accueil est dans `.tessello/home.json`.
- 06 (Permissions) : il remplace la liste brute par l'écran d'accord, à l'activation d'un dossier comme à l'installation d'un `.zip`.
- 07 (Mise à jour et désinstallation) : une mise à jour peut venir d'un `.zip` ou d'un dossier modifié. La désinstallation supprime le dossier du Module, `.git` compris, et ses données, après une confirmation qui le dit.
- 08 (Installation par URL et CLI) : `tessello install` ne prend plus de dossier, puisqu'il suffit de le placer dans le Dossier des Modules. Le ticket est à revoir.
- 09 (Export et import) : l'export lit le dossier et l'import l'écrit.
- 12 (Déploiement) : PWA sur ordinateur seulement, et page « non pris en charge ».
- 14 (Skill de création) : la skill peut faire travailler le LLM directement dans un dossier du Dossier des Modules.

## Hors périmètre

- Suivre en direct les modifications du dossier pendant qu'une Vue est ouverte (`FileSystemObserver`).
- Toute commande git lancée par l'Hôte : l'Utilisateur gère git lui-même.

## Comments

### Implémentation (2026-10-18)

- **Affichage** (`packages/host/src/srcdoc.ts`) : `buildView` remplace `buildSrcdoc`.
  - Le `srcdoc` ne contient que la CSP et un chargeur, quelle que soit la taille du Module.
  - L'Hôte poste les fichiers une fois, au `load` de l'iframe (`ArrayBuffer` transférés). Le chargeur n'accepte qu'un message, venu de `parent`. Il crée les URL `blob:` dans l'iframe, en commençant par les feuilles de style, une fois que les fichiers qu'elles référencent ont la leur. Il remplace ensuite les URL de paquet du document de l'entrée, puis l'écrit par `document.open/write/close`.
  - Les références locales sont réécrites côté Hôte en URL sous `https://package.tessello.invalid/`, échappées pour ne contenir ni guillemet, ni parenthèse, ni espace. L'import map et `es-module-lexer` restent.
  - Vérifié par test D : la CSP du `<meta>` du `srcdoc` reste appliquée après `document.open`. Le document écrit la répète.
- **Cœur de l'Hôte** (`packages/host-core`) :
  - `Persistence` est séparée en `registry` (`.tessello/modules.json`), `folders` (lister, lire un fichier, lire tous les fichiers, créer un dossier) et `storage`. `createMemoryPersistence()` expose `disk` pour que les tests modifient le dossier « à la main ».
  - `src/modules.ts` remplace `registry.ts` :
    - `host.modules()` parcourt le Dossier et renvoie des entrées `active` / `new` / `conflict` / `missing`, en ne lisant que le Manifeste et l'icône. Un Module renommé est rattaché par son Identifiant.
    - `host.inspectFolder(folder)` et `host.inspectZip(zip)` renvoient `invalid`, `conflict` ou `valid` avec `install()`.
    - `host.open(id)` relit les fichiers et relance le Validateur. Il renvoie `ready` (avec les Permissions accordées du registre), `missing`, `invalid`, ou `permissions` (seulement celles qui s'ajoutent, avec `accept()`).
- **Navigateur** :
  - `src/folder-persistence.ts` : la persistance sur le `FileSystemDirectoryHandle` du Dossier des Modules.
    - Une clé par fichier JSON indenté, sous `.tessello/data/<Identifiant>/`.
    - Le nom de fichier garde `[a-z0-9_-]` et échappe le reste en `%XX`, ainsi que la première lettre d'un nom réservé par Windows (`con`, `nul`…). Au-delà de 200 octets, il est tronqué et suffixé de `~` et d'un hachage SHA-256.
    - Les écritures passent par `createWritable()`.
  - `src/modules-folder.ts` : la référence du dossier, dans la base IndexedDB `tessello-host`, ainsi que l'autorisation et le sélecteur.
  - `main.ts` :
    - écrans « non pris en charge », choix du dossier et reconnexion ;
    - réglage « Modules folder » : il copie Modules et `.tessello/`, le registre en dernier ;
    - états du Lanceur, activation, rapport ou demande de Permissions à la place de la Vue.
- **Tests D** : Chromium seulement (`BROWSER` disparaît). `showDirectoryPicker` renvoie un dossier de l'OPFS. Nouveaux fichiers : `modules-folder.test.ts`, `folder-modules.test.ts`, `data-files.test.ts`, `document-size.test.ts`, et un test de CSP dans `package-files.test.ts`.
- **Choix et limites** :
  - Un `.zip` dont l'Identifiant est déjà enregistré est refusé sans rien écrire. La mise à jour par `.zip` revient au ticket 07.
  - Le dossier créé pour un `.zip` porte le nom de l'Identifiant après le `/` (`notes`).
  - Un dossier cible qui contient déjà `.tessello/modules.json` est pris tel quel au changement de dossier, sans copie.
  - La page de reconnexion propose aussi de choisir un autre dossier.
  - Le Lanceur est relu au démarrage, après une installation ou une ouverture, et quand la fenêtre reprend le focus.
  - Refuser des Permissions ajoutées ramène à l'Accueil : la demande revient à chaque ouverture, et le Lanceur ne marque pas le Module comme inactif.
  - L'ancienne base IndexedDB `tessello` du ticket 04 n'est ni migrée ni supprimée.
  - Aucun test ne couvre l'écriture interrompue : elle repose sur `createWritable()`. Une décompression ou une copie interrompue peut laisser un dossier incomplet.
  - Les noms de dossier dérivés d'un Identifiant (`.tessello/data/@x/con/`) ne sont pas protégés des noms réservés par Windows.
