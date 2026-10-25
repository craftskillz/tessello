# Tessello

Application web composable : l'utilisateur assemble son espace à partir de modules installés depuis la Marketplace ou créés par lui-même à l'aide d'un LLM.

Les termes sont en français ; le terme anglais entre parenthèses est le terme officiel utilisé dans la Convention, le SDK, la skill et l'interface.

## Language

**Hôte** (*Host*):
L'application ouverte dans le navigateur qui accueille, affiche et orchestre les modules installés.
_Avoid_: Microfrontend, shell, conteneur

**Module** (*Module*):
Unité installable dans l'Hôte, conforme à la convention d'interfaçage. Un Module expose une Vue, et optionnellement un Widget.
_Avoid_: Plugin, extension, app, microfrontend

**Convention** (*Convention*):
Le contrat public qu'un Module doit respecter pour être installable dans l'Hôte.
_Avoid_: Spec, interface, API, protocole

**Manifeste** (*Manifest*):
La carte d'identité déclarative d'un Module (nom, version, icône, Vue, Widget éventuel), lisible sans exécuter le Module.
_Avoid_: Config, descripteur, package.json

**Guide d'utilisation** (*User guide*):
Le mode d'emploi d'un Module destiné à l'Utilisateur : un fichier Markdown de son paquet, nommé par le Manifeste, que l'Hôte affiche depuis le Lanceur sans exécuter de code du Module.
_Avoid_: Docs, aide, README, manuel

**Identifiant** (*Module ID*):
Nom unique et stable d'un Module, préfixé par l'Espace de noms de son Créateur (ex. `@yassine/meteo`) ; il reste identique d'une version à l'autre.
_Avoid_: Nom, slug, clé

**Espace** (*Space*):
Tout ce que l'Utilisateur a assemblé dans l'Hôte : ses Modules activés et leur code, leurs données, les Permissions accordées et la disposition de l'Accueil. Il s'exporte en un seul fichier et s'importe dans un autre Hôte.
_Avoid_: Workspace, profil, configuration

**Espace de noms** (*Namespace*):
Préfixe propre à un Créateur, sous lequel il nomme tous ses Modules ; c'est le nom de son compte ou de son organisation GitHub.
_Avoid_: Scope, organisation, compte

**Validateur** (*Validator*):
Outil qui vérifie qu'un Module respecte la Convention, utilisé à la création, à l'installation et à la publication.
_Avoid_: Linter, checker, vérificateur

**Permission** (*Permission*):
Un accès dont un Module a besoin au-delà de son propre contenu (par exemple joindre une API), déclaré dans son Manifeste et accepté par l'Utilisateur avant l'activation.
_Avoid_: Droit, autorisation, scope, capacité

**Pont** (*Bridge*):
Programme local et optionnel, lancé par l'Utilisateur sur sa machine, qui permet à l'Hôte de faire ce qu'un navigateur ne peut pas faire seul, comme exécuter une commande déclarée.
_Avoid_: Agent, daemon, companion, relais

**Vue** (*View*):
La présentation principale d'un Module, affichée en plein écran dans l'Hôte.
_Avoid_: Page, écran, mini-app

**Widget** (*Widget*):
Présentation compacte et optionnelle d'un Module, affichée sur l'Accueil ; c'est un aperçu et un point d'entrée vers la Vue du Module.
_Avoid_: Tuile, carte, vignette

**Accueil** (*Home*):
L'écran de l'Hôte qui regroupe les Widgets des Modules installés.
_Avoid_: Dashboard, tableau de bord

**Dossier des Modules** (*Modules folder*):
Le dossier de la machine de l'Utilisateur, choisi par lui, où l'Hôte range le code et les données de tous ses Modules.
_Avoid_: Répertoire, workspace, espace de stockage

**Lanceur** (*Launcher*):
Élément permanent de l'Hôte qui liste les Modules installés et permet d'ouvrir leur Vue depuis n'importe où.
_Avoid_: Dock, sidebar, menu

**Hôte de test** (*Test Host*):
Un Hôte en mémoire, fourni par le SDK aux tests d'un Module : la Vue ou le Widget s'y connecte sans Hôte, sans Dossier des Modules ni iframe, et le test prépare et inspecte son stockage, son thème, sa visibilité et sa navigation.
_Avoid_: Faux Hôte, mock, Hôte simulé

## Marketplace

**Marketplace** (*Marketplace*):
Le catalogue officiel et gratuit des Modules publiés par les Créateurs, et le site qui le présente ; l'Hôte fonctionne sans elle.
_Avoid_: Store, registre, catalogue, boutique

**Approbation** (*Approval*):
La décision du Mainteneur, prise une seule fois, d'admettre un nouveau Module dans la Marketplace ; elle ne garantit rien de ce Module ni de ses versions suivantes.
_Avoid_: Revue, validation, certification, audit

**Bannissement** (*Ban*):
Le retrait, par le Mainteneur et à tout moment, d'une version, d'un Module ou d'un Espace de noms entier de la Marketplace.
_Avoid_: Suppression, blocage, modération

**Retrait** (*Withdrawal*):
Le retrait d'un de ses Modules, ou d'une de ses versions, de la Marketplace par son Créateur.
_Avoid_: Dépublication, suppression

**Fiche** (*Listing*):
Le fichier `entry.json` d'un Module dans la Marketplace : son Identifiant, son dépôt source, sa licence, ses tags, ses captures et, pour chaque version, l'URL et l'empreinte de son paquet.
_Avoid_: Entrée, annonce

**Vérificateur de fiche** (*Listing Verifier*):
La fonction que la CI de la Marketplace applique à une pull request : elle dit si la Fiche et les paquets qu'elle ajoute sont acceptables, et quel type de changement c'est. Elle lance le Validateur sur chaque nouveau paquet, sans le remplacer.
_Avoid_: Validateur (réservé à la conformité d'un paquet), vérificateur seul

## Personnes

**Créateur** (*Creator*):
Personne qui produit un Module, à la main ou avec un LLM, et peut le publier sur la Marketplace sous l'Espace de noms de son compte GitHub.
_Avoid_: Développeur, auteur, éditeur

**Mainteneur** (*Maintainer*):
La personne qui tient la Marketplace : elle décide des Approbations et des Bannissements, sans répondre du code des Modules.
_Avoid_: Modérateur, administrateur, relecteur

**Utilisateur** (*User*):
Personne qui installe et utilise des Modules dans son Hôte. Un même individu peut être Créateur et Utilisateur.
_Avoid_: Client, consommateur
