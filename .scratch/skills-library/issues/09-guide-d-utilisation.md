# 09: Guide d'utilisation du Module Skills Library

Spec parente : `.scratch/skills-library/spec.md`. Vocabulaire : `GLOSSARY.md` et « Vocabulaire du Module » de la spec. Contrat : la Convention.

**What to build:** Le Guide d'utilisation complet (§3.2, ADR 0010). Il remplace le guide minimal du ticket 01, sur le modèle des guides de Watch Later et de Diagram.

**Blocked by:** 02, 07, 08, 11, 12, 13, 14, 15

**Status:** resolved

- [x] Le guide est en anglais et décrit les gestes clés : les Ensembles et leurs Skills, coller l'URL GitHub d'un dossier de skills (un seul niveau) et l'aperçu, créer un Ensemble et ajouter des Skills à la main, rafraîchir un Ensemble, Anneau de l'Ensemble et Thème de chaque Skill, Note de chaque Skill (ou non évaluée, et pourquoi elle est indépendante de l'Anneau), Notes aux deux niveaux, archiver ou supprimer un Ensemble, retirer une Skill, le survol d'un Ensemble sur le radar, le radar et ses marqueurs, expliquer un déplacement, publier une Édition, télécharger le `.zip` et le décompresser à la racine du blog, le Widget.
- [x] Il explique à quoi servent les Permissions réseau sur `raw.githubusercontent.com` (lire les `SKILL.md`) et `api.github.com` (lister un dossier), et que le Module ne garde pas le contenu des skills.
- [x] Quelques captures prises dans l'Hôte, légères (§2). Le paquet reste sous la limite et passe le Validateur sans avertissement.

## Comments

### Implémentation (2026-10-23)

- Le guide existant couvrait déjà les parcours ajoutés par les tickets précédents. Il est complété avec l'indépendance Note / Anneau, les changements « Updated » et le retrait de la dernière Skill, les Permissions réseau, le contenu conservé, le fonctionnement hors ligne, les erreurs de stockage et la suppression des données à la désinstallation. La légende du radar est décrite selon son rendu actuel.
- Le critère qui parlait du Quadrant de l'Ensemble suit désormais les tickets 17 à 19 : cinq Thèmes, choisis par Skill.
- Cinq captures réelles de l'Hôte, avec des données d'exemple et les réponses GitHub simulées : Library, aperçu d'import, édition d'une Skill, radar avec panneau de survol et Widget. Total : 297 195 octets. Le paquet construit pèse 570 913 octets, sous la limite de 10 Mio.
- Vérification dans Chromium : installation du paquet construit, ouverture du Guide depuis « About » dans le Lanceur, affichage des cinq images et contrôle visuel. Aucun code de capture temporaire n'est ajouté au dépôt.
- Vérifications : `npm run typecheck` ; 25 tests ciblés (exemples et rendu du Guide) ; `npm test` (1 131 tests réussis) ; construction et `tessello validate` (aucune erreur, aucun avertissement). Revue Standards / Spec : aucun constat restant après corrections.
- Limite de vérification : `npm run test:browser` donne 195 réussites sur 196. Le test existant « the two points of a set in two topics each open their own panel… » échoue aussi seul, à `packages/host/e2e/skills-library.test.ts:1207` : le panneau de survol ne se ferme pas après déplacement du pointeur vers « Publish edition ». Le présent ticket ne modifie ni ce test ni le code de la Vue ; les vérifications du Guide réussissent.
