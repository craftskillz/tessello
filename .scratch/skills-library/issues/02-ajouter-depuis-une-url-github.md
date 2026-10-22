# 02: Ajouter une skill depuis son URL GitHub, sans doublon

Spec parente : `.scratch/skills-library/spec.md`. Vocabulaire : `GLOSSARY.md` et « Vocabulaire du Module » de la spec. Contrat : la Convention.

**What to build:** Coller l'URL GitHub d'une skill (son `SKILL.md`, son dossier ou la racine d'un dépôt) lit le `SKILL.md` sur `raw.githubusercontent.com` et pré-remplit le nom et la description. Une URL déjà présente n'ajoute rien. Une erreur laisse continuer à la main.

**Blocked by:** 01

**Status:** resolved

- [x] `parseSkillUrl` reconnaît les formes de la spec (`blob`, `tree`, racine du dépôt, `raw.githubusercontent.com`), calcule `rawUrl` et `sourceUrl`, et rejette le reste. Elle est testée unitairement.
- [x] `readSkillFrontmatter` lit `name` et `description` (une ligne, guillemets, blocs `>` et `|`), et renvoie `{}` sans frontmatter. Le nom par défaut est le dernier segment du chemin. Testée unitairement.
- [x] Le champ « Paste a GitHub URL » en haut de *Library* ajoute sur Entrée ou au collage. La Skill est créée avec le nom et la description lus, et `sourceUrl` comme URL ; son panneau d'édition s'ouvre.
- [x] Une URL non reconnue, un `SKILL.md` introuvable (404) ou une erreur réseau affichent un message clair, et proposent « Add manually » pré-rempli avec l'URL.
- [x] La clé de doublon est `sourceUrl` normalisée (testée unitairement). Une URL déjà présente, archivée comprise, n'ajoute rien : la Vue montre la Skill existante et la met en évidence. L'ajout manuel applique la même règle quand une URL est saisie.
- [x] Test navigateur (`raw.githubusercontent.com` simulé) : coller une URL de dossier, voir le nom et la description lus ; recoller la même URL, rien n'est ajouté ; coller une URL introuvable, continuer à la main.

## Comments

- Le panneau d'édition n'existe pas encore (ticket 03) : la Skill ajoutée est mise en évidence dans la liste à la place. Dans `src/view/View.svelte`, `select` est l'unique endroit où le ticket 03 ouvrira le panneau.
- Le nom et la description lus dans un `SKILL.md` sont coupés à `NAME_MAX` et `DESCRIPTION_MAX`, les limites de la Vue.
