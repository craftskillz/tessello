# Spec : Tessello V1

**Status:** ready-for-agent

Vocabulaire : voir `GLOSSARY.md` (termes français, terme anglais officiel entre parenthèses). Décisions structurantes : ADR 0001 à 0004 dans `docs/adr/`. Contrat de référence : la Convention (`convention/CONVENTION.md`).

## Problem Statement

Les makers et les développeurs savent aujourd'hui faire générer par un LLM de petites applications web utiles (un suivi de métriques, un bloc-notes, une météo), mais ces créations restent éparpillées : un fichier HTML par-ci, un projet par-là, sans endroit commun pour les ranger, les ouvrir, leur donner une place, conserver leurs données ou les partager. Rien ne garantit non plus qu'une application générée par un LLM ou écrite par un inconnu ne lira pas les données des autres, ni n'enverra des informations n'importe où ; le grand public, qui ne relit pas le code, ne peut donc pas les adopter sereinement.

## Solution

Tessello est une application modulaire, à la manière d'un logiciel à plugins. L'**Hôte** est une PWA servie en site statique. L'**Utilisateur** y ajoute des **Modules**, chacun indépendant des autres. Un Module est un dossier de fichiers web ordinaires (HTML, JavaScript, CSS, images, tout ce qu'un navigateur sait exécuter), rangé avec ses données dans le **Dossier des Modules** de l'Utilisateur. L'Utilisateur peut versionner ce dossier avec git, un Module à la fois ou tout le dossier d'un coup. Chaque Module expose une **Vue** plein écran et, en option, un **Widget** affiché sur l'**Accueil** ; un **Lanceur** permanent donne accès à toutes les Vues.

Un Module respecte une **Convention** publique : un **Manifeste** qui le décrit, un protocole de messages avec l'Hôte (stockage, thème, navigation, cycle de vie), et des **Permissions** déclarées. Chaque Module tourne isolé dans une iframe sandbox ; l'Hôte présente ses Permissions avant l'activation, l'Utilisateur les accepte en bloc ou refuse, et tout accès non déclaré est bloqué.

Les **Créateurs**, humains ou aidés d'un LLM, disposent d'une boîte à outils : la Convention, un **Validateur** (aussi en ligne de commande), un SDK, des Modules d'exemple et une skill de création pour LLM. Tout est local-first : aucune inscription. L'Hôte est servi par Cloudflare Pages, mais le code et les données des Modules restent sur la machine de l'Utilisateur, dans le Dossier des Modules qu'il choisit (ADR 0007). Ce sont des fichiers lisibles, faciles à versionner avec git et qui s'exportent aussi en un seul fichier. L'Hôte fonctionne dans Chrome et Edge sur ordinateur.

Déjà livré : la Convention (version 1, avec Permissions), le Validateur et la commande `tessello validate`.

## User Stories

### Découvrir et installer

1. En tant qu'Utilisateur, je veux ouvrir Tessello à une simple adresse web, sans compte ni installation, afin de commencer immédiatement.
2. En tant qu'Utilisateur, je veux pouvoir installer Tessello comme application (PWA), afin de le lancer comme une application de mon ordinateur.
3. En tant qu'Utilisateur, je veux installer un Module en déposant son fichier `.zip` dans l'Hôte, qui le décompresse en un nouveau dossier du Dossier des Modules, afin d'utiliser un Module que l'on m'a transmis ou que j'ai créé.
3 bis. En tant qu'Utilisateur, je veux ajouter un Module en clonant ou en copiant son dossier dans mon Dossier des Modules, et que l'Hôte le détecte et me propose de l'activer, afin d'installer un Module comme on récupère un projet.
4. En tant qu'Utilisateur, je veux installer un Module en collant l'URL de son `.zip`, afin d'installer un Module publié en ligne.
5. En tant qu'Utilisateur, je veux ouvrir un lien d'installation qui m'amène dans l'Hôte avec le Module prêt à installer, afin d'installer en un clic depuis une page web ou un message.
6. ~~En tant que Créateur, je veux lancer `tessello install` sur un `.zip` ou une URL, afin que l'Hôte s'ouvre avec mon Module prêt à installer.~~ Retirée de la V1 (ticket 08) : un dossier s'ajoute au Dossier des Modules (histoire 3 bis), et un `.zip` se dépose dans l'Hôte.
7. En tant qu'Utilisateur, je veux que l'Hôte refuse un Module non conforme en m'expliquant pourquoi, afin de ne jamais installer un Module cassé.
8. En tant qu'Utilisateur, je veux voir le nom, la version, l'icône, la description et l'Identifiant d'un Module avant de l'installer, afin de savoir ce que j'installe.

