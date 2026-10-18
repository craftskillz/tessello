# 04 bis: Les Modules et leurs données dans le Dossier des Modules

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Décision : ADR 0007. Contrat : la Convention (§6.1, §8).

**What to build:** Prioritaire : à faire avant le ticket 05. Tessello devient ce qu'il doit être : une application à plugins dont chaque Module est un dossier de fichiers web ordinaires, rangé avec ses données dans le **Dossier des Modules** que l'Utilisateur choisit sur sa machine et peut versionner avec git. L'Hôte reste servi par Cloudflare Pages, et rien du dossier n'est envoyé où que ce soit.

Ce ticket corrige deux défauts graves du ticket 04 :

- le navigateur peut effacer sans prévenir le code et les données des Modules ;
- l'Hôte charge en mémoire, au démarrage, tout le code de tous les Modules, puis l'intègre en base64 dans le document de chaque Vue.

L'Hôte ne fonctionne plus que dans Chrome et Edge sur ordinateur (ADR 0007).

**Blocked by:** 04 (Premier Module dans le navigateur)

**Status:** ready-for-agent

### Le dossier

- [ ] Dans un navigateur qui ne permet pas de choisir un dossier (pas de `showDirectoryPicker` : Firefox, Safari, tous les téléphones), l'Hôte affiche seulement une page claire : « Tessello a besoin de Chrome ou Edge sur ordinateur ».
- [ ] Au premier lancement, l'Utilisateur choisit son Dossier des Modules avant toute autre action. Le texte qui accompagne ce choix dit que les données des Modules seront sous `.tessello/data/`, et qu'elles peuvent contenir des secrets à exclure de git si besoin.
- [ ] L'Hôte retient le dossier d'une visite à l'autre. Quand le navigateur redemande l'autorisation, l'Hôte propose de reconnecter le dossier en un clic, et rien d'autre n'est utilisable d'ici là.
- [ ] Choisir un dossier qui contient déjà un `.tessello/` retrouve l'espace tel quel : Modules, Permissions accordées, données. C'est le cas après une perte de la référence du dossier, ou après un `git clone` sur une autre machine.
- [ ] Un réglage montre le Dossier des Modules et permet d'en choisir un autre, où l'Hôte copie Modules et `.tessello/`, sans toucher à l'ancien.

### Les Modules

- [ ] Au démarrage, l'Hôte parcourt les dossiers de premier niveau et ne lit que le Manifeste et l'icône de chacun. Les fichiers d'un Module ne sont lus qu'à l'ouverture de sa Vue.
- [ ] Un dossier apparu dans le Dossier des Modules (`git clone`, copie, Créateur qui travaille sur place) figure dans le Lanceur comme « nouveau, à activer ».
- [ ] L'activer lance le Validateur. Si le Module n'est pas conforme, l'Hôte affiche son rapport. Sinon, il affiche la même fiche que l'installation d'un `.zip`, puis enregistre le Module dans `.tessello/modules.json` (dossier, version, Permissions accordées). Un Module n'est jamais activé sans l'Utilisateur.
- [ ] Déposer un `.zip` valide le décompresse dans un nouveau dossier au nom de son Module (suffixé s'il est pris), puis l'active. Si le Validateur refuse le paquet, rien n'est écrit.
- [ ] Le nom du dossier ne compte pas, seul l'Identifiant compte. Un second dossier qui déclare un Identifiant déjà enregistré est signalé en conflit et ne tourne pas.
- [ ] Un dossier modifié (éditeur, `git pull`) est pris en compte à la prochaine ouverture de la Vue. L'Hôte relance alors le Validateur, et si le Module n'est plus conforme, le rapport remplace la Vue. Un changement de version met à jour le registre et garde les données.
- [ ] Un dossier modifié ne gagne jamais d'accès : la CSP suit les Permissions accordées du registre, jamais le Manifeste relu sur disque. Si le Manifeste déclare des Permissions de plus, le Module ne tourne pas : l'Hôte liste seulement celles qui s'ajoutent et demande l'accord. Refuser laisse le Module inactif, données intactes. L'écran d'accord en langage simple reste au ticket 06 ; ici, une liste brute suffit.
- [ ] Un Module enregistré dont le dossier a disparu (supprimé, renommé, déplacé) apparaît comme introuvable dans le Lanceur, sans casser l'Hôte. S'il réapparaît sous un autre nom, son Identifiant le rattache à son enregistrement et à ses données.

### Les données

- [ ] Le stockage d'un Module (Convention §6.1) est rangé sous `.tessello/data/<Identifiant>/`, à raison d'un fichier JSON indenté par clé. Le fichier contient la clé exacte et sa valeur. Les quotas ne changent pas (ADR 0006).
- [ ] Le nom de fichier dérivé de la clé résiste aux systèmes de fichiers insensibles à la casse (les clés `A` et `a` ne se confondent pas) et à la limite de 255 octets, pour une clé de 256 caractères quelconques.
- [ ] Une écriture interrompue ne laisse jamais un fichier à moitié écrit.
- [ ] La file d'attente par Module du stockage est conservée.

### L'affichage

- [ ] Le document `srcdoc` d'une Vue ne contient plus les fichiers du Module. Les fichiers parviennent à l'iframe en URL `blob:`, et la taille du document ne dépend pas de celle du Module. Un test D le vérifie avec un Module d'environ 9 Mo.

### Tests

- [ ] Les tests du ticket 04 passent toujours.
- [ ] Des tests navigateur couvrent :
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
