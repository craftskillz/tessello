# 14: Skill de création

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Un Créateur qui utilise un LLM, dans un terminal ou dans le navigateur, lui donne la skill de création Tessello, et le LLM produit un Module installable du premier coup.

**Blocked by:** 05 (Accueil et Widgets), 06 (Permissions : accord à l'installation et blocage réel), 13 (Publication npm)

**Status:** ready-for-agent

- [ ] La skill, en anglais, guide le LLM sur la structure du paquet, le Manifeste, l'usage du SDK en copie locale, le choix d'un Identifiant sous l'Espace de noms du Créateur, la déclaration des Permissions et les tailles de Widget.
- [ ] Elle impose la boucle `tessello validate` → corrections jusqu'à zéro erreur, puis l'empaquetage en `.zip` avec le contenu à la racine.
- [ ] Elle s'appuie sur la Convention et les Modules d'exemple sans les recopier.
- [ ] Elle est installable avec `npx skills add` depuis le dépôt et servie en simple fichier texte par le site de l'Hôte.
- [ ] Acceptation manuelle : à partir d'une demande simple, un LLM qui suit la skill produit un Module que le Validateur accepte et que l'Hôte installe et affiche correctement ; le résultat de l'essai est consigné dans le ticket.