### Permissions

9. En tant qu'Utilisateur, je veux voir en langage simple tout ce qu'un Module pourra faire (les domaines qu'il contactera, l'accès à mon réseau local) avant de l'activer, afin de décider en connaissance de cause.
10. En tant qu'Utilisateur, je veux que l'accès à mon réseau local soit mis en évidence, afin de repérer les Permissions sensibles.
11. En tant qu'Utilisateur, je veux qu'un Module sans Permission soit présenté comme n'ayant aucun accès réseau, afin d'être rassuré sur les Modules simples.
12. En tant qu'Utilisateur, je veux accepter toutes les Permissions ou annuler l'installation, afin de garder un choix simple et clair.
13. En tant qu'Utilisateur, je veux que l'Hôte bloque réellement tout accès réseau non déclaré par un Module, afin que l'accord donné corresponde à la réalité.
14. En tant qu'Utilisateur, je veux qu'une mise à jour qui demande de nouvelles Permissions me montre seulement ce qui s'ajoute et me redemande mon accord avant que le Module ne tourne, qu'elle vienne d'un `.zip`, d'un `git pull` ou d'une modification du dossier, afin qu'un Module ne gagne jamais d'accès à mon insu.
15. En tant qu'Utilisateur, je veux que refuser les nouvelles Permissions ne fasse rien perdre. Une mise à jour par `.zip` est alors annulée, et l'ancienne version reste en place. Un Module dont le dossier a déjà changé reste inactif, avec ses données intactes, jusqu'à ce que j'accepte ou que je revienne à l'ancienne version (par exemple avec git).
16. En tant qu'Utilisateur, je veux pouvoir consulter à tout moment les Permissions accordées à un Module installé, afin de savoir ce qu'il peut faire.

### Utiliser ses Modules

17. En tant qu'Utilisateur, je veux un Lanceur toujours accessible qui liste mes Modules installés, afin d'ouvrir n'importe quelle Vue en un geste.
18. En tant qu'Utilisateur, je veux que le Lanceur reflète mon Dossier des Modules : un Module installé, mis à jour, désinstallé, ajouté ou retiré à la main y apparaît comme tel, afin qu'il reflète toujours mon espace.
19. En tant qu'Utilisateur, je veux qu'une Vue occupe toute la zone principale de l'Hôte, afin d'utiliser chaque Module comme une vraie application.
20. En tant qu'Utilisateur, je veux un Accueil qui regroupe les Widgets de mes Modules, afin d'avoir un aperçu de tout d'un coup d'œil.
21. En tant qu'Utilisateur, je veux réordonner les Widgets sur l'Accueil, afin d'organiser mon espace comme je le souhaite.
22. En tant qu'Utilisateur, je veux que chaque Widget occupe la taille prévue par son Créateur (S, M ou L), afin que l'Accueil reste lisible.
23. En tant qu'Utilisateur, je veux cliquer dans un Widget pour ouvrir la Vue de son Module, éventuellement sur un contenu précis, afin de passer de l'aperçu au détail.
24. En tant qu'Utilisateur, je veux qu'un Module installé sans Widget reste accessible par le Lanceur, afin qu'aucun Module ne soit introuvable.
25. En tant qu'Utilisateur, je veux que les Modules adoptent le thème clair ou sombre de l'Hôte, et le suivent quand il change, afin que l'ensemble reste cohérent.
26. En tant qu'Utilisateur, je veux choisir la langue de l'interface (anglais ou français), et que les Modules qui le prévoient la suivent, afin d'utiliser Tessello dans ma langue.
27. En tant qu'Utilisateur, je veux que les données de chaque Module soient conservées entre deux visites, afin de retrouver mon travail.
27 bis. En tant qu'Utilisateur, je veux choisir le dossier de ma machine où sont rangés le code et les données de mes Modules, afin que rien ne soit effacé à mon insu et que je puisse lire, modifier ou sauvegarder ces fichiers avec mes propres outils.
27 ter. En tant qu'Utilisateur, je veux versionner mon Dossier des Modules avec git et obtenir des différences courtes et lisibles quand les données d'un Module changent, afin de suivre et de synchroniser mon espace avec les outils que je connais.
28. En tant qu'Utilisateur, je veux qu'un Module qui plante ou ne répond pas n'affecte ni l'Hôte ni les autres Modules, et qu'un message clair remplace sa Vue ou son Widget, afin que mon espace reste utilisable.
29. En tant qu'Utilisateur, je veux qu'un Module ne puisse jamais lire les données d'un autre Module, afin de protéger ma vie privée.
30. En tant qu'Utilisateur, je veux que les Modules masqués s'arrêtent de travailler inutilement, afin de préserver la batterie et les performances.

