# Spec : Marketplace

**Status:** ready-for-agent

Vocabulaire : `GLOSSARY.md`. Décisions structurantes : ADR 0014 à 0018, qui s'appuient sur les ADR 0002, 0003, 0008 et 0009. Contrat : la Convention (`convention/CONVENTION.md`). Spec de l'Hôte : `.scratch/tessello-v1/spec.md`.

## Problem Statement

Un Utilisateur ne trouve aujourd'hui un Module que si quelqu'un lui en donne l'URL ou le fichier. Un Créateur n'a aucun endroit où faire connaître le sien. Il manque un catalogue commun, où chercher un Module, voir ce qu'il demande avant de l'installer, l'installer en un clic et savoir quand il change. Ce catalogue doit rester gratuit et sans service à faire tourner. Le Mainteneur doit pouvoir décider de qui entre et retirer un Module à tout moment, sans répondre pour autant du code des Créateurs.

## Solution

La **Marketplace** est un catalogue statique tenu dans un dépôt GitHub public, `craftskillz/tessello-marketplace` (ADR 0014). Chaque Module y a une fiche : son Identifiant, son dépôt source public sous licence approuvée par l'OSI, et pour chaque version l'URL du `.zip`, hébergé par le Créateur, et son empreinte SHA-256 (ADR 0017). Un Créateur publie par pull request, sous l'Espace de noms de son compte GitHub (ADR 0016). La CI vérifie tout ce qui peut l'être, puis construit un `index.json` et le site de la Marketplace, servis par Cloudflare Pages.

Le Mainteneur donne son **Approbation** au premier passage d'un Module. Les versions suivantes sont fusionnées automatiquement. Il peut bannir une version, un Module ou un Espace de noms à tout moment, et le Créateur peut retirer les siens. Créateurs et Utilisateurs savent que l'Approbation n'est pas une garantie, et que le Créateur répond de son code (ADR 0015).

Dans l'Hôte, un écran **Marketplace** lit l'index, permet de chercher, de lire la fiche d'un Module et de l'installer par le parcours d'accord existant. L'Hôte propose ensuite les nouvelles versions et signale les Bannissements et les Retraits, sans jamais mettre à jour ni désinstaller de lui-même (ADR 0018).

## User Stories

### Trouver et installer (Utilisateur)

