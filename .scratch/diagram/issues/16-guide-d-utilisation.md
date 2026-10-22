# 16: Guide d'utilisation du Module Diagram

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** Le Guide d'utilisation complet (§3.2, ADR 0010). Il remplace le guide minimal du ticket 01, sur le modèle du guide du Survival Kit (ticket 18 de tessello-v1).

**Blocked by:** 15 (Import)

**Status:** resolved

- [x] Le guide est en anglais et décrit les gestes clés : tracer une flèche d'un geste, viser un point d'attache, ajouter un point de passage, choisir un tracé, déplacer une étiquette, verrouiller et déverrouiller, copier un style, suivre un lien, créer une forme personnalisée, importer depuis living-documentation, exporter.
- [x] Une table des raccourcis clavier.
- [x] Une section sur le stockage : les images comptent dans le quota de 5 Mo, et la jauge l'indique.
- [x] Quelques captures prises dans l'Hôte, légères (§2). Le paquet reste sous la limite et passe le Validateur sans avertissement.

## Comments

### Implémentation (2026-10-22)

- **Guide** : `sample-modules/diagram/guide/guide.md`. Le guide du ticket 01 avait déjà été complété ticket après ticket. Ce ticket y ajoute un sommaire, la section « Bring your diagrams from living-documentation », une table des raccourcis clavier, et la section « Storage and your data », qui dit ce qui compte dans les 5 Mo et ce que fait la jauge. Il ajoute aussi l'échec d'un import à « When something goes wrong » : une écriture interrompue peut laisser une partie de l'import, et un nouvel essai ajoute des copies.
- **Captures** : cinq, dans `guide/images/` (environ 170 Ko), en densité 1× : la Vue, une flèche sélectionnée, l'éditeur de formes, la confirmation d'un import et le Widget. Comme pour le Survival Kit, un script Playwright ponctuel et non versionné les prend dans l'Hôte construit. Il remplit le Module par un import de fichiers living-documentation inventés.
- **Paquet** : 600 Ko, 0 avertissement du Validateur. Le test navigateur du Module ouvre le Guide depuis ⓘ et vérifie que ses cinq images s'affichent.
