# Spec : Module Skills Library

**Status:** ready-for-agent

Vocabulaire : `GLOSSARY.md`. Contrat : la Convention (`convention/CONVENTION.md`). Spec de l'Hôte : `.scratch/tessello-v1/spec.md`. Modèles : `sample-modules/watch-later/` (`.scratch/watch-later/spec.md`) et `sample-modules/diagram/` (export PNG : `src/view/png.ts`). Blog cible : `craftskillz-blog` (Next.js, hors de ce dépôt).

## Problem Statement

L'Utilisateur découvre chaque jour de nouvelles skills d'agent (des dossiers avec un `SKILL.md`, publiés sur GitHub ou ailleurs). Il en essaie certaines, en adopte d'autres, en abandonne quand une meilleure apparaît. Il n'a aucun endroit où garder trace de ce qu'il en pense : à quoi chacune lui sert, pourquoi, comment il l'utilise, et s'il la recommande encore. Il veut aussi partager régulièrement ce jugement sur son blog, sous la forme d'un radar daté qui montre ce qu'il recommande, ce qu'il déconseille, et ce qui a bougé depuis la dernière fois.

## Solution

Le Module **Skills Library** (`@craftskillz/skills-library`, `sample-modules/skills-library/`) est la bibliothèque personnelle des skills de l'Utilisateur. Il ajoute une skill en collant son URL GitHub (le nom et la description sont lus dans le frontmatter du `SKILL.md`) ou à la main. Pour chaque skill, il choisit un **Anneau** (son verdict), une **Note** de 1 à 5 et un **Quadrant**, et il écrit des **Notes** en Markdown : à quoi elle sert, pourquoi, comment.

Quand il le décide, il **publie une Édition** : un instantané numéroté, daté et figé de sa bibliothèque, comparé à l'Édition précédente (skills nouvelles, déplacées, mises à jour, retirées). Chaque Édition se télécharge en `.zip` qui reproduit l'arborescence du blog : un billet Markdown en français, avec le radar en SVG, et son image de couverture.

Le radar s'inspire du Technology Radar de Thoughtworks, sans en reprendre le nom, les anneaux ni le dessin. Le billet le dit en note de bas de page.

Le Widget (taille **M**) montre la répartition par Anneau, la date de la dernière Édition et le nombre de changements en attente.

## Vocabulaire du Module

Ces termes sont propres au Module ; ils n'entrent pas dans `GLOSSARY.md`.

- **Skill** : une skill d'agent référencée dans la bibliothèque (pas son contenu, seulement ses métadonnées et le jugement de l'Utilisateur).
- **Anneau** (*Ring*) : le verdict de l'Utilisateur sur une Skill : *Recommended*, *Try*, *Watch*, *Deprecated* (dans le billet : *Recommandé*, *À essayer*, *À surveiller*, *Déconseillé*).
- **Note** (*Score*) : une évaluation de 1 à 5 étoiles, indépendante de l'Anneau. Une bonne Skill peut être *Deprecated* parce qu'une meilleure l'a remplacée.
- **Quadrant** (*Quadrant*) : l'une des 4 familles qui partagent le radar.
- **Notes** (*Notes*) : le texte Markdown de l'Utilisateur sur une Skill.
- **Édition** (*Edition*) : un instantané numéroté, daté et figé de la bibliothèque, publiable sur le blog.
- **Changement** : ce qui distingue l'état courant d'une Skill de la dernière Édition : *nouvelle*, *de retour*, *déplacée*, *mise à jour*, *retirée*.

## User Stories

### Ajouter

1. En tant qu'Utilisateur, je veux coller l'URL GitHub d'une skill (son `SKILL.md` ou son dossier), afin que son nom et sa description soient remplis tout seuls.
2. En tant qu'Utilisateur, je veux ajouter une skill à la main (nom, URL facultative, description), afin de référencer une skill qui n'est pas sur GitHub, ou quand le réseau manque.
3. En tant qu'Utilisateur, je veux qu'une skill déjà présente ne soit pas ajoutée deux fois, et que la Vue me montre celle qui existe, afin de garder une bibliothèque propre.
4. En tant qu'Utilisateur, je veux un message clair quand l'URL n'est pas reconnue ou que le `SKILL.md` est introuvable, avec la possibilité de continuer à la main, afin de ne pas rester bloqué.