### Mettre à jour, désinstaller, sauvegarder

31. En tant qu'Utilisateur, je veux mettre à jour un Module en installant sa nouvelle version ou en mettant à jour son dossier (par exemple `git pull`), en conservant ses données, afin de profiter des améliorations sans rien perdre.
32. En tant qu'Utilisateur, je veux être prévenu, versions à l'appui, quand j'installe un Module dont l'Identifiant est déjà installé, afin de ne pas remplacer un Module par un autre par erreur.
33. En tant qu'Utilisateur, je veux désinstaller un Module après confirmation, ce qui supprime son dossier et ses données, afin de garder un espace propre.
34. En tant qu'Utilisateur, je veux exporter tout mon espace (Modules, leur code, leurs données, la disposition de l'Accueil) en un seul fichier, afin de le sauvegarder.
35. En tant qu'Utilisateur, je veux importer ce fichier sur un autre navigateur ou appareil et retrouver exactement mon espace, afin de changer de machine.
36. En tant qu'Utilisateur, je veux que l'import me montre les Permissions des Modules importés, afin de ne pas accorder d'accès sans le savoir.

### Créer des Modules

37. En tant que Créateur, je veux une Convention claire et lisible par un LLM, afin de savoir exactement ce qu'un Module doit respecter.
38. En tant que Créateur, je veux lancer `tessello validate` sur mon dossier ou mon `.zip` et obtenir des erreurs précises avec un code stable, afin de corriger vite.
39. En tant que Créateur utilisant un LLM, je veux que mon LLM lance lui-même le Validateur, lise les erreurs et corrige le Module, afin d'obtenir un Module conforme sans aller-retour manuel.
40. En tant que Créateur, je veux être averti quand mon code appelle un domaine que je n'ai pas déclaré, afin de ne pas découvrir le blocage seulement à l'exécution.
41. En tant que Créateur, je veux un SDK léger qui gère le handshake, le stockage, le thème, la visibilité et la navigation, afin d'écrire moins de code et de faire moins d'erreurs.
42. En tant que Créateur, je veux pouvoir utiliser le SDK sans réseau ni outil de build, afin qu'un simple Module HTML fonctionne sans Permission supplémentaire.
43. En tant que Créateur, je veux rester libre d'utiliser n'importe quelle technologie web, ou de parler le protocole à la main, afin de ne pas dépendre d'un framework.
44. En tant que Créateur, je veux des Modules d'exemple conformes, couvrant un cas simple, un cas avec réseau et un cas avec réseau local, afin de partir d'un modèle qui fonctionne.
45. En tant que Créateur utilisant un LLM dans un terminal, je veux installer une skill de création avec `npx skills add`, afin que mon agent sache créer des Modules Tessello.
46. En tant que Créateur utilisant un LLM dans le navigateur, je veux récupérer la skill sous forme d'un simple fichier depuis le site de Tessello, afin de la coller dans ma conversation.
47. En tant que Créateur, je veux que la skill guide le LLM de bout en bout (structure, Manifeste, SDK, Permissions, validation, empaquetage en `.zip`), afin d'obtenir un Module installable du premier coup.
48. En tant que Créateur, je veux développer mon Module directement dans un dossier du Dossier des Modules et voir chaque modification en rouvrant sa Vue, afin d'itérer efficacement.
49. En tant que Créateur, je veux choisir un Identifiant sous mon propre Espace de noms, afin que mon Module ne soit pas confondu avec celui d'un autre.
50. En tant que Créateur, je veux que les données de mes Utilisateurs survivent à mes mises à jour tant que je garde le même Identifiant, afin de faire évoluer mon Module sans casser leur usage.
51. En tant que Créateur, je veux connaître les limites (taille du paquet, stockage, paramètres de navigation) et les codes d'erreur du protocole, afin de concevoir un Module robuste.

