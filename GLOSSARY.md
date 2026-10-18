# Tessello

Application web composable : l'utilisateur assemble son espace à partir de modules installés depuis une marketplace ou créés par lui-même à l'aide d'un LLM.

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

**Identifiant** (*Module ID*):
Nom unique et stable d'un Module, préfixé par l'Espace de noms de son Créateur (ex. `@yassine/meteo`) ; il reste identique d'une version à l'autre.
_Avoid_: Nom, slug, clé

**Espace de noms** (*Namespace*):
Préfixe propre à un Créateur, sous lequel il nomme tous ses Modules.
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

## Personnes

**Créateur** (*Creator*):
Personne qui produit un Module, à la main ou avec un LLM, et peut le publier sur la marketplace.
_Avoid_: Développeur, auteur, éditeur

**Utilisateur** (*User*):
Personne qui installe et utilise des Modules dans son Hôte. Un même individu peut être Créateur et Utilisateur.
_Avoid_: Client, consommateur