### Évaluer

5. En tant qu'Utilisateur, je veux ranger chaque skill dans un Anneau, afin de dire si je la recommande, si elle est à essayer, à surveiller ou déconseillée.
6. En tant qu'Utilisateur, je veux lui donner une Note de 1 à 5, afin de dire ce qu'elle vaut, indépendamment de mon verdict.
7. En tant qu'Utilisateur, je veux écrire des Notes en Markdown, pré-remplies avec « À quoi ça sert / Pourquoi / Comment », afin de garder trace de l'usage que j'en fais.
8. En tant qu'Utilisateur, je veux ranger chaque skill dans un des 4 Quadrants, et renommer les Quadrants, afin d'organiser le radar à ma façon.
9. En tant qu'Utilisateur, je veux filtrer la bibliothèque par Anneau et par Quadrant, et chercher par nom, afin de retrouver une skill.

### Retirer

10. En tant qu'Utilisateur, je veux archiver une skill, afin qu'elle sorte du radar sans perdre ce que j'en ai écrit.
11. En tant qu'Utilisateur, je veux désarchiver une skill, afin qu'elle revienne sur le radar.
12. En tant qu'Utilisateur, je veux supprimer une skill jamais publiée (après confirmation), afin de corriger un ajout par erreur.

### Publier

13. En tant qu'Utilisateur, je veux voir le radar de la prochaine Édition en direct, avec ce qui a changé depuis la dernière, afin de savoir ce que je vais publier.
14. En tant qu'Utilisateur, je veux qu'on me demande pourquoi une skill change d'Anneau, afin que mes lecteurs comprennent le déplacement.
15. En tant qu'Utilisateur, je veux publier une Édition avec un texte d'introduction, afin de figer et de commenter l'état de ma bibliothèque.
16. En tant qu'Utilisateur, je veux télécharger le `.zip` de n'importe quelle Édition, à décompresser à la racine de mon blog, afin de publier le billet sans rien retoucher.
17. En tant qu'Utilisateur, je veux voir l'historique de mes Éditions, afin de retrouver ce que j'ai publié.

### Accueil

18. En tant qu'Utilisateur, je veux un Widget qui montre combien de skills sont dans chaque Anneau, la date de la dernière Édition et le nombre de changements en attente, afin de penser à publier.
19. En tant qu'Utilisateur, je veux un Guide d'utilisation, afin de découvrir les gestes du Module.

## Implementation Decisions

### Paquet

