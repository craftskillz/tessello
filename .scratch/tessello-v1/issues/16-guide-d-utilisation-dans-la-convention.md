# 16: Guide d'utilisation obligatoire dans la Convention et le Validateur

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Décision : ADR 0010.

**What to build:** Chaque Module livre un Guide d'utilisation : un fichier Markdown de son paquet, nommé par le champ `guide` du Manifeste, que l'Hôte pourra montrer à l'Utilisateur (ticket 17). La Convention le décrit et le rend obligatoire, et le Validateur refuse un Module sans Guide d'utilisation lisible. Un Créateur qui lance `tessello validate` sait donc, avant toute installation, que son Module est documenté.

**Blocked by:** aucun

**Status:** resolved

### Convention

- [x] §3 : le champ `guide` est obligatoire. C'est le chemin d'un fichier `.md` du paquet, en Markdown (CommonMark, avec les tableaux de GitHub).
- [x] Une nouvelle section dit ce que l'Hôte affiche d'un Guide d'utilisation :
  - le HTML brut s'affiche comme du texte ;
  - seules les images du paquet sont montrées, référencées par un chemin relatif au Guide ; une image distante n'est jamais chargée ;
  - les liens `https:`, `http:` et `mailto:` s'ouvrent dans un nouvel onglet, et les liens `#…` mènent aux titres du Guide ;
  - aucun script ne tourne.
- [x] La même section recommande, sans l'imposer, ce qu'un Guide d'utilisation explique : à quoi sert le Module, comment se servir de la Vue et du Widget, où vont les données et ce que fait une désinstallation.
- [x] §9 liste les nouvelles erreurs et les nouveaux avertissements. §12 renvoie à l'ADR 0010 : un champ obligatoire ajouté à une Convention encore en brouillon.

### Validateur

- [x] Erreurs : `guide` absent (`manifest/field-required`), pas une chaîne (`manifest/invalid-type`), chemin dangereux ou fichier absent (`manifest/unsafe-path`, `manifest/file-not-found`), fichier qui n'est pas en `.md` (`manifest/guide-not-markdown`), Guide vide ou fait seulement d'espaces (`guide/empty`).
- [x] Avertissements : une image du Guide manque dans le paquet (`guide/missing-image`), ou bien elle est distante et l'Hôte ne la montrera pas (`guide/remote-image`).
- [x] Tests unitaires de chaque code, là où le Validateur est testé.

### Modules d'exemple et tests

- [x] `examples/notes` et `examples/meteo` reçoivent un court Guide d'utilisation et passent le Validateur sans erreur ni avertissement.
- [x] Le Survival Kit reçoit au moins un Guide minimal, que le ticket 18 remplace.
- [x] Les Manifestes écrits par les tests (Validateur, CLI, cœur de l'Hôte, tests navigateur) déclarent un Guide d'utilisation.

## Comments

### Décisions prises à l'écriture du ticket (2026-10-19)

Demande de l'utilisateur : « l'info doit aussi donner accès à une documentation utilisateur ; elle fait partie de la Convention et le Validateur la rend obligatoire ».

Choix de l'agent, à contester si besoin :

- **Markdown plutôt qu'une page HTML.** Un LLM l'écrit sans effort, il se lit tel quel dans un dépôt git, et l'Hôte peut l'afficher sans exécuter de code du Module. Une page HTML aurait demandé une troisième surface sandboxée, avec son handshake.
- **Un seul fichier, sans variante par langue.** L'Hôte n'a encore qu'une langue (ticket 10). Un Guide d'utilisation par `locale` viendra avec ce ticket, sous la forme d'un ajout optionnel au Manifeste.
- **Nom du champ : `guide`.** Il reprend le terme du glossaire, Guide d'utilisation.
- **Images du paquet seulement.** Le Guide d'utilisation reste lisible hors ligne et ne contacte aucun serveur, quelles que soient les Permissions du Module.

### Implémentation (2026-10-19)

- **Lecture des images partagée.** `guideImagePath` et `guideImageSources`, dans `@tessello/convention`, servent au Validateur comme à l'Hôte. Ils reposent sur le lexer de `marked`, si bien que tous deux voient les mêmes images, y compris dans les tableaux et les liens.
- **Images acceptées** : `.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` et `.avif`. Un chemin qui mène à un autre fichier du paquet (un `.txt`, le Guide lui-même) est signalé par `guide/missing-image`.
- **§12** : « ajouter un champ obligatoire » figure désormais parmi les changements incompatibles. Une phrase précise qu'une Convention encore à l'état de brouillon peut changer sans nouvelle version.