### Exploitation

52. En tant que mainteneur de Tessello, je veux que l'Hôte soit un site statique sur Cloudflare Pages, sans backend, afin que les coûts restent quasi nuls et maîtrisés.
53. En tant que mainteneur, je veux que les limites de la Convention soient définies à un seul endroit et partagées par le Validateur, le SDK et l'Hôte, afin de pouvoir les relever sans incohérence.
54. En tant que mainteneur, je veux publier le CLI, le SDK et le Validateur sur npm sous forme JavaScript, afin que `npx tessello` fonctionne partout.

## Implementation Decisions

### Modules logiciels

- **Convention et Validateur** (existant, `@tessello/convention`) : contient les limites, les règles des Permissions (dont la vérification « cette URL est-elle couverte par ces Permissions ? ») et le Validateur. Il est isomorphe (aucun accès disque) et sera réutilisé tel quel par l'Hôte dans le navigateur, à l'installation et à l'import.
- **SDK** (nouveau, `@tessello/sdk`) : une bibliothèque JavaScript sans dépendance qui enveloppe le protocole. Interface : une fonction de connexion qui envoie `ready` et renvoie le contexte (surface, Module, langue, thème, paramètres), puis le stockage (lire, écrire, supprimer, lister les clés), des abonnements aux changements de thème, de visibilité et de paramètres de navigation, et l'ouverture de la Vue depuis un Widget. Les erreurs du protocole remontent comme des erreurs typées portant leur code. Il est distribué sur npm **et** sous forme d'un fichier ES module unique que le Créateur copie dans son paquet, ce qui évite toute Permission réseau.
- **Cœur de l'Hôte** (nouveau, sans interface) : le registre des Modules installés (Identifiant, dossier, version, Permissions accordées), la détection des dossiers ajoutés, modifiés ou retirés, le stockage par Module avec ses quotas, le traitement du protocole pour chaque surface (Vue ou Widget) avec ses codes d'erreur, le cycle installation → présentation des Permissions → accord ou refus, la mise à jour avec différence de Permissions, la désinstallation, l'export et l'import, et la disposition de l'Accueil. La persistance (le Dossier des Modules sur la machine de l'Utilisateur, ADR 0007) est derrière une interface, avec une implémentation en mémoire pour les tests.
- **Interface de l'Hôte** (nouveau) : une PWA statique avec l'Accueil (grille de cellules, Widgets S = 1×1, M = 2×1, L = 2×2, réordonnables), le Lanceur, la zone de Vue, les points d'entrée d'installation (dépôt de fichier, URL, lien d'installation), l'écran d'accord des Permissions, l'écran de différence lors d'une mise à jour, la confirmation de désinstallation, l'affichage des rapports du Validateur, l'erreur de handshake (10 s), les thèmes clair et sombre, et l'anglais en langue principale avec le français en seconde langue.
- **CLI** (existant, `tessello`) : `validate` seulement en V1 (`install` est retiré, ticket 08). Le CLI et ses dépendances sont compilés en JavaScript avant publication, car Node n'exécute pas le TypeScript situé dans `node_modules`.
- **Modules d'exemple** (nouveaux) : trois Modules conformes, qui passent le Validateur sans avertissement et servent aussi de fixtures aux tests navigateur.
  - Un Module sans Permission, avec stockage et Widget S (par exemple des notes).
  - Un Module avec Permission `network`, Widget M et ouverture de la Vue avec paramètres (par exemple une météo sur une API publique compatible CORS).
  - Un Module avec Permission `localNetwork` (par exemple l'état d'un Prometheus local).
- **Skill de création** (nouvelle, en anglais) : elle guide le LLM sur la structure du paquet, le Manifeste, l'usage du SDK (copie locale), la déclaration des Permissions, et la boucle `tessello validate` → corrections jusqu'à zéro erreur, puis l'empaquetage en `.zip` (contenu à la racine). Elle est distribuée dans le dépôt (installable avec `npx skills add`) et servie en fichier texte par le site de l'Hôte.

### Contrats et architecture (rappels des ADR et de la Convention)

- **Isolation** (ADR 0001) : chaque Vue et chaque Widget tourne dans sa propre iframe sandbox, d'origine opaque. Toute capacité passe par le protocole de messages de la Convention. L'Hôte n'accepte que les messages provenant de l'iframe qu'il a créée.
- **Local-first** (ADR 0002) : ni compte ni backend. L'export est un fichier unique et autonome (configuration, disposition de l'Accueil, code et données de chaque Module, Permissions accordées). Pour qui utilise git, le Dossier des Modules versionné joue le même rôle.
- **Dossier des Modules** (ADR 0007) : l'Utilisateur le choisit au premier lancement. Il contient :
  - un dossier par Module, au nom libre (celui d'un `git clone`, par exemple), car l'identité d'un Module est l'Identifiant de son Manifeste ;
  - un dossier `.tessello/`, qui contient le registre (Permissions accordées et version de chaque Module), la disposition de l'Accueil et les données des Modules.

  Les données d'un Module sont rangées hors de son dossier de code : le dépôt git d'un Créateur ne reçoit donc jamais les données d'un Utilisateur. Chaque clé du stockage est un fichier JSON indenté, pour des différences git courtes et sans conflit quand deux machines modifient des clés différentes.
- **Identité** (ADR 0003) : un Identifiant connu signifie une mise à jour, après confirmation de l'Utilisateur. Le stockage est rattaché à l'Identifiant. Deux dossiers déclarant le même Identifiant sont signalés en conflit, et seul le premier enregistré tourne.
- **Permissions** (ADR 0004) : accord en bloc à l'installation, nouvel accord limité à la différence lors d'une mise à jour, retrait par désinstallation. Un dossier modifié ne gagne jamais d'accès : la CSP suit les Permissions accordées enregistrées par l'Hôte, jamais le Manifeste relu sur disque. L'Hôte **bloque** tout accès non déclaré (requêtes et ressources distantes), via la politique de sécurité de contenu appliquée aux fichiers qu'il sert aux iframes.
- **Installation par URL** (ADR 0009) : l'URL pointe vers le `.zip`, et non vers le Manifeste, car l'export complet exige de connaître tous les fichiers du Module. L'Hôte la télécharge directement, sans intermédiaire : le serveur du paquet doit envoyer les en-têtes CORS. Le lien d'installation a la forme `https://<Hôte>/#install=<URL encodée>`.
- **Limites** : elles sont définies à un seul endroit, dans le paquet de la Convention, et le SDK et l'Hôte les importent. Elles peuvent être relevées (révision mineure) mais jamais abaissées.
- **Hébergement** : Cloudflare Pages, avec les en-têtes HTTP nécessaires à la PWA et à la politique de sécurité de contenu.

### Questions techniques à trancher pendant l'implémentation

- **Comment l'Hôte sert les fichiers d'un Module à une iframe d'origine opaque**, avec la politique de sécurité de contenu dérivée des Permissions. Deux pistes : un service worker, ou une origine dédiée au contenu des Modules. Il faut vérifier quelle approche permet réellement d'appliquer la politique aux requêtes de l'iframe. C'est à investiguer avant de construire l'affichage des Modules.
- ~~**Comment `tessello install` transmet un zip local à l'Hôte** dans le navigateur.~~ Sans objet : `tessello install` est retiré de la V1 (ticket 08).
- **Le comportement réel de Chrome et Edge** face aux requêtes `localNetwork` d'une iframe sandbox servie depuis un site public.

## Testing Decisions

- **Un bon test** vérifie un comportement observable depuis un point d'entrée public (un rapport de validation, une sortie de CLI, une réponse du protocole, ce que voit l'Utilisateur), jamais des détails internes. Les tests sont écrits avant ou avec le code (TDD) à ces points d'entrée.
- **Point d'entrée A, l'API du Validateur** (existant) : toutes les règles de la Convention. Les Modules d'exemple doivent la passer sans erreur ni avertissement. Prior art : les tests du Validateur et des Permissions, qui construisent des paquets en mémoire.
- **Point d'entrée B, le CLI** (existant) : appelé avec des arguments, on vérifie la sortie et le code de retour. Couvre `validate`. Prior art : les tests du CLI sur dossiers temporaires et archives générées.
- **Point d'entrée C, le cœur de l'Hôte piloté par le SDK** (nouveau) : un canal de messages en mémoire relie le SDK au cœur de l'Hôte, avec un stockage en mémoire. Il couvre :
  - le handshake et le contexte, puis `not_ready` avant `ready` ;
  - le stockage, son isolement entre Modules, son partage entre Vue et Widget, et les quotas (`quota_exceeded`) ;
  - le thème et ses changements, la visibilité, et `openView` depuis un Widget (`not_allowed` depuis une Vue) ;
  - `unknown_type` et `invalid_payload` ;
  - l'installation avec accord ou refus, la mise à jour avec différence de Permissions et la conservation des données, la désinstallation avec suppression des données, et l'aller-retour export/import.
