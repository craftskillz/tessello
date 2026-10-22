# 01: Squelette : ajouter une skill à la main, la retrouver

Spec parente : `.scratch/skills-library/spec.md`. Vocabulaire : `GLOSSARY.md` et « Vocabulaire du Module » de la spec. Contrat : la Convention.

**What to build:** La première tranche de bout en bout du Module Skills Library. On l'installe dans l'Hôte, on ajoute une Skill à la main, elle apparaît dans l'onglet *Library* et elle est retrouvée après un rechargement. Ce ticket pose le paquet, le modèle de données et le stockage.

**Blocked by:** aucun

**Status:** resolved

### Paquet

- [x] `sample-modules/skills-library/` est construit comme Watch Later (Svelte 5, esbuild, `scripts/build.ts`, `dist/` ignoré par git). L'identifiant est `@craftskillz/skills-library`, avec une icône.
- [x] Le Manifeste déclare `"network": ["https://raw.githubusercontent.com"]` et un Widget de taille **M** (un Widget minimal suffit ici ; il est complété au ticket 08).
- [x] Un Guide d'utilisation minimal existe, car la Convention l'exige. Il est complété au ticket 09.
- [x] Le paquet passe le Validateur sans erreur ni avertissement. Le test des exemples couvre `sample-modules/skills-library`.
- [x] L'interface est en anglais, le thème suit celui de l'Hôte.

### Ajouter et afficher

- [x] La Vue a trois onglets, *Library*, *Radar* et *Editions* ; seul *Library* a du contenu dans ce ticket. L'onglet ouvert est retenu.
- [x] « Add manually » ouvre un formulaire : nom (requis), URL (facultative), description. La Skill est créée avec les valeurs par défaut de la spec (`watch`, 3 étoiles, Quadrant 0, modèle de Notes en français).
- [x] *Library* liste les Skills (nom, Anneau, étoiles, Quadrant), les plus récentes en premier. Le nom renvoie à l'URL dans un nouvel onglet quand elle existe.

### Stockage

- [x] Les Skills sont dans la clé `skills`, les réglages dans `settings`, enregistrés à chaque modification. Un échec d'écriture est affiché, et un échec de lecture au démarrage bloque l'ajout.
- [x] Test navigateur : ajouter une Skill à la main, recharger, elle est toujours là.
