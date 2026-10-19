# 10: Thème clair/sombre et langue de l'interface

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** L'Utilisateur choisit le thème (clair ou sombre, ou celui du système) et la langue de l'interface (anglais par défaut, français en option). Les Modules reçoivent le thème et la langue et suivent leurs changements.

**Blocked by:** 03 (Thème, visibilité, navigation et erreurs du protocole), 04 (Premier Module dans le navigateur)

**Status:** resolved

- [x] L'Hôte propose les thèmes clair, sombre et système, et le choix est conservé.
- [x] Le thème transmis aux Modules respecte la forme de la Convention et chaque changement est propagé à tous les Modules affichés.
- [x] Toute l'interface de l'Hôte est disponible en anglais et en français ; la langue est transmise aux Modules dans leur contexte.
- [x] Les Modules d'exemple suivent le thème et proposent au moins l'anglais.
- [x] Un test navigateur vérifie qu'un changement de thème atteint un Module affiché.

## Comments

- Les choix de thème et de langue sont conservés par le navigateur, pour cette adresse de Tessello (`localStorage`), et s'appliquent dès la page du Dossier des Modules.
- Changer de langue redémarre l'Hôte : chaque Module reçoit la nouvelle langue dans le contexte de son handshake, sans nouvel événement dans la Convention.
- Les messages du Validateur et le détail d'un fichier d'espace refusé (produit par `host-core`) restent en anglais, comme la Convention.