- **Point d'entrée D, l'Hôte dans un vrai navigateur** (nouveau, Playwright, Chromium) : le sélecteur de dossier natif y est remplacé par un dossier du stockage privé du navigateur (OPFS), qui offre la même interface. Il couvre quelques parcours critiques avec les Modules d'exemple, à savoir installation par fichier avec écran d'accord, apparition dans le Lanceur et sur l'Accueil, ouverture de la Vue depuis un Widget, **blocage effectif** d'une requête vers un domaine non déclaré, isolation (un Module ne lit pas le stockage d'un autre), et lien d'installation.
- **Skill de création** : pas de test automatisé. Elle est acceptée quand un LLM qui la suit produit, à partir d'une demande simple, un Module que le Validateur accepte et que l'Hôte affiche correctement.
- Commandes existantes : la suite de tests unique du monorepo et la vérification de types.

## Out of Scope

- La **marketplace** sous toutes ses formes : publication, comptes de Créateurs, réservation des Espaces de noms, modération, recherche, notes, monétisation, commande `publish`. Elle fera l'objet d'une session de grilling dédiée.
- Le **Pont** (exécution de commandes déclarées, appels sans contrainte CORS) : il est prévu, mais aura son propre grilling et son propre ADR.
- Les Permissions et capacités au-delà de `network` et `localNetwork` : notifications, fichiers, presse-papiers, etc.
- La communication entre Modules.
- La mise à jour automatique des Modules installés par URL.
- La commande `tessello install` (histoire 6), et un proxy pour télécharger les paquets servis sans CORS (ADR 0009).
- Les comptes, la synchronisation entre appareils par l'Hôte et tout backend pour l'Hôte. L'Utilisateur peut synchroniser son Dossier des Modules lui-même, par exemple avec git.
- Le suivi en direct des modifications du dossier pendant qu'une Vue est ouverte : elles sont prises en compte à la prochaine ouverture.
- Un LLM intégré à l'Hôte.
- La palette de commandes, la grille libre (redimensionnement des Widgets) et l'Accueil remplaçable par un Module.
- L'accord Permission par Permission, ou à la première utilisation.

## Further Notes

- **Contrainte forte** : les coûts d'hébergement doivent rester très bas et maîtrisés. Il faut écarter tout composant dont le coût croît sans plafond.
- **Langues** : la Convention, le SDK, la skill, les messages du Validateur et l'interface sont en anglais, avec le français en seconde langue pour l'interface. Le glossaire interne reste en français.
- **Fuites résiduelles connues** (ADR 0004) : un Module peut toujours ouvrir un lien dans un nouvel onglet, et WebRTC n'est pas couvert par le blocage. Elles sont à réévaluer lors de la conception de l'affichage des Modules.
- **Données et git** : les données d'un Module peuvent contenir des secrets, par exemple un jeton d'API. Un Utilisateur qui versionne tout son Dossier des Modules doit le savoir, car les données sont sous `.tessello/` et il peut les exclure de git. L'Hôte le lui signale quand il choisit son dossier.
- **Rappel** : le nom `tessello` est libre sur npm à ce jour. Il faut le réserver, ainsi que les domaines, avant toute publication.
