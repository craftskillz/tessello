# Spec : Module Skills Library

**Status:** ready-for-agent

Vocabulaire : `GLOSSARY.md`. Contrat : la Convention (`convention/CONVENTION.md`). Spec de l'Hôte : `.scratch/tessello-v1/spec.md`. Modèles : `sample-modules/watch-later/` (`.scratch/watch-later/spec.md`) et `sample-modules/diagram/` (export PNG : `src/view/png.ts`). Blog cible : `craftskillz-blog` (Next.js, hors de ce dépôt).

> **Révision (tickets 11 à 16).** La bibliothèque ne range plus des skills une à une mais des **Ensembles** de skills (les skills de Matt Pocock, Obra Superpowers…, publiées sur GitHub comme un dossier de dossiers à `SKILL.md`). L'Anneau et le Quadrant passent à l'Ensemble ; la Note reste à chaque Skill. Les tickets 01 à 08 ont été livrés sur l'ancien modèle (une Skill = un point du radar) ; le ticket 11 convertit les données existantes.

> **Révision (tickets 17 à 19, 2026-10-23).** Le **Quadrant** devient le **Thème** (*Topic*), et il y en a **5** : un 5ᵉ, *Learning & upskilling*, s'ajoute aux 4 premiers. Le Thème passe de l'Ensemble à la **Skill** : chaque Skill est dans un seul Thème, et un Ensemble est dans tous les Thèmes de ses Skills. Sur le radar, un Ensemble a donc un point par Thème qu'il couvre (même numéro, même Anneau, même marqueur) ; le survol d'un point ne montre que les Skills de ce Thème. Les tickets 01 à 16 ont été livrés avec 4 Quadrants portés par l'Ensemble ; le ticket 18 convertit les données existantes.

## Problem Statement

L'Utilisateur découvre chaque jour de nouvelles skills d'agent (des dossiers avec un `SKILL.md`, publiés sur GitHub ou ailleurs). Elles arrivent le plus souvent par ensembles : un dépôt en publie une dizaine d'un coup, dans un même dossier. Il en essaie certains, en adopte d'autres, en abandonne quand un meilleur apparaît. Il n'a aucun endroit où garder trace de ce qu'il en pense : à quoi chaque skill lui sert, pourquoi, comment il l'utilise, ce que vaut chacune, et s'il recommande encore l'ensemble. Il veut aussi partager régulièrement ce jugement sur son blog, sous la forme d'un radar daté qui montre ce qu'il recommande, ce qu'il déconseille, et ce qui a bougé depuis la dernière fois.

## Solution

Le Module **Skills Library** (`@craftskillz/skills-library`, `sample-modules/skills-library/`) est la bibliothèque personnelle des skills de l'Utilisateur, rangées en **Ensembles**. Il importe un Ensemble en collant l'URL GitHub du dossier qui contient les skills (chaque sous-dossier direct qui a un `SKILL.md` est une Skill ; son nom et sa description sont lus dans le frontmatter), ou il le crée à la main. Pour chaque Ensemble, il choisit un **Anneau** (son verdict) et écrit des **Notes** ; pour chaque Skill de l'Ensemble, il choisit un **Thème**, donne une **Note** de 1 à 5 (ou la laisse *non évaluée*) et écrit des **Notes** en Markdown : à quoi elle sert, pourquoi, comment.

Quand il le décide, il **publie une Édition** : un instantané numéroté, daté et figé de sa bibliothèque, comparé à l'Édition précédente (Ensembles nouveaux, déplacés, mis à jour, retirés). Chaque Édition se télécharge en `.zip` qui reproduit l'arborescence du blog : un billet Markdown en anglais, avec le radar en SVG, et son image de couverture.

Le radar s'inspire du Technology Radar de Thoughtworks, sans en reprendre le nom, les anneaux ni le dessin. Le billet le dit en note de bas de page. Chaque point du radar est un Ensemble dans un Thème : un Ensemble qui couvre plusieurs Thèmes a un point dans chacun. Survoler un point montre les Skills de l'Ensemble dans ce Thème, et leurs Notes.

Le Widget (taille **M**) montre la répartition des Ensembles par Anneau, la date de la dernière Édition et le nombre de changements en attente.

## Vocabulaire du Module

Ces termes sont propres au Module ; ils n'entrent pas dans `GLOSSARY.md`.

