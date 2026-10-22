# Spec : Module Watch Later

**Status:** ready-for-agent

Vocabulaire : `GLOSSARY.md`. Contrat : la Convention (`convention/CONVENTION.md`). Spec de l'Hôte : `.scratch/tessello-v1/spec.md`. Modèles : `sample-modules/survival-kit/` et `sample-modules/diagram/` (`.scratch/diagram/spec.md`).

## Problem Statement

L'Utilisateur tombe sur des vidéos YouTube qu'il n'a pas le temps de regarder tout de suite. Il les garde aujourd'hui dans des onglets ouverts, des favoris ou des messages à lui-même, où elles se perdent. Il veut un endroit unique dans son Espace pour les collecter en un geste, les ranger par thème, et retrouver celles qu'il n'a pas encore vues.

## Solution

Le Module **Watch Later** (`@craftskills/watch-later`, `sample-modules/watch-later/`) collecte des liens de vidéos YouTube. L'Utilisateur colle une URL ou glisse-dépose un lien dans la Vue. Le Module en tire l'identifiant de la vidéo, récupère son titre et sa chaîne par l'oEmbed de YouTube, et affiche sa miniature. Chaque vidéo a un statut « à voir » / « vue », une note facultative, des tags et une date d'ajout.

La Vue présente les vidéos **en lignes par tag** : chaque ligne défile horizontalement, et la page défile verticalement d'un tag à l'autre. Un clic sur une vidéo l'ouvre sur YouTube dans un nouvel onglet : la Convention interdit les frames imbriquées (§4), il n'y a donc pas de lecteur dans Tessello.

Le Widget (taille **L**) est un aperçu des vidéos à voir et un point d'entrée vers la Vue.

## User Stories

### Collecter

1. En tant qu'Utilisateur, je veux coller une URL YouTube dans la Vue (dans le champ d'ajout, ou n'importe où avec Ctrl/Cmd+V), afin d'ajouter une vidéo en un geste.
2. En tant qu'Utilisateur, je veux glisser-déposer un lien YouTube (depuis un onglet, la barre d'adresse ou une page) sur la Vue, afin d'ajouter une vidéo sans copier.
3. En tant qu'Utilisateur, je veux que le titre, la chaîne et la miniature apparaissent tout seuls, afin de reconnaître la vidéo sans l'ouvrir.
4. En tant qu'Utilisateur, je veux qu'une vidéo déjà présente ne soit pas ajoutée deux fois, et que la Vue me montre celle qui existe, afin de garder une liste propre.
5. En tant qu'Utilisateur, je veux un message clair quand ce que je colle ou dépose n'est pas une vidéo YouTube, afin de comprendre pourquoi rien n'est ajouté.
6. En tant qu'Utilisateur, je veux qu'une vidéo dont le titre n'a pas pu être récupéré (hors ligne, vidéo privée) soit quand même ajoutée, avec la possibilité de réessayer, afin de ne rien perdre.

### Ranger et retrouver

7. En tant qu'Utilisateur, je veux ajouter et retirer des tags sur une vidéo, en réutilisant les tags existants, afin de ranger mes vidéos par thème.
8. En tant qu'Utilisateur, je veux voir une ligne par tag, qui défile horizontalement, et faire défiler les tags verticalement, afin de parcourir mes vidéos comme un catalogue.
9. En tant qu'Utilisateur, je veux écrire une note facultative sur une vidéo, afin de me rappeler pourquoi je l'ai gardée.
10. En tant qu'Utilisateur, je veux voir la date d'ajout de chaque vidéo, afin de savoir depuis quand elle attend.

### Regarder

11. En tant qu'Utilisateur, je veux ouvrir une vidéo sur YouTube dans un nouvel onglet en cliquant dessus, afin de la regarder.
12. En tant qu'Utilisateur, je veux marquer une vidéo comme vue ou à voir, afin de suivre ce qu'il me reste.
13. En tant qu'Utilisateur, je veux cacher ou montrer les vidéos vues, et que ce choix soit retenu, afin de ne voir que ce qui reste à regarder.
14. En tant qu'Utilisateur, je veux supprimer une vidéo (après confirmation), afin de retirer ce qui ne m'intéresse plus.

### Accueil

15. En tant qu'Utilisateur, je veux un Widget sur l'Accueil qui montre combien de vidéos sont à voir et les dernières ajoutées, afin de m'en souvenir, et ouvrir une vidéo ou la Vue en un clic.
16. En tant qu'Utilisateur, je veux un Guide d'utilisation, afin de découvrir les gestes du Module.

## Implementation Decisions

### Paquet

