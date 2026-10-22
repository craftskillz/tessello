# 06: Écran Marketplace dans l'Hôte

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** L'Utilisateur ouvre la Marketplace dans l'Hôte, cherche, lit la fiche d'un Module et l'installe par l'écran d'accord existant ; l'Hôte note que le Module vient de la Marketplace.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Le cœur de l'Hôte lit l'index par une interface (implémentation en mémoire pour les tests), à l'ouverture de l'écran, et garde la dernière copie dans `.tessello/` avec sa date. Hors ligne, l'écran montre cette copie et sa date.
- [ ] Recherche et filtre par Permission, avec la fonction partagée du ticket 02.
- [ ] Fiche d'un Module : icône, nom, Créateur, licence, lien vers le dépôt source, Permissions, Widgets, Guide d'utilisation (rendu comme au ticket 17 de tessello-v1), captures, et le texte de l'ADR 0015.
- [ ] Installation : téléchargement, vérification de l'empreinte (message « ce paquet ne correspond plus à la Marketplace » en cas d'écart), Validateur, écran d'accord avec le même avertissement. Le registre note la provenance `marketplace`, la version et l'empreinte.
- [ ] Un lien `#install=<URL>` dont l'URL et l'empreinte sont celles d'une version de l'index reçoit la même provenance ; sinon c'est une installation par URL ordinaire.
- [ ] Un Module ajouté par le Dossier des Modules ou par un `.zip` local reste sans provenance `marketplace`.
- [ ] L'adresse de l'index est configurable pour les tests, et inscrite dans l'Hôte pour la production.
- [ ] Textes en anglais et en français.
- [ ] Tests unitaires (cœur) : cache, recherche, provenance. Tests navigateur, avec un index et des paquets servis localement : installer depuis l'écran, refuser un paquet à l'empreinte fausse, consulter hors ligne.