1. En tant qu'Utilisateur, je veux ouvrir un écran Marketplace dans l'Hôte, afin de découvrir des Modules sans quitter mon Espace.
2. En tant qu'Utilisateur, je veux chercher par nom, description, tag et Créateur, afin de trouver vite ce que je cherche.
3. En tant qu'Utilisateur, je veux filtrer par Permission (par exemple « sans réseau »), afin de ne voir que les Modules qui demandent ce que j'accepte.
4. En tant qu'Utilisateur, je veux voir la fiche d'un Module (icône, Créateur, licence, dépôt source, Permissions, Widgets, Guide d'utilisation, captures), afin de décider avant d'installer.
5. En tant qu'Utilisateur, je veux lire, sur la fiche et à l'écran d'accord, que le Module a été admis une fois, que ses mises à jour ne sont pas relues et que j'installe à mes risques, afin de savoir à quoi je m'engage.
6. En tant qu'Utilisateur, je veux installer un Module d'un clic, par le même écran d'accord qu'une installation par URL, afin de ne pas apprendre un second parcours.
7. En tant qu'Utilisateur, je veux que l'installation échoue clairement si le paquet ne correspond plus à la Marketplace, afin de ne jamais installer un code substitué.
8. En tant qu'Utilisateur, je veux parcourir la Marketplace hors ligne, dans sa dernière version connue et avec sa date, afin qu'elle ne bloque jamais l'Hôte.
9. En tant qu'Utilisateur, je veux ouvrir la page d'un Module sur le site de la Marketplace et l'installer dans mon Hôte par un bouton, afin de partager un Module par un simple lien.

### Suivre ses Modules (Utilisateur)

10. En tant qu'Utilisateur, je veux voir dans le Lanceur qu'une nouvelle version d'un Module de la Marketplace existe, afin de la prendre quand je le décide.
11. En tant qu'Utilisateur, je veux mettre à jour par l'écran de différence des Permissions existant, afin de voir ce que la nouvelle version demande en plus.
12. En tant qu'Utilisateur, je veux être averti, avec la raison, quand un Module installé ou sa version est banni, afin de décider de le garder ou de le désinstaller.
13. En tant qu'Utilisateur, je veux qu'un Module banni continue de fonctionner tant que je ne le désinstalle pas, afin de ne jamais perdre mes données sans l'avoir décidé.
14. En tant qu'Utilisateur, je veux une note neutre quand un Créateur retire son Module, afin de ne pas le confondre avec un Bannissement.
15. En tant qu'Utilisateur, je veux signaler un Module, afin que le Mainteneur puisse agir.

### Publier (Créateur)

16. En tant que Créateur, je veux publier un Module sous l'Espace de noms de mon compte GitHub, sans autre inscription, afin que personne ne publie sous mon nom.
17. En tant que Créateur, je veux lire dans `PUBLISHING.md` les règles, la façon d'héberger mon `.zip` et ce que j'accepte, afin de savoir à quoi je m'engage.
18. En tant que Créateur, je veux que la CI me dise exactement ce qui ne va pas dans ma fiche ou mon paquet, afin de corriger sans attendre le Mainteneur.
19. En tant que Créateur, je veux que mes nouvelles versions soient publiées automatiquement une fois mon Module admis, afin de ne pas dépendre de la disponibilité du Mainteneur.
20. En tant que Créateur, je veux retirer moi-même mon Module ou une de ses versions, afin de rester maître de ce que je publie.
21. En tant que Créateur, je veux lancer `tessello publish` pour préparer ma fiche et ouvrir la pull request, afin de ne pas calculer d'empreinte à la main.

### Tenir la Marketplace (Mainteneur)

22. En tant que Mainteneur, je veux qu'un nouveau Module attende mon Approbation, afin de décider de qui entre.
23. En tant que Mainteneur, je veux bannir une version, un Module ou un Espace de noms, en donnant une raison, afin d'agir vite quand un problème est signalé.
24. En tant que Mainteneur, je veux qu'un Espace de noms dont le compte GitHub change soit gelé, afin de trancher à la main sans qu'un inconnu en hérite.
25. En tant que Mainteneur, je veux publier Diagram, Watch Later et Survival Kit sous `@craftskillz` à l'ouverture, afin que la Marketplace ne soit pas vide.

## Implementation Decisions

### Modules logiciels

- **Dépôt de la Marketplace** (nouveau, `craftskillz/tessello-marketplace`, public) :
  - `modules/<espace>/<nom>/entry.json` : la fiche (format ci-dessous), et ses captures d'écran à côté ;
  - `namespaces.json` : pour chaque Espace de noms, le nom du compte GitHub, son identifiant numérique et son état (`active`, `frozen`, `banned` avec raison) ;
  - `PUBLISHING.md`, le modèle de pull request avec sa case d'acceptation, et le gabarit des issues de signalement ;
  - la CI (GitHub Actions) et le générateur de l'index et du site.
- **Paquet `@tessello/marketplace`** (nouveau, dans ce monorepo, `packages/marketplace`) : le format de la fiche et de l'index, le Vérificateur de fiche et le Générateur d'index. Il est isomorphe, comme `@tessello/convention`. La CI de la Marketplace l'importe, avec `@tessello/convention`, d'un clone de `craftskillz/tessello` à un commit épinglé par le dépôt de la Marketplace (pas de npm, voir le ticket 03), et le cœur de l'Hôte en importe le format de l'index.
- **Vérificateur de fiche** (nouveau, fonction pure, testée sans réseau) : prend la fiche, le paquet téléchargé, les métadonnées GitHub et la fiche précédente. Il rend la liste des erreurs, chacune avec un code stable, comme le Validateur, et le type de changement : nouveau Module, nouvelle version, Retrait, Bannissement, ou autre. La CI ne fait que télécharger, appeler le Vérificateur et décider de la fusion.
- **Générateur d'index** (nouveau, fonction pure) : des fiches et des Manifestes, il tire `index.json` et les pages du site.
- **Client de la Marketplace dans le cœur de l'Hôte** (nouveau) : lire et mettre en cache l'index, chercher et filtrer, comparer avec le registre (mises à jour, Bannissements, Retraits). La récupération réseau est derrière une interface, avec une implémentation en mémoire pour les tests.
- **Interface de l'Hôte** : l'écran Marketplace, la fiche d'un Module, les badges du Lanceur et des Widgets, l'avertissement de Bannissement et la note de Retrait.
- **CLI** : `tessello publish` (dernier ticket).

### Format de la fiche (`entry.json`)

- `id` (`@espace/nom`), `source` (URL d'un dépôt GitHub public), `license` (identifiant SPDX), `tags` facultatifs, `screenshots` facultatives (jusqu'à 3 fichiers PNG ou WebP du dossier de la fiche, 500 Ko au plus chacun).
- `versions` : une liste de `{ version, url, sha256 }`. Une version peut aussi porter `withdrawn: true` (Retrait) ou `banned: "<raison>"` (Bannissement).
- Au niveau du Module : `withdrawn: true` ou `banned: "<raison>"`.
- Tout le reste vient du Manifeste du paquet : rien ne le recopie.

### Règles de la CI

- L'auteur de la pull request possède l'Espace de noms : c'est le compte GitHub du même nom, ou un membre public de l'organisation du même nom. Son identifiant numérique doit être celui de `namespaces.json`. Un nouvel Espace de noms y est ajouté à la première Approbation.
- `@tessello` est réservé : aucune fiche n'est acceptée sous ce nom.
- Un Espace de noms `frozen` ou `banned` est refusé. Un Module banni n'accepte plus de version.
- Pour chaque version ajoutée : l'URL est en `https:`, l'empreinte correspond, le Validateur ne trouve aucune erreur, et l'Identifiant et la version du Manifeste sont ceux de la fiche. La version est strictement supérieure à la dernière (semver), et les versions déjà publiées ne changent pas.
- Le dépôt source est public, et la licence que GitHub rapporte est celle de la fiche, approuvée par l'OSI.
- Une pull request ne touche qu'un seul dossier de fiche.
- **Fusion** : un nouveau Module attend l'Approbation du Mainteneur. Une nouvelle version, un Retrait ou un changement de tags ou de captures est fusionné automatiquement si la CI passe. Seul le Mainteneur ajoute un Bannissement, et un Retrait n'en efface jamais un.
- **Sécurité de la CI** : elle n'exécute jamais de code venu d'une pull request. Le paquet est lu comme une archive, jamais exécuté. Le jeton qui fusionne n'est donné qu'à l'étape qui décide de la fusion.

### Index et site

- `index.json` contient la date de génération et, pour chaque Module listé ou banni : la fiche, les champs tirés du Manifeste (nom, description, icône, Permissions, Widgets, version de la Convention) et le Guide d'utilisation. Il est servi avec `Access-Control-Allow-Origin: *`. Le format est documenté et versionné (`format: 1`).
- Un Module banni ou retiré reste dans l'index avec son état, pour que les Hôtes qui l'ont installé le sachent. Il n'apparaît plus dans les listes ni dans la recherche.
- Le site : une page de liste avec la même recherche que l'Hôte, et une page par Module avec la fiche, le Guide rendu, l'avertissement d'ADR 0015 et un bouton « Install in Tessello » qui ouvre `https://<Hôte>/#install=<URL>`. Il est en anglais, comme la Convention.
- Hébergement : un projet Cloudflare Pages gratuit, distinct de celui de l'Hôte (ticket 12 de tessello-v1).

### Dans l'Hôte

- L'adresse de l'index est inscrite dans l'Hôte.
- **Interrogation** : à l'ouverture de l'écran Marketplace, et au démarrage au plus une fois par jour. La dernière copie est gardée dans `.tessello/` avec sa date.
- **Installation depuis la Marketplace** : téléchargement, vérification de l'empreinte, Validateur, puis écran d'accord avec l'avertissement d'ADR 0015. Le registre note la provenance : `marketplace`, avec la version et l'empreinte.
- **Lien d'installation** : un `#install=<URL>` dont l'URL et l'empreinte sont celles d'une version de l'index donne la même provenance, après vérification. Sinon, c'est une installation par URL ordinaire.
- **Provenance** : seul un paquet dont l'empreinte est celle d'une version de l'index est « de la Marketplace » (ADR 0018). Les Modules venus d'un dossier ou d'un `.zip` local restent locaux.
- **Signaux** : badge « mise à jour » dans le Lanceur ; badge d'avertissement sur le Lanceur et le Widget pour un Bannissement ; note neutre pour un Retrait. Aucune action automatique.
- Les textes de l'interface sont en anglais et en français, comme le reste de l'Hôte.

## Testing Decisions

- **Un bon test** vérifie un comportement observable depuis un point d'entrée public, comme pour la V1.
- **Vérificateur de fiche** : chaque règle, avec des paquets construits en mémoire et des métadonnées GitHub simulées. Prior art : les tests du Validateur.
- **Générateur d'index** : des fiches vers l'index et les pages, avec un Module banni, un retiré et une version bannie.
- **Client de la Marketplace (cœur de l'Hôte)** : avec un index en mémoire, la recherche, le filtre par Permission, la provenance, une mise à jour proposée, un Bannissement, un Retrait, le cache hors ligne et la limite d'une interrogation par jour.
- **Hôte dans un vrai navigateur** (Playwright) : un index et des paquets servis localement. Parcours : installer depuis l'écran Marketplace, refuser un paquet dont l'empreinte ne correspond pas, mettre à jour depuis le badge, voir l'avertissement de Bannissement.
- **CI de la Marketplace** : un essai réel, consigné dans le ticket, sur un dépôt de test avant l'ouverture.

## Out of Scope

- Toute relecture des mises à jour, et tout audit ou certification.
- Les notes, les avis, les compteurs de téléchargement et toute télémétrie.
- Un backend, des comptes autres que GitHub, et un formulaire d'envoi.
- Les catalogues tiers ajoutés par l'Utilisateur (ADR 0014).
- La copie des paquets par la Marketplace et la construction depuis la source (ADR 0017).
- La mise à jour et la désinstallation automatiques (ADR 0018).
- La monétisation : la Marketplace est gratuite.
- La lecture de `PUBLISHING.md` par un juriste : c'est au Mainteneur de la demander.

## Further Notes

- **Prérequis** côté tessello-v1 : le ticket 12 (l'Hôte sur Cloudflare Pages) et le ticket 20 (les Modules du Mainteneur renommés sous `@craftskillz`).
- **Coût** : GitHub (dépôt public, Actions) et Cloudflare Pages, dans leurs offres gratuites. Aucun composant dont le coût croît sans plafond.
- **Accord du Mainteneur** : créer le dépôt GitHub, le projet Cloudflare Pages ou un jeton de fusion n'est fait qu'avec son accord explicite.