- **Ensemble** (*Set*) : un groupe de Skills jugé comme un tout, nommé par l'Utilisateur (« Matt Pocock skills », « Obra Superpowers »). C'est l'Ensemble qui a un Anneau et qui apparaît sur le radar, une fois par Thème de ses Skills. Il n'a pas de Thème à lui. Un Ensemble d'une seule Skill reste un Ensemble ; un Ensemble sans Skill n'est pas sur le radar.
- **Skill** : une skill d'agent référencée dans un Ensemble (pas son contenu, seulement ses métadonnées et le jugement de l'Utilisateur). Elle a un Thème, et un seul ; elle n'a pas d'Anneau.
- **Anneau** (*Ring*) : le verdict de l'Utilisateur sur un Ensemble : *Recommended*, *Try*, *Watch*, *Deprecated* (mêmes libellés dans le billet).
- **Note** (*Score*) : une évaluation de 1 à 5 étoiles d'une Skill, indépendante de l'Anneau de son Ensemble. Une Skill sans Note est *non évaluée*. Un Ensemble n'a pas de Note.
- **Thème** (*Topic*) : l'une des 5 familles qui partagent le radar en secteurs. Anciennement **Quadrant**, quand il y en avait 4.
- **Notes** (*Notes*) : le texte Markdown de l'Utilisateur, sur un Ensemble ou sur une Skill.
- **Édition** (*Edition*) : un instantané numéroté, daté et figé de la bibliothèque, publiable sur le blog.
- **Changement** : ce qui distingue l'état courant d'un Ensemble de la dernière Édition : *nouveau*, *de retour*, *déplacé*, *mis à jour*, *retiré*.

## User Stories

### Ajouter

1. En tant qu'Utilisateur, je veux coller l'URL GitHub du dossier qui contient un ensemble de skills, afin que toutes ses skills soient trouvées, avec leur nom et leur description.
2. En tant qu'Utilisateur, je veux voir les skills trouvées avant l'import, en décocher, et nommer l'Ensemble, afin de n'importer que ce qui m'intéresse sous le nom que je choisis.
3. En tant qu'Utilisateur, je veux coller l'URL d'une seule skill (son dossier ou son `SKILL.md`), afin d'en faire un Ensemble d'une Skill.
4. En tant qu'Utilisateur, je veux créer un Ensemble à la main (nom, URL facultative, description), et ajouter des Skills à la main à n'importe quel Ensemble, afin de référencer ce qui n'est pas sur GitHub, ou quand le réseau manque.
5. En tant qu'Utilisateur, je veux qu'un Ensemble déjà présent ne soit pas ajouté deux fois, et que la Vue me montre celui qui existe, afin de garder une bibliothèque propre.
6. En tant qu'Utilisateur, je veux un message clair quand l'URL n'est pas reconnue ou qu'aucune skill n'est trouvée, avec la possibilité de continuer à la main, afin de ne pas rester bloqué.
7. En tant qu'Utilisateur, je veux rafraîchir un Ensemble depuis GitHub, afin que les skills ajoutées depuis l'import apparaissent (non évaluées) et que celles qui ont disparu soient signalées.

### Évaluer

8. En tant qu'Utilisateur, je veux ranger chaque Ensemble dans un Anneau, afin de dire si je le recommande, s'il est à essayer, à surveiller ou déconseillé.
9. En tant qu'Utilisateur, je veux donner à chaque Skill une Note de 1 à 5, ou la laisser non évaluée, afin de dire ce qu'elle vaut, indépendamment de mon verdict sur l'Ensemble.
10. En tant qu'Utilisateur, je veux écrire des Notes en Markdown sur l'Ensemble et sur chaque Skill (pré-remplies avec « What it's for / Why / How / Suggestions for improvement » pour une Skill), afin de garder trace de l'usage que j'en fais.
11. En tant qu'Utilisateur, je veux ranger chaque Skill dans un des 5 Thèmes, et renommer les Thèmes, afin d'organiser le radar à ma façon, même quand les Skills d'un Ensemble traitent de sujets différents.
11 bis. En tant qu'Utilisateur, je veux choisir le Thème de toutes les Skills d'un import en une fois, dans l'aperçu, afin de ne pas les ranger une à une.
12. En tant qu'Utilisateur, je veux filtrer la bibliothèque par Anneau et par Thème, et chercher par nom (d'Ensemble ou de Skill), afin de retrouver un Ensemble.

### Retirer

13. En tant qu'Utilisateur, je veux archiver un Ensemble, afin qu'il sorte du radar sans perdre ce que j'en ai écrit.
14. En tant qu'Utilisateur, je veux désarchiver un Ensemble, afin qu'il revienne sur le radar.
15. En tant qu'Utilisateur, je veux supprimer un Ensemble jamais publié (après confirmation), afin de corriger un ajout par erreur.
16. En tant qu'Utilisateur, je veux retirer une Skill d'un Ensemble (après confirmation), afin de ne garder que celles qui comptent.

### Publier