- `sample-modules/skills-library/`, identifiant `@craftskillz/skills-library`, Svelte 5, construit par esbuild comme Watch Later (`scripts/build.ts`, `dist/` non versionné).
- Permissions : `"network": ["https://raw.githubusercontent.com"]`. Le Module ne lit que des `SKILL.md` ; il n'appelle pas l'API GitHub.
- La Vue et le Widget (taille **M**) respectent §4 : ni `localStorage`, ni `alert`/`confirm`/`prompt`, ni frame imbriquée. Les confirmations sont des boîtes de dialogue du Module. Les liens vers les skills s'ouvrent par `<a href target="_blank" rel="noopener">`.
- L'interface est en anglais. Le thème suit celui de l'Hôte. Le billet généré est en français.
- La Vue s'adapte de 360 px à la largeur d'un ordinateur (§7.2).
- Le `.zip` est fait avec `fflate` (déjà utilisé par l'Hôte), embarqué dans le paquet. Le téléchargement passe par un lien `download` vers un `blob:` (ADR 0013), depuis la Vue seulement.

### Reconnaître une URL de skill (fonction pure)

- `parseSkillUrl(text) → { owner, repo, ref, path, rawUrl, sourceUrl } | null`. Formes acceptées, avec ou sans `https://` et `www.` :
  - `github.com/<o>/<r>/blob/<ref>/<chemin>/SKILL.md` (le fichier) ;
  - `github.com/<o>/<r>/tree/<ref>/<chemin>` (le dossier ; `/SKILL.md` est ajouté) ;
  - `github.com/<o>/<r>` (la racine du dépôt ; `ref` vaut `HEAD`, `chemin` est vide) ;
  - `raw.githubusercontent.com/<o>/<r>/<ref>/<chemin>/SKILL.md`.
- `rawUrl` est `https://raw.githubusercontent.com/<o>/<r>/<ref>/<chemin>/SKILL.md`. `sourceUrl` est l'URL du dossier sur `github.com` (`…/tree/<ref>/<chemin>`, ou la racine du dépôt), celle qu'on montre et qu'on publie.
- `ref` est le premier segment après `blob`/`tree` : une branche dont le nom contient `/` n'est pas reconnue correctement (limite connue, voir Out of Scope).
- Le reste (autre hôte, fichier qui n'est pas `SKILL.md`, query string, fragment) est ignoré ou rejeté : une URL `github.com` qui pointe un autre fichier que `SKILL.md` renvoie `null`.

### Lire le frontmatter (fonction pure)

- `readSkillFrontmatter(markdown) → { name?, description? }`. Lit le bloc `---` en tête du fichier : valeurs sur une ligne, entre guillemets simples ou doubles ou sans, et blocs repliés `>` / `|`. Pas de bibliothèque YAML. Un frontmatter absent ou illisible renvoie `{}` : le formulaire reste à remplir à la main.
- Le nom par défaut est le dernier segment du chemin quand `name` manque.

### Doublons

- La clé de doublon est `sourceUrl` normalisée : `owner` et `repo` en minuscules, sans `/` final. Une Skill ajoutée à la main sans URL n'a pas de clé et n'est jamais un doublon.
- Une URL déjà présente (archivée comprise) n'ajoute rien ; la Vue fait défiler jusqu'à la Skill existante et la met en évidence.

### Modèle de données

- **Skill** : `id` (aléatoire, stable, jamais réutilisé), `name`, `sourceUrl?`, `description`, `quadrant` (0 à 3), `ring` (`recommended` | `try` | `watch` | `deprecated`), `score` (1 à 5), `notes` (Markdown), `addedAt` (ISO), `updatedAt` (ISO), `archived` (booléen), `moveReason?` (la phrase qui explique un déplacement en attente).
- À l'ajout : `ring` vaut `watch`, `score` vaut 3, `quadrant` vaut 0, et `notes` contient le modèle :

  ```markdown
  #### À quoi ça sert

  #### Pourquoi

  #### Comment
  ```

  Le modèle est en français parce que les Notes sont publiées telles quelles dans le billet.
- **Quadrants** : 4 noms, par défaut *Design & planning*, *Code & tests*, *Writing & docs*, *Tooling & workflow*. Renommer ne change pas l'indice des Skills. Un nom est requis (1 à 40 caractères). Le billet utilise les noms tels que l'Utilisateur les a écrits.

### Changements (fonction pure)

- `changesSince(skills, lastEdition) → Map<id, Changement | "unchanged">`, sans Édition précédente : toute Skill non archivée est *nouvelle*.
  - *nouvelle* : non archivée, absente de la dernière Édition et de toutes les précédentes ;
  - *de retour* : non archivée, absente de la dernière Édition mais présente dans une plus ancienne (elle avait été archivée) ;
  - *déplacée* : présente dans la dernière Édition, dans un autre Anneau ; on connaît le sens (vers *Recommended* ou vers *Deprecated*) ;
  - *mise à jour* : présente, même Anneau, mais `notes` ou `score` différents ;
  - *retirée* : présente dans la dernière Édition, archivée maintenant ;
  - *inchangée* : le reste. Un changement de Quadrant ou de nom ne compte pas comme Changement : le radar et le billet prennent la nouvelle valeur sans le signaler.
- Le compteur « changements en attente » compte *nouvelle*, *de retour*, *déplacée* et *retirée* (pas *mise à jour*).
- **Explication d'un déplacement** : quand l'Anneau d'une Skill diffère de celui de la dernière Édition, le panneau d'édition demande « Why did it move? » (une phrase, 1 à 280 caractères), gardée dans `moveReason`. Si la Skill revient à son Anneau publié, `moveReason` est effacé. On ne peut pas publier tant qu'une Skill déplacée n'a pas d'explication : le bouton de publication liste celles qui manquent.

### Éditions

- Publier demande une **introduction** (Markdown, requise). La publication crée l'Édition `n + 1` avec : `number`, `publishedAt` (ISO), `intro`, `quadrants` (les 4 noms du moment), et pour chaque Skill non archivée une **entrée** figée (`id`, `name`, `sourceUrl?`, `description`, `quadrant`, `ring`, `score`, `notes`, `change`, `moveReason?`, `previousRing?`), plus la liste des Skills *retirées* (`id`, `name`, `previousRing`).
- Une Édition n'est jamais modifiée. Après publication, `moveReason` est effacé de toutes les Skills.
- Une Skill présente dans au moins une Édition ne se supprime pas : le bouton « Delete » n'apparaît que pour une Skill jamais publiée. Les autres s'archivent.

### Radar (SVG, fonction pure)

- `renderRadar(entries, quadrants, options) → string` : un SVG autonome, dessiné à partir du modèle (pas capturé de l'écran). La Vue l'affiche en direct pour la prochaine Édition ; le billet et la couverture utilisent le même rendu.
- 4 anneaux concentriques, *Recommended* au centre, *Deprecated* à l'extérieur. 4 quadrants, chacun avec son nom.
- Chaque Skill est un point numéroté. La position (angle dans le Quadrant, rayon dans l'Anneau) est **dérivée d'un hachage de son `id`**, avec une marge pour ne pas toucher les bords : elle reste la même d'une Édition à l'autre tant que la Skill ne change ni d'Anneau ni de Quadrant. Deux points trop proches sont écartés de façon déterministe.
- Marqueurs : ● inchangée ou mise à jour, ◆ nouvelle ou de retour, ▲ déplacée vers *Recommended*, ▼ déplacée vers *Deprecated*. Une légende des marqueurs accompagne le radar.
- Numérotation : par Quadrant, puis par Anneau (du centre vers l'extérieur), puis par nom. Les numéros sont propres à chaque Édition.
- Couleurs : une teinte par Quadrant, lisible sur fond clair et sombre (le blog a un thème sombre). Le SVG ne dépend d'aucune feuille de style externe.

### Billet du blog (fonction pure) et `.zip`

- `renderPost(edition, previousEditions, options) → string`, le Markdown d'un billet de `craftskillz-blog` (`_posts/*.md`, lu par `gray-matter`, rendu par `remark-gfm` + `remark-html` avec `sanitize: false`, donc le HTML brut et le SVG en ligne passent).
- Slug : `skills-radar-edition-<n>`. Frontmatter :

  ```yaml
  title: "Skills Radar — Édition <n>"
  excerpt: "<premier paragraphe de l'introduction, en texte brut>"
  coverImage: "/assets/blog/skills-radar-edition-<n>/cover.png"
  date: "<publishedAt>"
  author:
    picture: "/assets/blog/authors/yma_logo.png"
  ogImage:
    url: "/assets/blog/skills-radar-edition-<n>/cover.png"
  ```

  Les chaînes sont échappées pour YAML (guillemets, retours à la ligne).
- Corps, dans l'ordre :
  1. l'introduction ;
  2. le radar en SVG **sur une seule ligne** (une ligne vide couperait le bloc HTML pour Markdown), suivi de la légende numérotée (numéro, nom, Anneau) ;
  3. `## Ce qui bouge` : pour chaque Skill *nouvelle*, *de retour* ou *déplacée*, groupées par Anneau, `### <n>. <nom> ★★★★☆` (étoiles pleines et vides), un badge (*Nouveau*, *De retour*, *Déplacé : À essayer → Recommandé*), l'explication du déplacement, la description, un lien vers `sourceUrl`, puis les Notes ;
  4. `## Le reste du radar` : les Skills *inchangées* et *mises à jour*, groupées par Anneau, en liste compacte (numéro, nom en lien, étoiles, *mise à jour* le cas échéant) ;
  5. `## Retirées du radar` (s'il y en a) : nom et Anneau quitté ;
  6. une note de bas de page : « Inspiré du Technology Radar de Thoughtworks. »
- Les titres des Notes sont abaissés pour que le plus haut soit au niveau `####` (sous le `###` de la Skill). Le reste des Notes est publié tel quel.
- À la première Édition, toutes les Skills sont *nouvelles* : toutes ont leur fiche complète.
- **Couverture** : le radar seul, rendu en PNG 1200 × 630 sur un fond plein (comme `src/view/png.ts` de Diagram : SVG → image → canvas → `toBlob`).
- **`.zip`** `skills-radar-edition-<n>.zip`, à décompresser à la racine du blog :
  - `_posts/skills-radar-edition-<n>.md`
  - `public/assets/blog/skills-radar-edition-<n>/cover.png`
- Le `.zip` se télécharge pour n'importe quelle Édition, depuis l'onglet *Editions* : il est régénéré à partir de l'Édition figée, donc toujours identique (à la couverture près, si le rendu évolue).

### Vue

- Trois onglets, retenus dans `settings` :
  - **Library** : la liste des Skills (nom, Anneau, étoiles, Quadrant, Changement en attente), filtrable par Anneau et par Quadrant, avec une recherche par nom et un interrupteur « Show archived ». Le champ « Paste a GitHub URL » et le bouton « Add manually » sont en haut. Un clic ouvre un **panneau d'édition** latéral (en plein écran sous 600 px) : nom, URL, description, Quadrant, Anneau, Note, Notes (zone de texte Markdown), explication du déplacement si besoin, Archive / Unarchive / Delete. Les Quadrants se renomment depuis un réglage de cet onglet.
  - **Radar** : le radar de la prochaine Édition en direct, la liste des changements en attente, et « Publish edition <n> » (boîte de dialogue : introduction, puis confirmation).
  - **Editions** : l'historique (numéro, date, nombre de Skills par Anneau), le plus récent en premier, avec « Download .zip » pour chacune.

### Widget (M)

- Le nombre de Skills non archivées par Anneau, la date de la dernière Édition (ou « No edition yet »), et « N changes waiting » quand N > 0. Un clic ouvre la Vue (`navigation.openView`).

### Stockage (§6.1)

- `skills` : la liste de toutes les Skills, archivées comprises. Une Skill pèse environ 2 Ko avec des Notes moyennes. La Vue refuse des Notes de plus de 8 000 caractères.
- `settings` : `{ quadrants: [string, string, string, string], tab, filters }`.
- `editions` : l'index `[{ number, publishedAt, counts }]`.
- `edition:<n>` : une Édition complète, dans sa propre clé pour rester sous 1 Mo par valeur. À 50 Skills d'environ 2 Ko, une Édition pèse environ 100 Ko : la limite de 5 Mo laisse plusieurs dizaines d'Éditions. Un `quota_exceeded` à la publication est affiché, et rien n'est publié (l'Édition est écrite avant l'index).
- Chaque modification est enregistrée aussitôt. Un échec est affiché, et la modification reste visible, signalée comme non enregistrée. Un échec de lecture au démarrage bloque l'édition.
- La Vue et le Widget relisent le stockage quand ils redeviennent visibles.

## Testing Decisions

- **Un bon test** vérifie un comportement observable, comme dans la spec de l'Hôte.
- **Tests unitaires** (`sample-modules/skills-library/test`, lancés par `npm test`) sur les fonctions pures : `parseSkillUrl` (chaque forme, rejets), `readSkillFrontmatter` (guillemets, blocs repliés, frontmatter absent), la clé de doublon, `changesSince` (chaque Changement, sens d'un déplacement, compteur), `renderRadar` (positions stables pour un même `id`, marqueurs, numérotation), `renderPost` (frontmatter lu par `gray-matter` en test, SVG sur une ligne, sections, titres des Notes abaissés, première Édition).
- **Tests navigateur** (paquet construit et zippé, installé dans l'Hôte) pour les parcours de chaque ticket. `raw.githubusercontent.com` est simulé (route Playwright) pour que les tests ne dépendent pas de GitHub. Le `.zip` téléchargé est décompressé et son contenu vérifié.
- Le paquet passe le Validateur sans erreur ni avertissement. Le test des exemples couvre `sample-modules/skills-library`.

## Out of Scope

- Stocker ou afficher le contenu des skills (seulement leurs métadonnées et le jugement de l'Utilisateur).
- Importer d'un coup toutes les skills d'un dépôt, et l'API GitHub.
- Les branches dont le nom contient `/` dans une URL `blob`/`tree`.
- Les serveurs MCP, prompts et autres configurations d'agent qui ne sont pas des skills.
- Les tags en dehors des 4 Quadrants.
- L'aperçu rendu des Notes Markdown dans la Vue (elles s'éditent en texte).
- Écrire directement dans le dépôt du blog, ou le publier : le Module remet un `.zip`.
- Modifier ou supprimer une Édition publiée.
- Le sondage de la communauté sur le radar : ticket d'investigation à part (`issues/10`).
