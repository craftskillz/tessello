# 13: Importer un Ensemble depuis une URL GitHub

Spec parente : `.scratch/skills-library/spec.md`. Vocabulaire : `GLOSSARY.md` et « Vocabulaire du Module » de la spec. Contrat : la Convention.

**What to build:** Coller l'URL GitHub d'un dossier de skills importe l'Ensemble entier : chaque sous-dossier direct qui contient un `SKILL.md` devient une Skill, après un aperçu où l'Utilisateur décoche des Skills et nomme l'Ensemble. Une URL qui pointe une seule skill donne un Ensemble d'une Skill.

**Blocked by:** 11

**Status:** resolved

- [x] Permission réseau `https://api.github.com` ajoutée au manifeste ; le paquet passe le Validateur sans avertissement.
- [x] `parseSkillUrl` : `path` désigne toujours le dossier (spec, « Reconnaître une URL GitHub »).
- [x] `discoverSkills(parsed, fetchFn)` (spec, « Trouver les skills d'une URL ») : une seule skill quand l'URL pointe un `SKILL.md` ou un dossier qui en a un ; sinon l'API des contenus liste le dossier et chaque `<enfant>/SKILL.md` est lu sur raw (au plus 6 requêtes à la fois) ; un seul niveau ; dossiers sans `SKILL.md` ignorés ; `empty` ; erreurs (URL, 404, limite de l'API, réseau).
- [x] Tests unitaires de `discoverSkills` avec un `fetch` simulé : ensemble de type `obra/superpowers/tree/main/skills`, une seule skill par dossier et par `blob/…/SKILL.md`, racine de dépôt sans skill directe (`empty`), sous-sous-dossier ignoré, 403 de l'API, `ref` `HEAD` omis de la requête.
- [x] Aperçu : liste des Skills trouvées avec cases cochées par défaut, nom de l'Ensemble pré-rempli (nom du dépôt, ou de la skill pour une seule), requis ; « Import » exige au moins une case.
- [x] Messages : `empty` (« No skill folder found directly under this URL. Point to the folder that contains them, e.g. …/tree/main/skills. »), limite de l'API, introuvable, réseau ; chacun propose « Continue manually » (nouvel Ensemble pré-rempli avec l'URL).
- [x] Doublon : une URL d'Ensemble déjà présente n'ouvre pas l'aperçu, la Vue montre l'Ensemble existant.
- [x] Tests navigateur (`api.github.com` et `raw.githubusercontent.com` simulés) : importer un ensemble de quatre skills dont un dossier sans `SKILL.md`, décocher une Skill, renommer l'Ensemble, voir trois Skills non évaluées ; coller l'URL d'une seule skill ; coller une racine sans skill directe et lire le message ; coller deux fois la même URL.