17. En tant qu'Utilisateur, je veux voir le radar de la prochaine Édition en direct, avec ce qui a changé depuis la dernière, afin de savoir ce que je vais publier.
18. En tant qu'Utilisateur, je veux survoler un point du radar et voir les Skills de l'Ensemble dans ce Thème, avec leurs Notes, afin de comprendre ce qu'il apporte à ce Thème sans ouvrir la bibliothèque.
19. En tant qu'Utilisateur, je veux qu'on me demande pourquoi un Ensemble change d'Anneau, afin que mes lecteurs comprennent le déplacement.
20. En tant qu'Utilisateur, je veux publier une Édition avec un texte d'introduction, afin de figer et de commenter l'état de ma bibliothèque.
21. En tant qu'Utilisateur, je veux télécharger le `.zip` de n'importe quelle Édition, à décompresser à la racine de mon blog, afin de publier le billet sans rien retoucher.
22. En tant qu'Utilisateur, je veux voir l'historique de mes Éditions, afin de retrouver ce que j'ai publié.

### Accueil

23. En tant qu'Utilisateur, je veux un Widget qui montre combien d'Ensembles sont dans chaque Anneau, la date de la dernière Édition et le nombre de changements en attente, afin de penser à publier.
24. En tant qu'Utilisateur, je veux un Guide d'utilisation, afin de découvrir les gestes du Module.

## Implementation Decisions

### Paquet