- `sample-modules/watch-later/`, identifiant `@craftskills/watch-later`, Svelte 5, construit par esbuild comme le Survival Kit et Diagram (`scripts/build.ts`, `dist/` non versionné). Il est livré dans `sample-modules/` tant que la marketplace n'existe pas.
- Permissions : `"network": ["https://www.youtube.com", "https://i.ytimg.com"]`. L'oEmbed répond `Access-Control-Allow-Origin: null` (vérifié le 2026-10-22), et la miniature est une image distante.
- La Vue et le Widget (taille **L**) respectent §4 : ni `localStorage`, ni routeur à base d'historique, ni `alert`/`confirm`/`prompt`, ni frame imbriquée. Les confirmations sont des boîtes de dialogue du Module. Les vidéos s'ouvrent par `<a href target="_blank" rel="noopener">`.
- Le thème suit celui de l'Hôte, et la langue suit le `locale` du handshake (anglais par défaut, français).
- La Vue s'adapte de 360 px à la largeur d'un ordinateur (§7.2). Le défilement horizontal des lignes marche à la molette (Maj+molette), au trackpad, au toucher et avec des boutons ‹ › sur ordinateur.

### Reconnaître une URL (fonction pure)

- `parseYouTubeUrl(text) → { videoId, start? } | null`. Formes acceptées : `youtube.com/watch?v=`, `m.youtube.com`, `music.youtube.com`, `youtu.be/<id>`, `youtube.com/shorts/<id>`, `youtube.com/live/<id>`, `youtube.com/embed/<id>`, avec ou sans `https://` et `www.`. Le paramètre `t` ou `start` (`90`, `90s`, `1m30s`) donne `start` en secondes. Les autres paramètres (`list`, `si`, `feature`…) sont ignorés.
- Un identifiant vidéo fait 11 caractères `[A-Za-z0-9_-]`. Tout le reste renvoie `null`.
- Un glisser-déposer lit `text/uri-list`, puis `text/plain`. Un collage ou un dépôt de plusieurs lignes ajoute chaque URL reconnue.

### Modèle de données

- **Vidéo** : `videoId` (clé, unique), `start?`, `title`, `channel?`, `addedAt` (ISO), `watched` (booléen), `watchedAt?`, `note?`, `tags` (liste de chaînes, sans doublon, comparées sans tenir compte de la casse), `metaStatus` (`ok` | `failed`).
- L'URL ouverte est reconstruite : `https://www.youtube.com/watch?v=<id>` (+ `&t=<start>s`). La miniature est `https://i.ytimg.com/vi/<id>/mqdefault.jpg`.
- Le titre et la chaîne sont lus **une fois**, à l'ajout, puis gardés : la liste s'affiche hors ligne (sauf les miniatures). Si l'oEmbed échoue, le titre est l'URL, `metaStatus` vaut `failed` et la carte propose « Réessayer ».

### Lignes par tag

- Une ligne par tag, par ordre alphabétique, puis une ligne « Sans tag » en dernier. Une vidéo qui a plusieurs tags apparaît dans chaque ligne.
- Dans une ligne, les vidéos les plus récemment ajoutées viennent en premier. Chaque ligne affiche son nombre de vidéos.
- Les lignes vides (par exemple quand toutes leurs vidéos sont vues et cachées) ne s'affichent pas.

### Stockage (§6.1)

- `videos` : la liste de toutes les vidéos. Une vidéo pèse environ 300 octets sans note, ce qui laisse de la place pour plusieurs milliers de vidéos sous la limite de 1 Mo par valeur. La Vue refuse une note de plus de 2 000 caractères.
- `settings` : `{ hideWatched: boolean }`, vrai par défaut.
- Chaque modification est enregistrée aussitôt. Un échec (`quota_exceeded`, par exemple) est affiché, et la modification reste visible, signalée comme non enregistrée. Un échec de lecture au démarrage bloque l'édition au lieu de montrer une liste vide qui écraserait les données.
- La Vue et le Widget relisent le stockage quand ils redeviennent visibles.

## Testing Decisions

- **Un bon test** vérifie un comportement observable, comme dans la spec de l'Hôte.
- **Tests unitaires** (`sample-modules/watch-later/test`, lancés par `npm test`) sur les fonctions pures : `parseYouTubeUrl` (chaque forme d'URL, timestamps, rejets), lecture d'un dépôt ou d'un collage de plusieurs lignes, regroupement en lignes par tag et tri, ajout sans doublon, normalisation des tags.
- **Tests navigateur** (paquet construit et zippé, installé dans l'Hôte) pour les parcours de chaque ticket. L'oEmbed et les miniatures sont simulés (route Playwright) pour que les tests ne dépendent pas de YouTube.
- Le paquet passe le Validateur sans erreur ni avertissement. Le test des exemples couvre `sample-modules/watch-later`.

## Out of Scope

- Un lecteur intégré (la Convention interdit les frames).
- D'autres sources que YouTube (Vimeo, PeerTube…). Le modèle garde `videoId` propre à YouTube : une autre source demandera une évolution du modèle.
- L'import de playlists YouTube, et toute API YouTube qui demande une clé.
- La synchronisation avec le « À regarder plus tard » du compte YouTube.
- Le réordonnancement manuel des vidéos ou des lignes.