- `sample-modules/skills-library/`, identifiant `@craftskillz/skills-library`, Svelte 5, construit par esbuild comme Watch Later (`scripts/build.ts`, `dist/` non versionné).
- Permissions : `"network": ["https://raw.githubusercontent.com", "https://api.github.com"]`. `api.github.com` sert seulement à lister le dossier d'une URL (une requête par import ou rafraîchissement, sans authentification : 60 requêtes par heure suffisent) ; les `SKILL.md` sont lus sur `raw.githubusercontent.com`.
- La Vue et le Widget (taille **M**) respectent §4 : ni `localStorage`, ni `alert`/`confirm`/`prompt`, ni frame imbriquée. Les confirmations sont des boîtes de dialogue du Module. Les liens vers les skills s'ouvrent par `<a href target="_blank" rel="noopener">`.
- L'interface est en anglais. Le thème suit celui de l'Hôte. Le texte généré du billet, de son radar et de sa couverture est toujours en anglais, quelle que soit la langue de la Vue.
- La Vue s'adapte de 360 px à la largeur d'un ordinateur (§7.2).
- Le `.zip` est fait avec `fflate` (déjà utilisé par l'Hôte), embarqué dans le paquet. Le téléchargement passe par un lien `download` vers un `blob:` (ADR 0013), depuis la Vue seulement.

### Reconnaître une URL GitHub (fonction pure)

- `parseSkillUrl(text) → { owner, repo, ref, path, rawUrl, sourceUrl } | null`. Formes acceptées, avec ou sans `https://` et `www.` :
  - `github.com/<o>/<r>/blob/<ref>/<chemin>/SKILL.md` (le fichier d'une skill) ;
  - `github.com/<o>/<r>/tree/<ref>/<chemin>` (un dossier : celui d'une skill, ou celui qui en contient) ;
  - `github.com/<o>/<r>` (la racine du dépôt ; `ref` vaut `HEAD`, `chemin` est vide) ;
  - `raw.githubusercontent.com/<o>/<r>/<ref>/<chemin>/SKILL.md`.
- `path` est toujours le dossier (sans `/SKILL.md`). `rawUrl` est `https://raw.githubusercontent.com/<o>/<r>/<ref>/<chemin>/SKILL.md`. `sourceUrl` est l'URL du dossier sur `github.com` (`…/tree/<ref>/<chemin>`, ou la racine du dépôt), celle qu'on montre et qu'on publie.
- `ref` est le premier segment après `blob`/`tree` : une branche dont le nom contient `/` n'est pas reconnue correctement (limite connue, voir Out of Scope).
- Le reste (autre hôte, fichier qui n'est pas `SKILL.md`, query string, fragment) est ignoré ou rejeté : une URL `github.com` qui pointe un autre fichier que `SKILL.md` renvoie `null`.

### Trouver les skills d'une URL (un seul niveau)

- `discoverSkills(parsed, fetchFn) → { kind: "set", skills } | { kind: "single", skill } | { kind: "empty" } | { kind: "error", reason }`.
  1. Si l'URL pointe un `SKILL.md`, ou si `<chemin>/SKILL.md` existe sur raw : c'est **une seule skill** (le dossier est une skill ; ses sous-dossiers ne sont pas regardés). Une URL qui pointe un `SKILL.md` absent (404 sur raw) donne l'erreur « introuvable » : son dossier n'est pas listé.
  2. Sinon, la liste du dossier est demandée à l'API des contenus : `GET https://api.github.com/repos/<o>/<r>/contents/<chemin>?ref=<ref>` (sans `ref` quand il vaut `HEAD`). Pour chaque entrée `type: "dir"`, `<chemin>/<enfant>/SKILL.md` est lu sur raw : trouvé, c'est une Skill (nom et description par `readSkillFrontmatter`, nom par défaut le nom du dossier) ; 404, le dossier est ignoré. Les requêtes vers raw partent en parallèle, au plus 6 à la fois.
  3. **Un seul niveau** : `<chemin>/<enfant>/SKILL.md`, jamais plus profond. Un dossier sans aucune Skill directe donne `empty`.
- Chaque Skill trouvée a pour `sourceUrl` l'URL de son dossier (`…/tree/<ref>/<chemin>/<enfant>`).
- Erreurs : URL non reconnue, dossier introuvable (404 de l'API), limite de l'API atteinte (403 / 429, message « GitHub rate limit reached, try again later »), réseau. Chaque cas propose « Continue manually ».
- Message pour `empty` : « No skill folder found directly under this URL. Point to the folder that contains them, e.g. `…/tree/main/skills`. » Le Module ne cherche pas plus profond de lui-même.

### Lire le frontmatter (fonction pure)

- `readSkillFrontmatter(markdown) → { name?, description? }`. Lit le bloc `---` en tête du fichier : valeurs sur une ligne, entre guillemets simples ou doubles ou sans, et blocs repliés `>` / `|`. Pas de bibliothèque YAML. Un frontmatter absent ou illisible renvoie `{}` : le formulaire reste à remplir à la main.
- Le nom par défaut est le dernier segment du chemin quand `name` manque.

### Importer : l'aperçu

- Après la découverte, une boîte de dialogue montre les Skills trouvées (nom, description), chacune avec une case cochée par défaut, le **nom de l'Ensemble**, pré-rempli avec le nom du dépôt (pour une seule skill : le nom de la skill), modifiable, requis (1 à 100 caractères), et un **Thème** (le premier par défaut) donné à toutes les Skills importées. « Import » crée l'Ensemble avec les Skills cochées ; il faut au moins une case cochée. Le Thème de chaque Skill se change ensuite dans le panneau d'édition.
- La description de l'Ensemble est vide à l'import ; sa `sourceUrl` est l'URL collée, normalisée (le dossier).

### Rafraîchir un Ensemble

- « Refresh from GitHub » (Ensemble avec une `sourceUrl` GitHub) relance la découverte sur la `sourceUrl` de l'Ensemble.
- Une Skill trouvée dont la `sourceUrl` n'est dans aucune Skill de l'Ensemble est ajoutée, *non évaluée*, dans le Thème par défaut de l'Ensemble (« Modèle de données »). Une Skill de l'Ensemble (avec `sourceUrl` dans ce dossier) qui n'est plus trouvée reçoit `goneUpstream: true` : elle reste, avec ses Notes, marquée « Removed upstream » ; l'Utilisateur la retire s'il le veut. Une Skill retrouvée perd `goneUpstream`. Les noms et descriptions des Skills existantes ne sont pas écrasés.
- Le résultat est résumé (« 2 skills added, 1 removed upstream ») ; une erreur de découverte ne change rien. Une découverte `empty` ne change rien non plus et le dit (« No skill found at this URL any more. Nothing was changed. ») : un dossier vidé ou déplacé ne marque pas tout l'Ensemble « Removed upstream ». L'Utilisateur retire les Skills à la main s'il le veut.

### Doublons

- La clé de doublon est la `sourceUrl` normalisée de l'**Ensemble** : `owner` et `repo` en minuscules, sans `/` final. Un Ensemble créé à la main sans URL n'a pas de clé et n'est jamais un doublon.
- Une URL d'Ensemble déjà présente (archivé compris) n'ajoute rien ; la Vue fait défiler jusqu'à l'Ensemble existant et le met en évidence.
- Une même Skill peut figurer dans deux Ensembles différents (le dépôt entier et l'un de ses sous-dossiers, par exemple). Dans un même Ensemble, deux Skills de même `sourceUrl` ne sont pas acceptées.

### Modèle de données

- **Ensemble** : `id` (aléatoire, stable, jamais réutilisé), `name`, `sourceUrl?`, `description`, `ring` (`recommended` | `try` | `watch` | `deprecated`), `notes` (Markdown), `skills` (liste ordonnée de Skills), `addedAt` (ISO), `updatedAt` (ISO), `archived` (booléen), `moveReason?` (la phrase qui explique un déplacement en attente). Les **Thèmes d'un Ensemble** sont ceux de ses Skills, sans doublon, par indice croissant ; un Ensemble sans Skill n'en a aucun.
- **Skill** (dans un Ensemble) : `id` (aléatoire, stable, unique dans la bibliothèque), `name`, `sourceUrl?`, `description`, `topic` (0 à 4), `score` (1 à 5, ou absent : *non évaluée*), `notes` (Markdown), `addedAt` (ISO), `goneUpstream?` (booléen).
- À la création d'un Ensemble : `ring` vaut `watch`, `notes` est vide. À l'ajout d'une Skill : `score` absent, `topic` vaut celui de l'import (aperçu) ou, à la main et au rafraîchissement, le **Thème par défaut de l'Ensemble** : le Thème le plus fréquent parmi ses Skills (à égalité, le plus petit indice ; sans Skill, 0). `notes` contient le modèle :

  ```markdown
  #### What it's for

  #### Why

  #### How

  #### Suggestions for improvement
  ```

  Le modèle est en anglais, comme l'interface du Module (décision du Mainteneur, 2026-10-23). Les Notes sont publiées telles quelles dans le billet en anglais : les titres remplis y apparaissent donc en anglais.
- L'ordre des Skills d'un Ensemble est celui de la découverte (ordre alphabétique du dossier), les Skills ajoutées ensuite à la fin.
- **Thèmes** : 5 noms, par défaut *Design & planning*, *Code & tests*, *Writing & docs*, *Tooling & workflow*, *Learning & upskilling*. Renommer ne change pas l'indice des Skills. Un nom est requis (1 à 40 caractères). Le billet utilise les noms tels que l'Utilisateur les a écrits.

### Migration des Quadrants vers les Thèmes

- Au chargement, un Ensemble qui a encore un `quadrant` (0 à 3) donne ce `topic` à chacune de ses Skills qui n'en a pas, puis perd `quadrant`. Le résultat est écrit dans `sets`.
- `settings.quadrants` (4 noms) devient `settings.topics` : les 4 noms gardés à leur indice, le 5ᵉ par défaut. Les filtres par Quadrant deviennent des filtres par Thème, au même indice.
- Les Éditions publiées avant ne sont pas réécrites : `readEdition` donne à chaque Skill d'une entrée le `quadrant` de l'entrée comme `topic`, et lit `quadrants` (4 noms) comme ses Thèmes. Une ancienne Édition se dessine donc en **4 secteurs**, avec ses noms d'alors, et son `.zip` reste le même (à la mise en page près).

### Migration de l'ancien modèle

- Au chargement, si la clé `sets` est absente et que la clé `skills` (ancien modèle) existe, chaque ancienne Skill devient un **Ensemble d'une Skill** : l'Ensemble prend `id`, `name`, `sourceUrl`, `description`, `quadrant`, `ring`, `addedAt`, `updatedAt`, `archived`, `moveReason` ; ses `notes` sont vides ; sa seule Skill prend un nouvel `id`, le même `name`, `sourceUrl`, `description`, `addedAt`, et l'ancien `score` et les anciennes `notes`. Le résultat est écrit dans `sets` ; `skills` n'est pas effacée.
- Les Éditions publiées sous l'ancien modèle ne sont pas réécrites : `readEdition` reconnaît l'ancienne forme (des entrées sans `skills`) et la convertit à la lecture de la même façon, en gardant l'`id` de l'entrée comme `id` de l'Ensemble. Le Changement calculé contre une ancienne Édition reste juste : l'Ensemble migré a l'`id` de l'ancienne Skill. Le `.zip` d'une ancienne Édition se télécharge avec la mise en page des Ensembles.

### Changements (fonction pure)

- `changesSince(sets, editions) → Map<id, Changement | "unchanged">`, par Ensemble ; sans Édition précédente : tout Ensemble non archivé est *nouveau*. Ici, « sur le radar » veut dire non archivé **et avec au moins une Skill** : un Ensemble vidé de ses Skills compte comme archivé (*retiré* s'il était dans la dernière Édition, *de retour* quand il retrouve une Skill).
  - *nouveau* : non archivé, absent de la dernière Édition et de toutes les précédentes ;
  - *de retour* : non archivé, absent de la dernière Édition mais présent dans une plus ancienne (il avait été archivé) ;
  - *déplacé* : présent dans la dernière Édition, dans un autre Anneau ; on connaît le sens (vers *Recommended* ou vers *Deprecated*) ;
  - *mis à jour* : présent, même Anneau, mais les `notes` de l'Ensemble diffèrent, ou une Skill a été ajoutée ou retirée, ou la Note ou les `notes` d'une Skill diffèrent. Le détail est connu : Skills ajoutées, Skills retirées, Notes changées (`avant → après`) ;
  - *retiré* : présent dans la dernière Édition, archivé maintenant ;
  - *inchangé* : le reste. Un changement de Thème d'une Skill (même s'il ajoute ou retire un point de l'Ensemble), de nom ou de description (Ensemble ou Skill), ou de `goneUpstream`, ne compte pas comme Changement : le radar et le billet prennent la nouvelle valeur sans le signaler.
- Un Ensemble *déplacé* porte aussi le détail de ses Skills (ajoutées, retirées, Notes changées) quand il y en a.
- Le compteur « changements en attente » compte *nouveau*, *de retour*, *déplacé* et *retiré* (pas *mis à jour*).
- **Explication d'un déplacement** : quand l'Anneau d'un Ensemble diffère de celui de la dernière Édition, le panneau d'édition demande « Why did it move? » (une phrase, 1 à 280 caractères), gardée dans `moveReason`. Si l'Ensemble revient à son Anneau publié, `moveReason` est effacé. On ne peut pas publier tant qu'un Ensemble déplacé n'a pas d'explication : le bouton de publication liste ceux qui manquent.

### Éditions

- Publier demande une **introduction** (Markdown, requise). La publication crée l'Édition `n + 1` avec : `number`, `publishedAt` (ISO), `intro`, `topics` (les 5 noms du moment), et pour chaque Ensemble non archivé qui a au moins une Skill une **entrée** figée (`id`, `name`, `sourceUrl?`, `description`, `ring`, `notes`, `change`, `moveReason?`, `previousRing?`, le détail des Skills changées, et `skills` : pour chaque Skill `id`, `name`, `sourceUrl?`, `description`, `topic`, `score?`, `notes`), plus la liste des Ensembles *retirés* (`id`, `name`, `previousRing`).
- Une Édition n'est jamais modifiée. Après publication, `moveReason` est effacé de tous les Ensembles.
- Un Ensemble présent dans au moins une Édition ne se supprime pas : le bouton « Delete » n'apparaît que pour un Ensemble jamais publié. Les autres s'archivent. Une Skill se retire d'un Ensemble à tout moment (après confirmation) : les Éditions en gardent leur copie figée.

### Radar (SVG, fonction pure)

- `renderRadar(entries, topics, options) → string` : un SVG autonome, dessiné à partir du modèle (pas capturé de l'écran). La Vue l'affiche en direct pour la prochaine Édition ; le billet et la couverture utilisent le même rendu.
- 4 anneaux concentriques, *Recommended* au centre, *Deprecated* à l'extérieur. Autant de **secteurs** égaux que de noms dans `topics` (5 ; 4 pour une Édition d'avant le ticket 17), chacun avec son nom, placé hors du cercle sans chevaucher un autre nom ni sortir du dessin.
- Chaque couple (**Ensemble**, Thème d'une de ses Skills) est un point. La position (angle dans le secteur, rayon dans l'Anneau) est **dérivée d'un hachage de l'`id` de l'Ensemble et de l'indice du Thème**, avec une marge pour ne pas toucher les bords : elle reste la même d'une Édition à l'autre tant que l'Ensemble ne change pas d'Anneau et garde une Skill dans ce Thème. Deux points trop proches sont écartés de façon déterministe. Un Ensemble sans Skill n'a pas de point.
- Marqueurs : ● inchangé ou mis à jour, ◆ nouveau ou de retour, ▲ déplacé vers *Recommended*, ▼ déplacé vers *Deprecated*. Tous les points d'un Ensemble ont le même. Une légende des marqueurs accompagne le radar.
- Numérotation : **un numéro par Ensemble**, porté par tous ses points. Ordre : par premier Thème de l'Ensemble (le plus petit indice), puis par Anneau (du centre vers l'extérieur), puis par nom. Les numéros sont propres à chaque Édition.
- Chaque point porte un `<title>` (infobulle native, sans JavaScript) : « <n>. <Ensemble> — <Anneau> · <Thème> », puis une ligne par Skill **de ce Thème** : « <nom> ★★★★☆ » ou « <nom> (not evaluated) » (même libellé dans le billet). Chaque point porte aussi `data-set-id`, `data-number` et `data-topic` (l'indice), pour qu'un script du blog puisse l'enrichir sans changer le Module.
- Couleurs : une teinte par Thème (5), lisible sur fond clair et sombre (le blog a un thème sombre). Le SVG ne dépend d'aucune feuille de style externe.

### Billet du blog (fonction pure) et `.zip`

- `renderPost(edition) → string` (l'Édition figée porte déjà le Changement, l'Anneau quitté, l'explication et le détail des Skills de chaque entrée, et les Ensembles retirés), le Markdown d'un billet de `craftskillz-blog` (`_posts/*.md`, lu par `gray-matter`, rendu par `remark-gfm` + `remark-html` avec `sanitize: false`, donc le HTML brut et le SVG en ligne passent).
- Slug : `skills-radar-edition-<n>`. Frontmatter :

  ```yaml
  title: "Skills Radar — Edition <n>"
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
  2. le radar en SVG **sur une seule ligne** (une ligne vide couperait le bloc HTML pour Markdown), suivi de la légende numérotée, une ligne par Ensemble (numéro, nom de l'Ensemble, Anneau, ses Thèmes, nombre de Skills) ;
  3. `## What's changed` : chaque Ensemble *nouveau*, *de retour* ou *déplacé*, groupé par Anneau (paragraphe en gras), en **fiche complète** :
     - `### <n>. <Ensemble>`, un badge (*New*, *Back*, *Moved: Try → Recommended*), l'explication du déplacement, la description, un lien vers `sourceUrl`, les Notes de l'Ensemble ;
     - pour un Ensemble *déplacé*, le détail des Skills : « Added: … », « Removed: … », « Scores: <nom> ★★☆☆☆ → ★★★★☆ » ;
     - un tableau des Skills, rangées par Thème puis dans leur ordre : nom (en lien vers sa `sourceUrl`), Thème, étoiles pleines et vides ou *Not evaluated*, description ;
     - pour chaque Skill dont les Notes ne sont pas vides (ou réduites au modèle sans contenu), `#### <nom de la Skill>` puis ses Notes ;
  4. `## The rest of the radar` : les Ensembles *inchangés* et *mis à jour*, groupés par Anneau, en liste compacte : `- **<n>.** <Ensemble en lien> (<k> skills)`, et *updated* le cas échéant, suivi du détail des Skills changées sur la même ligne ;
  5. `## Retired from the radar` (s'il y en a) : nom de l'Ensemble et Anneau quitté ;
  6. une note de bas de page : « Inspired by Thoughtworks' Technology Radar. »
- Décision du Mainteneur (2026-10-23) : tous les libellés générés sont en anglais. Introduction, noms, descriptions, Thèmes et Notes restent tels que saisis.
- Une section vide est omise. Les titres des Notes de l'Ensemble sont décalés pour que le plus haut soit `####` ; ceux des Notes d'une Skill, pour que le plus haut soit `#####` (sous le `####` de la Skill). Le reste des Notes est publié tel quel, hors des blocs de code.
- À la première Édition, tous les Ensembles sont *nouveaux* : tous ont leur fiche complète.
- **Couverture** : le radar seul, rendu en PNG 1200 × 630 sur un fond plein (comme `src/view/png.ts` de Diagram : SVG → image → canvas → `toBlob`).
- **`.zip`** `skills-radar-edition-<n>.zip`, à décompresser à la racine du blog :
  - `_posts/skills-radar-edition-<n>.md`
  - `public/assets/blog/skills-radar-edition-<n>/cover.png`
- Le `.zip` se télécharge pour n'importe quelle Édition, depuis l'onglet *Editions* : il est régénéré à partir de l'Édition figée, donc toujours identique (à la couverture et à la mise en page près, si le rendu évolue).

### Vue

- Trois onglets, retenus dans `settings` :
  - **Library** : la liste des Ensembles (nom, Anneau, Thèmes, nombre de Skills dont non évaluées, Changement en attente ; « No skill — not on the radar » pour un Ensemble sans Skill), filtrable par Anneau et par Thème (un Ensemble passe le filtre si une de ses Skills est dans un Thème choisi), avec une recherche par nom d'Ensemble ou de Skill et un interrupteur « Show archived ». Le champ « Paste a GitHub URL » et le bouton « New set » sont en haut. Un clic ouvre un **panneau d'édition** latéral (en plein écran sous 600 px) : nom, URL, description, Anneau, Notes de l'Ensemble, explication du déplacement si besoin, Archive / Unarchive / Delete, « Refresh from GitHub » ; puis la liste des Skills (nom, Thème, étoiles ou « Not evaluated », « Removed upstream » le cas échéant), « Add skill », et pour chaque Skill un dépliant : nom, URL, description, Thème, Note (avec « Clear » pour revenir à non évaluée), Notes, « Remove from set ». Les Thèmes se renomment depuis un réglage de cet onglet (« Rename topics »).
  - **Radar** : le radar de la prochaine Édition en direct, la liste des changements en attente, et « Publish edition <n> » (boîte de dialogue : introduction, puis confirmation). Survoler un point (ou le toucher sur un écran tactile, ou le focaliser au clavier) ouvre un **panneau** : nom de l'Ensemble, Anneau, le Thème du point, et chaque Skill **de ce Thème** avec ses étoiles ou « Not evaluated ». Un clic dans le panneau ouvre l'Ensemble dans l'onglet *Library*.
  - **Editions** : l'historique (numéro, date, nombre d'Ensembles par Anneau), le plus récent en premier, avec « Download .zip » pour chacune.

### Widget (M)

- Le nombre d'Ensembles non archivés par Anneau, la date de la dernière Édition (ou « No edition yet »), et « N changes waiting » quand N > 0. Un clic ouvre la Vue (`navigation.openView`).

### Stockage (§6.1)

- `sets` : la liste de tous les Ensembles, archivés compris, avec leurs Skills. Une Skill pèse environ 2 Ko avec des Notes moyennes. La Vue refuse des Notes de plus de 8 000 caractères (Ensemble ou Skill). Une valeur est limitée à 1 Mo : environ 400 Skills ; au-delà, l'écriture échoue et l'échec est affiché.
- `skills` : l'ancien modèle, lu une seule fois pour la migration, jamais écrit.
- `settings` : `{ topics: [string × 5], tab, filters }` (`filters` : `rings`, `topics`, `query`, `archived`). Un ancien `quadrants` est lu une fois (« Migration des Quadrants vers les Thèmes »).
- `editions` : l'index `[{ number, publishedAt, counts }]`.
- `edition:<n>` : une Édition complète, dans sa propre clé pour rester sous 1 Mo par valeur. À 50 Skills d'environ 2 Ko, une Édition pèse environ 100 Ko : la limite de 5 Mo laisse plusieurs dizaines d'Éditions. Un `quota_exceeded` à la publication est affiché, et rien n'est publié (l'Édition est écrite avant l'index).
- Chaque modification est enregistrée aussitôt. Un échec est affiché, et la modification reste visible, signalée comme non enregistrée. Un échec de lecture au démarrage bloque l'édition.
- La Vue et le Widget relisent le stockage quand ils redeviennent visibles.

## Testing Decisions

- **Un bon test** vérifie un comportement observable, comme dans la spec de l'Hôte.
- **Tests unitaires** (`sample-modules/skills-library/test`, lancés par `npm test`) sur les fonctions pures : `parseSkillUrl` (chaque forme, rejets), `discoverSkills` (une seule skill, un ensemble, un seul niveau, dossiers ignorés, `empty`, erreurs de l'API, avec un `fetch` simulé), `readSkillFrontmatter` (guillemets, blocs repliés, frontmatter absent), la clé de doublon, la migration (bibliothèque et Éditions, ancien modèle et Quadrants vers Thèmes), le Thème par défaut d'un Ensemble, le rafraîchissement, `changesSince` (chaque Changement, sens d'un déplacement, détail des Skills, compteur), `renderRadar` (positions stables pour un même `id`, marqueurs, numérotation, `<title>` et `data-`), `renderPost` (frontmatter lu par `gray-matter` en test, SVG sur une ligne, sections, tableau des Skills, titres des Notes décalés, première Édition, ancienne Édition).
- **Tests navigateur** (paquet construit et zippé, installé dans l'Hôte) pour les parcours de chaque ticket. `raw.githubusercontent.com` et `api.github.com` sont simulés (routes Playwright) pour que les tests ne dépendent pas de GitHub. Le `.zip` téléchargé est décompressé et son contenu vérifié.
- Le paquet passe le Validateur sans erreur ni avertissement. Le test des exemples couvre `sample-modules/skills-library`.

## Out of Scope

- Stocker ou afficher le contenu des skills (seulement leurs métadonnées et le jugement de l'Utilisateur).
- Chercher des skills à plus d'un niveau sous l'URL collée, ou dans tout un dépôt ; l'API GitHub au-delà de la liste d'un dossier ; l'authentification GitHub.
- Les branches dont le nom contient `/` dans une URL `blob`/`tree`.
- Les serveurs MCP, prompts et autres configurations d'agent qui ne sont pas des skills.
- Une Note sur un Ensemble, un Anneau sur une Skill, un Thème sur un Ensemble, ou plusieurs Thèmes sur une Skill.
- Un Anneau différent pour un même Ensemble selon le Thème.
- Un nombre de Thèmes choisi par l'Utilisateur (il y en a 5, renommables).
- Déplacer une Skill d'un Ensemble à un autre.
- Les tags en dehors des 5 Thèmes.
- L'aperçu rendu des Notes Markdown dans la Vue (elles s'éditent en texte).
- Écrire directement dans le dépôt du blog, ou le publier : le Module remet un `.zip`. (Le ticket 16 modifie le blog, à la main, dans son propre dépôt.)
- Modifier ou supprimer une Édition publiée.
- Le sondage de la communauté sur le radar : ticket d'investigation à part (`issues/10`).
