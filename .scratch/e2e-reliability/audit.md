# Audit : où va chaque test navigateur d'un Module

Ticket [03](issues/03-audit-et-repartition.md). Les tickets 04 à 09 suivent cette table ; personne ne refait le tri.

Fait le 2026-10-25, sur `tessello` `eadef2a`, et les clones locaux des Modules : `tessello-survival-kit` `3cd3835` (1.2.0), `tessello-watch-later` `7d70172` (0.6.0), `tessello-skills-library` `d71fcb4` (0.4.0), `tessello-diagram` `721aee4` (0.4.0).

## Résumé

Un test qui prouve plusieurs choses est découpé en morceaux (`a`, `b`…) : le compte est celui des lignes de la table, pas des tests.

| Module | Tests | contrat | déjà couvert | unitaire | navigateur du Module | Hôte | Lignes |
|---|---|---|---|---|---|---|---|
| Survival Kit | 7 | 3 | 6 | 0 | 6 | 1 | 16 |
| Watch Later | 19 | 2 | 20 | 2 | 19 | 0 | 43 |
| Skills Library | 54 | 2 | 45 | 8 | 46 | 0 | 101 |
| Diagram | 45 | 3 | 34 | 2 | 43 | 2 | 84 |
| **Total** | **125** | **10** | **105** | **12** | **114** | **3** | **244** |

Les deux contrats « Guide d'utilisation » de Watch Later et Skills Library sont à écrire (ticket 05) : ils ne sont pas comptés ici, faute de test actuel.

**Tests de contrat retenus** (ticket 05), au plus 3 par Module. Chacun installe le `.zip` publié de `packages/host/e2e/fixtures/` :

| Module | Contrat | Vient de |
|---|---|---|
| Survival Kit | C1. La Vue démarre ; une tâche écrite se relit après un rechargement. | `survival-kit.test.ts:59` a |
| | C2. Le Widget démarre et montre la tâche urgente écrite par la Vue. | `survival-kit.test.ts:90` a |
| | C3. Le Guide d'utilisation s'ouvre depuis le Lanceur, avec ses images. | `survival-kit.test.ts:176` |
| Watch Later | C1. La Vue démarre ; une vidéo ajoutée (oEmbed simulé) se relit après un rechargement. | `watch-later.test.ts:101` a |
| | C2. Le Widget démarre, montre la vidéo ajoutée dans la Vue, et ouvre la Vue. | `watch-later.test.ts:809` a |
| | C3. Le Guide d'utilisation s'ouvre depuis le Lanceur. **À écrire** : aucun test actuel ne l'ouvre. | — |
| Skills Library | C1. La Vue démarre ; un set ajouté à la main se relit après un rechargement. | `skills-library.test.ts:169` a |
| | C2. Le Widget démarre, compte les sets écrits par la Vue, et ouvre la Vue. | `skills-library.test.ts:252` a |
| | C3. Le Guide d'utilisation s'ouvre depuis le Lanceur. **À écrire** : aucun test actuel ne l'ouvre. | — |
| Diagram | C1. La Vue démarre ; un diagramme et ses formes se relisent après un rechargement. | `diagram.test.ts:644` a |
| | C2. Le Widget démarre, liste le diagramme créé dans la Vue, et ouvre la Vue dessus. | `diagram.test.ts:1704` a |
| | C3. Le Guide d'utilisation s'ouvre depuis le Lanceur, avec ses images. | `diagram.test.ts:1816` |

**Tests « Hôte »** : 3 morceaux prouvent un comportement de l'Hôte qu'aucun test de l'Hôte ne prouve encore. Ils restent dans ce dépôt ; le ticket 10 peut les réécrire avec un Module sonde (comme `home.test.ts` ou `downloads.test.ts`) plutôt que de garder un Module @craftskillz :

- une Vue dans son iframe `sandbox` écrit dans le presse-papiers (`survival-kit.test.ts:190` b) ;
- l'Hôte dit aux Modules affichés qu'ils sont cachés, puis visibles, quand la page elle-même est cachée puis montrée (`visibilitychange`, `packages/host/src/main.ts:335`) (`diagram.test.ts:1143` c) ;
- un lien ouvert par une Vue s'ouvre dans un nouvel onglet, hors du bac à sable (`allow-popups-to-escape-sandbox`) (`diagram.test.ts:1546` b).

## Conventions

- **Ligne** : la ligne du `test(` dans `packages/host/e2e/<module>.test.ts`, au commit ci-dessus ; une lettre désigne un morceau.
- **déjà couvert** cite un test du dépôt du Module (`test/…`, chemin relatif au clone) par sa ligne et son nom, lu pour vérifier qu'il prouve la même règle. Quand le morceau prouve un comportement de l'Hôte que les tests de l'Hôte prouvent déjà, il est aussi « déjà couvert », et c'est le test de l'Hôte qui est cité (dans ce dépôt) : il disparaît sans remplacement (spec, « Hypothèses de périmètre »).
- **unitaire** cite le fichier de test visé et le code testé. Ne sont proposés que les modules TypeScript purs : `store.svelte.ts` et les composants `.svelte` (runes Svelte 5) ne se chargent pas dans `node --test` sans les compiler, et les sources ne changent pas ; leur logique va donc dans la suite navigateur du Module.
- **navigateur du Module** décrit ce que le test de la suite navigateur du Module doit prouver, contre l'Hôte de test du ticket 04. Plusieurs lignes peuvent tenir dans un même test de cette suite.
- La persistance après un rechargement, que presque tous les tests vérifient, est prouvée une fois par Module par le contrat C1 (stockage de l'Hôte), et dans la suite du Module par un rechargement de la page contre le stockage de l'Hôte de test.

## Survival Kit

`packages/host/e2e/survival-kit.test.ts`, 7 tests. Tests unitaires : `../tessello-survival-kit/test/` (`kit.test.ts`, `storage.test.ts`).

| Ligne | Test, ou morceau | Destin | Justification |
|---|---|---|---|
| 59 a | keeps a task, a note with a Code block and a link after a reload : installation, la Vue démarre, une tâche se relit après un rechargement | **contrat** | C1. |
| 59 b | ↳ une URL sans schéma reçoit `https://` | **déjà couvert** | `test/kit.test.ts:36` « a link URL › without a scheme gets https:// » ; `test/storage.test.ts:40` « reads a kit written by version 1.0.0, in the shape of the original » (`grafana.example.com` relu en `https://…`) : `readCategories` (`src/lib/kit.ts:178`) applique `withScheme` à la relecture, si bien que le lien rechargé l'a, quel que soit le dialogue qui l'a écrit. |
| 59 c | ↳ la note s'affiche avec son bloc Code dans un `pre`, la catégorie et son lien sont créés par leurs dialogues, le lien s'ouvre dans un nouvel onglet (`target=_blank`), « expand all » | **navigateur du Module** | Dialogues et rendu de `NotesPanel`/`LinksPanel` ; la construction du bloc est déjà couverte (`test/kit.test.ts:10` « keeps a heading, a text and a code exactly as typed »). |
| 90 a | a task checked in the Widget shows as done when the View comes back : le Widget démarre et montre la tâche urgente écrite par la Vue | **contrat** | C2. |
| 90 b | ↳ le Widget ne montre que les tâches urgentes non faites, « 1 urgent », « 2 to do » ; cochée dans le Widget, la tâche est écrite faite ; la Vue relit le kit quand elle est montrée de nouveau | **navigateur du Module** | Logique dans `Widget.svelte` (`$derived`) et `View.svelte` ; Hôte de test : stockage partagé Vue/Widget, événement `visibility`. |
| 90 c | ↳ la Vue et le Widget partagent le stockage, et l'Hôte prévient la Vue cachée puis montrée | **déjà couvert** | Hôte : `home.test.ts:132` « shows the Notes Widget, which follows the notes written in the View and opens it » ; `home.test.ts:216` « a Widget hidden by a View, and a View left behind the Home, are told they are hidden, then visible again ». |
| 112 a | the Widget's urgent count opens the View filtered on Urgent, whether the View is loaded or not : le Widget appelle `openView({ filter: "urgent" })` ; la Vue applique le filtre reçu dans `context.params`, et dans un événement `navigation.params` | **navigateur du Module** | Hôte de test : enregistre `openView`, démarre une Vue avec des paramètres, envoie `navigation.params`. |
| 112 b | ↳ l'Hôte transmet les paramètres par le handshake ou par un événement | **déjà couvert** | Hôte : `home.test.ts:192` « the Notes Widget's + opens the View ready to write a new note, also when the View was left behind the Home » ; `packages/host-core/test/protocol.test.ts:240` « a Widget asks the Host to open its Module's View with params ». |
| 136 a | imports a .survival-kit.json of the original Survival Kit, after a confirmation, and refuses a file that is not a kit : lecture du format d'origine, refus d'un fichier qui n'est pas un kit | **déjà couvert** | `test/kit.test.ts:98` « reads a .survival-kit.json of the original Survival Kit » ; `test/kit.test.ts:137` « refuses a file that is not JSON, or not a kit ». |
| 136 b | ↳ le fichier choisi par `input[type=file]`, l'alerte qui nomme le fichier refusé, la confirmation qui compte tâches, notes et catégories, « Replace » remplace le kit et l'écrit | **navigateur du Module** | Hôte de test : lecture du stockage écrit. |
| 168 a | tells the User when a change cannot be saved : le message pour un stockage plein | **déjà couvert** | `test/storage.test.ts:51` « a full storage is a message for the User ». |
| 168 b | ↳ la Vue montre ce message dans une alerte | **navigateur du Module** | Hôte de test : une écriture refusée avec `quota_exceeded`. |
| 168 c | ↳ l'Hôte refuse une valeur de plus de 1 Mo | **déjà couvert** | Hôte : `packages/host-core/test/protocol.test.ts:456` « a value larger than the Convention allows, once serialized ». |
| 176 | its User guide opens from the Launcher, with its screenshots | **contrat** | C3. |
| 190 a | copies a Code block to the clipboard from the sandboxed iframe : le bouton « copy » met le code dans le presse-papiers et devient « copied ✓ » | **navigateur du Module** | `src/lib/clipboard.ts` ; la page du Module reçoit `clipboard-read`/`clipboard-write`. |
| 190 b | ↳ un Module écrit dans le presse-papiers depuis son iframe `sandbox` sans `allow-same-origin` | **Hôte** | Les attributs `sandbox`/`allow` que l'Hôte donne à l'iframe (`packages/host/src/srcdoc.ts`) ; aucun test de l'Hôte ne le prouve. Les autres tests de presse-papiers des Modules n'en ont plus besoin. |

Ce que la suite navigateur du Survival Kit demandera à l'Hôte de test :

- **stockage** pré-rempli et lu par le test ; partagé par la Vue et le Widget ; gardé quand la page est rechargée ; une écriture refusée avec `quota_exceeded` ;
- **visibilité** : envoyer `visibility` (`false`, puis `true`) à la Vue ;
- **`openView` et paramètres** : enregistrer les appels du Widget ; démarrer la Vue avec `context.params` ; envoyer `navigation.params` à une Vue déjà chargée ;
- **contexte** : surface, `locale` `en-US`, un thème clair ;
- **fichiers et presse-papiers** : rien de plus que Playwright sur la page du Module (`setInputFiles`, `grantPermissions`).

## Watch Later

`packages/host/e2e/watch-later.test.ts`, 19 tests. Tests unitaires : `../tessello-watch-later/test/` (`videos.test.ts`, `youtube.test.ts`, `drop.test.ts`). Pas de test de `src/lib/storage.ts`.

| Ligne | Test, ou morceau | Destin | Justification |
|---|---|---|---|
| 101 a | a pasted URL shows the video with its title and channel, opens it on YouTube at its start, and is kept after a reload : installation, la Vue démarre, une vidéo se relit après un rechargement | **contrat** | C1, avec oEmbed et les miniatures simulés (`page.route`). |
| 101 b | ↳ `youtu.be/…?t=1m30s&si=share` sans `https://` donne la vidéo, son départ à 90 s et le lien `watch?v=…&t=90s` | **déjà couvert** | `test/youtube.test.ts:27` « ignores the other parameters, and the spaces around » ; `test/youtube.test.ts:33` « reads the start, from t or start, in seconds » ; `test/videos.test.ts:48` « a new video waits for its title: its URL stands in for it until oEmbed answers » (titre `…&t=90s`). |
| 101 c | ↳ « just now », titre et chaîne lus dans la réponse d'oEmbed | **déjà couvert** | `test/videos.test.ts:646` « when a video was added › in English » ; `test/videos.test.ts:125` « the title and channel from oEmbed › are read from its answer ». |
| 101 d | ↳ l'URL de la miniature (`i.ytimg.com/vi/<id>/mqdefault.jpg`) et celle d'oEmbed (`url=…watch?v=<id>`, `format=json`) | **unitaire** | `test/youtube.test.ts`, sur `thumbnailUrl` et `oembedUrl` de `src/lib/youtube.ts`. |
| 101 e | ↳ le champ est vidé, le titre est un lien vers YouTube dans un nouvel onglet, la miniature est chargée, titre et chaîne arrivent d'oEmbed | **navigateur du Module** | Hôte de test : réseau simulé (`www.youtube.com/oembed`, `i.ytimg.com`). |
| 101 f | ↳ la CSP laisse passer les origines déclarées | **déjà couvert** | Hôte : `permissions.test.ts:112` « a request or a remote resource reaches a declared origin, and never an undeclared one ». |
| 127 a | a URL pasted in the field or anywhere on the page is added at once, and the same video is never added twice : une ligne non vidéo ignorée, une vidéo déjà là pas ajoutée | **déjà couvert** | `test/videos.test.ts:78` « each line that is a YouTube video is added; the others are ignored… » ; `test/videos.test.ts:90` « a video already there, or twice in the same text, is added once ». |
| 127 b | ↳ un collage sur `body` ou dans le champ ajoute aussitôt, le champ reste vide, une seule carte | **navigateur du Module** | Événement `paste` dans la page du Module. |
| 151 a | a dropped link adds the video, a second drop of it adds nothing and shows it, and what is not a video is refused : lecture de `text/uri-list` et `text/plain`, comptes ajoutées / déjà là / ignorées | **déjà couvert** | `test/drop.test.ts:9` « a link dropped from a tab or a page is read from its URI list, without its comment lines » ; `test/drop.test.ts:16` « without a URI list, the plain text is read » ; `test/videos.test.ts:78` et `:90`. |
| 151 b | ↳ la zone « Drop to add » paraît au survol et part avec `dragleave` ou le dépôt ; les messages « already in your list », « not a YouTube video », « 1 added, 1 already there, 1 ignored » | **navigateur du Module** | Glisser-déposer et `role=status` dans `View.svelte`. |
| 202 a | a video whose title cannot be read is still added, with its URL as title, and Retry reads it : la vidéo ajoutée avec son URL pour titre, `metaStatus: "failed"` | **déjà couvert** | `test/videos.test.ts:48` ; `test/videos.test.ts:132` « an answer without a title cannot be read ». |
| 202 b | ↳ « Retry » lit le titre de nouveau une fois le réseau revenu, et disparaît | **navigateur du Module** | Hôte de test : réseau simulé hors ligne puis en ligne, compte des requêtes oEmbed. |
| 224 a | tells the User when a change cannot be saved, and keeps it on screen : le message d'un stockage plein, et d'une autre panne avec sa raison | **unitaire** | Nouveau `test/storage.test.ts`, sur `videoStorage` de `src/lib/storage.ts` (comme `test/storage.test.ts` du Survival Kit). |
| 224 b | ↳ l'alerte s'affiche et la vidéo reste à l'écran | **navigateur du Module** | Hôte de test : une écriture refusée avec `quota_exceeded`. |
| 224 c | ↳ l'Hôte refuse une valeur de plus de 1 Mo | **déjà couvert** | Hôte : `packages/host-core/test/protocol.test.ts:456` « a value larger than the Convention allows, once serialized ». |
| 235 a | a video marked as watched is hidden, shown again when the watched are not hidden, and its note survives a reload : vues masquées par défaut, note rognée et limitée à 2 000 | **déjà couvert** | `test/videos.test.ts:579` « the watched videos are hidden unless the User chose to show them » ; `test/videos.test.ts:223` « is kept without the spaces around it » ; `test/videos.test.ts:232` « a note longer than the limit is refused ». |
| 235 b | ↳ la carte disparaît une fois vue, « Undo » la ramène, décocher « Hide watched » la montre, la note est écrite en quittant le champ (`maxlength` 2000), l'icône « Has a note », le choix et la note relus après un rechargement | **navigateur du Module** | `store.svelte.ts`, `VideoCard`, `DetailsDialog`. |
| 290 a | marking watched requires a score, cancelling discards the draft, and the score and note persist and can be edited : note, score de 0 à 5, date gardée quand le score change, oubliés en revenant « à voir » | **déjà couvert** | `test/videos.test.ts:173` « marking watched saves the score, trimmed note and date together… » ; `:182` « zero and five are valid scores… » ; `:190` « invalid scores and overlong notes cannot partially mark a video watched » ; `:198` « a watched video can receive or change its score without changing its note or watched date ». |
| 290 b | ↳ Cancel, Échap et le fond ferment sans rien changer ; bouton désactivé sans score ; radios au clavier, 0 compris ; un clic sur l'étoile choisie en retire une ; les détails rouvrent le même dialogue prérempli ; « Mark as to watch » n'ouvre pas de dialogue | **navigateur du Module** | `WatchedDialog`, `ScoreInput`, `DetailsDialog`. |
| 376 | Undo restores the previous note as well as the watch state after reviewing from details | **navigateur du Module** | L'annulation est dans `markWatched` de `store.svelte.ts`. |
| 398 a | older watched videos without a score remain visible and can receive one : lues sans score, placées après les vidéos notées | **déjà couvert** | `test/videos.test.ts:207` « storage keeps scores 0 through 5 only on watched videos, and still reads older videos » ; `:302` « watched scores, including zero, come before unrated watched videos… » ; `:198`. |
| 398 b | ↳ pas d'icône de score, aucune radio cochée dans les détails, « Score: 2 out of 5 » une fois choisi | **navigateur du Module** | Hôte de test : stockage pré-rempli. |
| 423 a | a video is deleted only once the User confirms it : la vidéo seule est retirée | **déjà couvert** | `test/videos.test.ts:240` « removes it, and only it ». |
| 423 b | ↳ la confirmation, Cancel garde la vidéo, Delete la retire et ferme les détails, état vide | **navigateur du Module** | `ConfirmDialog`. |
| 446 a | two tags give two rows, a video with both is in each, and the videos without a tag are in the last row : tags rognés, casse d'origine, ordre alphabétique, rangée vide cachée, tags des nouvelles vidéos | **déjà couvert** | `test/videos.test.ts:249`, `:253`, `:262` (tags) ; `:276` « one row per tag in alphabetical order, then the videos without a tag… » ; `:294` « a row with no video is not shown » ; `:109` « each video added takes the tags, as they were first written ». |
| 446 b | ↳ le champ de tags (Entrée), « Tags for new videos », les régions par tag, « 2 videos », retirer ses tags renvoie la vidéo dans « No tag » | **navigateur du Module** | `TagInput`, `Row`. |
| 490 a | the tags of a group are rows of a section, which folds, and stays folded after a reload : groupes `Music / Jazz`, casse du groupe, rangées dans leur groupe | **déjà couvert** | `test/videos.test.ts:508`, `:516`, `:523` (groupes de tags) ; `:579` (lecture de `collapsed`). |
| 490 b | ↳ l'en-tête du groupe replie (`aria-expanded`) et cache ses rangées, le titre de la rangée est le nom dans le groupe, le repli est écrit et relu après un rechargement | **navigateur du Module** | `Group.svelte`. |
| 543 a | a card dragged in its row changes place, dragged to another row changes tag, and both are kept after a reload : ordre et tag | **déjà couvert** | `test/videos.test.ts:346` « in its row, before another video or at the end… » ; `:364` « to another row, it loses the tag of the row it leaves and takes the tag of the other… » ; `:145` « the most recently added first ». |
| 543 b | ↳ le vrai glisser (moitié gauche = avant), la carte déplacée n'est pas prise pour un lien déposé, ordre et tag relus après un rechargement | **navigateur du Module** | `moving.svelte.ts`, `VideoCard`. |
| 590 a | watched videos lead the row by score, then unwatched videos, and keep that order after a reload | **déjà couvert** | `test/videos.test.ts:302` ; `:325` « equal scores use the most recently watched first… ». C'est l'échec CI `watch-later.test.ts:590` : il disparaît avec ce test. |
| 590 b | ↳ changer le score dans les détails réordonne aussitôt ; « Hide watched » laisse l'ordre des vidéos à voir | **navigateur du Module** | Une étape d'un test de la suite du Module (avec 290 b). |
| 625 a | dragging among watched cards only places unwatched cards, while watched cards change tags at their score position | **déjà couvert** | `test/videos.test.ts:395` « a watched video dropped in its own row stays at its score position… » ; `:407` « a watched video changes tag and takes its score position… » ; `:423` « dropping an unwatched video among watched videos puts it first among unwatched ones… ». |
| 625 b | ↳ le repère de dépôt (`wl-drop-before`) se met sur la première carte à voir quand on survole une carte vue | **navigateur du Module** | Hôte de test : stockage pré-rempli. |
| 678 a | a section dragged by its header goes above or below another, in the View or in its group, and stays there after a reload | **déjà couvert** | `test/videos.test.ts:478`, `:486`, `:492` (moving a section). |
| 678 b | ↳ le glisser par l'en-tête (moitié haute/basse), la section déplacée n'est pas prise pour un lien déposé, `settings.sections` écrit et relu | **navigateur du Module** | `moving.svelte.ts`. |
| 732 a | a whole section is deleted at once, the videos it shares with other sections too, once the User confirms it | **déjà couvert** | `test/videos.test.ts:448` « a row holds the videos with its tag… those also elsewhere are counted » ; `:454` « a group holds the videos with any of its tags… » ; `:458` « they are deleted at once ». |
| 732 b | ↳ la confirmation dit que les vidéos sont aussi ailleurs ; Cancel ne supprime rien ; supprimer un groupe | **navigateur du Module** | `ConfirmDialog`. |
| 782 | a tag typed and left without Enter, or picked among the suggestions, is added too | **navigateur du Module** | `TagInput.svelte` : `blur`, et l'`input` d'une suggestion. |
| 809 a | the Widget shows a video added in the View until it is marked as watched, and opens the View : le Widget démarre, montre la vidéo ajoutée, et ouvre la Vue | **contrat** | C2. |
| 809 b | ↳ « 1 to watch », la plus récente, « Nothing left to watch » | **déjà couvert** | `test/videos.test.ts:561` « how many are left to watch, and the most recently added of them » ; `:573` « none when every video is watched ». |
| 809 c | ↳ le lien `&t=42s` dans un nouvel onglet, la miniature, le Widget L ne défile pas, « + Add » et « Open ↗ » appellent `openView`, le Widget relit les vidéos quand il est montré | **navigateur du Module** | Hôte de test : taille du Widget, `visibility`, enregistrement de `openView`. |
| 809 d | ↳ le Widget suit ce que la Vue écrit | **déjà couvert** | Hôte : `home.test.ts:132`. |

Ce que la suite navigateur de Watch Later demandera à l'Hôte de test :

- **réseau simulé** : oEmbed (`https://www.youtube.com/oembed`) et les miniatures (`https://i.ytimg.com`) ; un mode hors ligne qui se rétablit ; le compte des requêtes ;
- **stockage** pré-rempli (`videos`, `settings`) et lu par le test ; gardé quand la page est rechargée ; une écriture refusée avec `quota_exceeded` ;
- **visibilité** : `visibility` au Widget ;
- **`openView`** : enregistrer les appels du Widget, et leurs paramètres ;
- **taille** : le Widget à sa taille déclarée (`L`), pour vérifier qu'il ne défile pas ;
- **contexte** : `locale` `en-US` (« just now »), un thème ;
- **presse-papiers et glisser** : des événements `paste` et `drag*` synthétiques dans la page du Module, sans aide de l'Hôte de test.

## Skills Library

`packages/host/e2e/skills-library.test.ts`, 54 tests. Tests unitaires : `../tessello-skills-library/test/` (11 fichiers). Sans tests : `src/view/change-tag.ts`, `src/view/github-failure.ts`, `src/view/cover.ts` (canvas), `src/lib/store.svelte.ts`.

| Ligne | Test, ou morceau | Destin | Justification |
|---|---|---|---|
| 169 a | a set added by hand is listed with its defaults, links to its URL, and is kept after a reload : installation, la Vue démarre, un set se relit après un rechargement | **contrat** | C1. |
| 169 b | ↳ les valeurs d'un nouveau set (`watch`, sans notes, sans skill, non archivé) ; le lien est son URL | **déjà couvert** | `test/skills.test.ts:50` « a new set is to watch, with no notes, no skill and no topic of its own » ; `test/skills.test.ts:140` « is its url when it is an http or https one ». |
| 169 c | ↳ la rangée montre « Watch », « 0 skills », « No skill — not on the radar » ; le lien s'ouvre dans un nouvel onglet avec `rel=noopener` | **navigateur du Module** | `View.svelte`. |
| 200 | a set without a URL has no link, and the newest set comes first | **déjà couvert** | `test/skills.test.ts:89` « the new set comes first, and the others are untouched » ; `:98` « the most recently added first… » ; `:145` « is none for another kind of url, or for no url ». Le rendu du lien est prouvé par 169 c. |
| 219 a | a name is required to add a set : un nom vide n'ajoute rien | **déjà couvert** | `test/skills.test.ts:85` « a blank name adds nothing ». |
| 219 b | ↳ « Add » est désactivé sans nom | **navigateur du Module** | |
| 228 a | the View has three tabs, and the one left open is reopened after a reload : l'onglet relu des réglages | **déjà couvert** | `test/skills.test.ts:163` « the tab and the filters are kept ». |
| 228 b | ↳ les trois onglets, l'onglet choisi écrit dans `settings` et rouvert après un rechargement, les états vides des onglets Radar et Editions | **navigateur du Module** | |
| 252 a | the Widget counts the sets per ring, counts the changes waiting, and opens the View : le Widget démarre, compte les sets écrits par la Vue, ouvre la Vue | **contrat** | C2. |
| 252 b | ↳ sets par anneau, changements en attente, date de la dernière édition | **déjà couvert** | `test/widget.test.ts:41` « counts the sets not archived of each ring, zeros included » ; `:62` « is the date of the edition with the highest number… » ; `:69`, `:73`, `:78` (the changes that wait). |
| 252 c | ↳ le Widget ne défile pas, relit les sets quand il est montré, « Open » appelle `openView` | **navigateur du Module** | Hôte de test : `visibility`, enregistrement de `openView`, taille du Widget. |
| 310 a | the URL of a skill folder, entered, imports a set of one skill, named after the skill, with the description read from its SKILL.md : lecture de l'URL, un seul `SKILL.md` lu, description repliée, set importé à voir et non évalué | **déjà couvert** | `test/github.test.ts:17` « every form of the file or the folder… » ; `:239` « a folder that is itself a skill is a single skill, and its subfolders are not looked at » ; `:107` « a folded block joins its lines with spaces… » ; `test/skills.test.ts:738` « adds a set to watch, with the skills in their order, not evaluated, with the template as notes ». |
| 310 b | ↳ « 1 skill (not evaluated) » | **unitaire** | Nouveau `test/change-tag.test.ts`, sur `skillCountLabel` de `src/view/change-tag.ts`. |
| 310 c | ↳ l'aperçu porte le nom du skill, rien n'est ajouté avant « Import », le champ est vidé | **navigateur du Module** | Hôte de test : réseau simulé GitHub. |
| 339 a | a pasted URL opens the preview at once : l'URL `blob/…/SKILL.md` sans `https://` donne la source `tree/…` | **déjà couvert** | `test/github.test.ts:17`. |
| 339 b | ↳ un collage ouvre l'aperçu sans Entrée | **navigateur du Module** | Événement `paste`. |
| 352 a | the same set entered again adds nothing, reads nothing, and says it is there : même clé quelle que soit la casse du propriétaire, set doublon | **déjà couvert** | `test/github.test.ts:156` « the file, the folder and the raw URL of a set share one key, whatever the case of the owner and the repo » ; `test/skills.test.ts:654` « the duplicate is the set with the same key, archived or not ». |
| 352 b | ↳ « Already in your Library. », pas d'aperçu, aucune requête | **navigateur du Module** | Le doublon est cherché avant de lire GitHub, dans `View.svelte`/`store.svelte.ts`. |
| 371 a | a URL that cannot be found says so, and Continue manually opens the dialog with the URL : un `SKILL.md` absent est `not_found` | **déjà couvert** | `test/github.test.ts:258` « the URL of a SKILL.md that is not there is not found… ». |
| 371 b | ↳ le message de `not_found` | **unitaire** | Nouveau `test/github-failure.test.ts`, sur `failureMessage` de `src/view/github-failure.ts`. |
| 371 c | ↳ « Continue manually » ouvre « New set » avec l'URL, qui est enregistrée | **navigateur du Module** | |
| 390 a | a URL that is not a skill on GitHub says so, and Continue manually keeps what was typed : l'URL est refusée | **déjà couvert** | `test/github.test.ts:80` « rejects what is not a skill on GitHub ». |
| 390 b | ↳ le message, « Continue manually » garde le texte, aucune requête | **navigateur du Module** | |
| 403 a | a network failure says so, and the message goes at the next input : sans réponse, c'est le réseau | **déjà couvert** | `test/github.test.ts:210` « any other failure, or no answer at all, is the network » ; `:329`. |
| 403 b | ↳ le message de `network` | **unitaire** | `test/github-failure.test.ts` (avec 371 b). |
| 403 c | ↳ le message part à la saisie suivante | **navigateur du Module** | Hôte de test : réseau hors ligne. |
| 417 a | a set of four skills and a folder with no SKILL.md is previewed… : le dossier sans `SKILL.md` est écarté ; sans nom ou sans skill, rien n'est importé | **déjà couvert** | `test/github.test.ts:265` « a folder of skill folders is a set… folders with no SKILL.md are ignored » ; `test/skills.test.ts:761` « a blank name or no skill imports nothing ». |
| 417 b | ↳ « 3 skills (3 not evaluated) » | **unitaire** | `test/change-tag.test.ts` (avec 310 b). |
| 417 c | ↳ l'aperçu : 4 cases cochées, « Import » désactivé sans skill ou sans nom, renommer, décocher | **navigateur du Module** | |
| 450 a | a set is imported into a topic, one skill moves to another, the radar draws two points of the same number, and the Library finds the set by the second topic | **déjà couvert** | `test/skills.test.ts:958` « an imported set gives its topic to every skill » ; `:989` « a topic from 0 to 4 is saved, and it dates the set » ; `:888` « a set covers the topics of its skills… » ; `test/radar.test.ts:207` « has one point per topic, with the same number and the same marker » ; `test/skills.test.ts:332` « a set with skills in several topics is kept by any of them… ». |
| 450 b | ↳ le choix du thème dans l'aperçu (5, le premier par défaut), « Code & tests, Writing & docs » dans la rangée, deux points `data-topic` dans le radar de la Vue, une ligne de légende, les puces de filtre | **navigateur du Module** | |
| 490 | a stored set with an old quadrant is converted: its skills get that topic, and the file loses the quadrant | **déjà couvert** | `test/storage.test.ts:145` « a set that still has a quadrant gives it to its skills, and the converted list is written » ; `test/skills.test.ts:915`, `:921`. |
| 523 a | the four skills of a set can all be imported, and Cancel adds nothing : les quatre importés | **déjà couvert** | `test/skills.test.ts:738`. |
| 523 b | ↳ « Cancel » ferme l'aperçu sans rien ajouter | **navigateur du Module** | |
| 540 a | a folder with no skill directly under it says so, and Continue manually opens the dialog with the URL : la découverte est vide | **déjà couvert** | `test/github.test.ts:290` « a repo root with no skill directly in it and no skill folder is empty ». |
| 540 b | ↳ le message, pas d'aperçu, « Continue manually » avec l'URL | **navigateur du Module** | Le message d'une découverte vide est dans la Vue, pas dans `failureMessage`. |
| 553 a | the same URL of a set entered twice opens the preview once; the second time the existing set is shown | **déjà couvert** | `test/skills.test.ts:766` « a set, archived or not, from the same url is the duplicate and nothing is added ». |
| 553 b | ↳ pas d'aperçu, aucune requête de plus | **navigateur du Module** | Même test de la suite du Module que 352 b. |
| 571 a | the rate limit of the API says so, and Continue manually is offered : 403 et 429 sont la limite | **déjà couvert** | `test/github.test.ts:316` « the API answering 404 is not found; 403 and 429 are rate limited… ». |
| 571 b | ↳ le message de `rate_limited` | **unitaire** | `test/github-failure.test.ts`. |
| 571 c | ↳ « Continue manually » proposé, pas d'aperçu | **navigateur du Module** | |
| 582 a | a set added by hand with a URL that is there already adds nothing : l'URL brute d'un autre propriétaire en casse différente est la même | **déjà couvert** | `test/skills.test.ts:679` « a url that is there already, archived or not, adds nothing and gives the set that has it » ; `test/github.test.ts:156`. |
| 582 b | ↳ « Already in your Library. » | **navigateur du Module** | |
| 599 a | refreshing a set from GitHub adds the new skills, marks the ones gone, and says what it did | **déjà couvert** | `test/skills.test.ts:797`, `:816`, `:826`, `:855`, `:864` (refreshing a set) ; `test/changes.test.ts:230` « a skill added makes the set updated… ». |
| 599 b | ↳ pas de bouton sans URL GitHub, « 1 skill added, 1 removed upstream », « Removed upstream », « Already up to date », la marque part quand le skill revient | **navigateur du Module** | Hôte de test : réseau simulé dont les réponses changent pendant le test. |
| 638 a | a refresh that cannot read GitHub says so and changes nothing : 403 | **déjà couvert** | `test/github.test.ts:316`. |
| 638 b | ↳ le message dans le panneau, rien de changé | **navigateur du Module** | |
| 655 | a refresh that finds no skill any more says so and marks none removed upstream | **navigateur du Module** | `refreshSet` de `store.svelte.ts` s'arrête sur une découverte vide ; `refreshSet` de `src/lib/skills.ts` marquerait tout (`test/skills.test.ts:874` « nothing found marks every skill that has a url ») : la règle n'est que dans le store. |
| 692 a | a click on a set opens its panel, where each change is saved at once; Escape closes it : la modification datée | **déjà couvert** | `test/skills.test.ts:198` « a changed value is saved, with the date of the change… ». |
| 692 b | ↳ le panneau ouvert après l'ajout, Échap le ferme, un clic sur la rangée le rouvre, chaque champ est écrit aussitôt, la liste suit derrière | **navigateur du Module** | |
| 725 a | the score of a skill is set with the keyboard, and cleared : `null` efface le score | **déjà couvert** | `test/skills.test.ts:549` « a score outside 1 to 5 is ignored and null clears it ». |
| 725 b | ↳ les flèches du clavier, « Clear », « 1 skill (not evaluated) » | **navigateur du Module** | |
| 746 a | a blank name, notes over 8,000 characters and the URL of another set are refused with a message | **déjà couvert** | `test/skills.test.ts:235` « a blank name is refused and nothing is saved » ; `:240` « notes longer than the View accepts are refused… » ; `:695` « a url that another set has, archived or not, saves nothing… ». |
| 746 b | ↳ les trois messages, le texte tapé gardé, l'URL refusée non écrite | **navigateur du Module** | |
| 780 a | the topics are renamed, the Library is filtered and searched, and all of it is kept after a reload : renommage, filtres, recherche sans casse ni accents, par nom de skill | **déjà couvert** | `test/skills.test.ts:392`, `:398` (renaming a topic) ; `:317`, `:323`, `:345`, `:354` (filtering) ; `:631` « the search finds a set by the name of one of its skills… » ; `:163`. |
| 780 b | ↳ le dialogue « Rename topics », les puces `aria-pressed`, « Clear filters », réglages écrits et relus après un rechargement, le panneau rouvert garde anneau, score, thème et notes | **navigateur du Module** | |
| 851 a | the fifth topic is renamed, a set is put in it, and its point is in the fifth sector of the radar, under its name | **déjà couvert** | `test/skills.test.ts:403` « the fifth topic can be renamed » ; `test/radar.test.ts:147` « with N topics, every dot is inside its sector and its ring… » ; `:400` « the fifth topic has a colour of its own… » ; `:333`. |
| 851 b | ↳ le radar de la Vue place le point à l'angle du 5ᵉ secteur, sous son nom | **navigateur du Module** | Un test de la suite du Module vérifie que `RadarDrawing` dessine aux positions de `radar.ts` (avec 1046 b). |
| 879 | a Library with the settings of four quadrants opens with five topics, the filters kept at the same index | **déjà couvert** | `test/skills.test.ts:178` « the four quadrants of an older Library keep their index and the fifth topic takes its default » ; `:187` « the old filters on quadrants become filters on the topics at the same index ». |
| 907 | a set added while the filters hide it clears them, so that its row is shown | **navigateur du Module** | Logique de `View.svelte`. |
| 922 a | an archived set leaves the Library, shows greyed with the switch, and comes back when unarchived | **déjà couvert** | `test/skills.test.ts:256` « a set is archived and unarchived… » ; `:311` « the archived sets are kept too when asked… » ; `:273`. |
| 922 b | ↳ « Archive »/« Unarchive », `sl-archived`, « Archived », « Show archived » écrit et relu après un rechargement | **navigateur du Module** | |
| 961 | when every set is archived, the Library does not say that it is empty | **navigateur du Module** | État vide de `View.svelte`. |
| 971 a | a set is deleted only after the User confirms it : supprimé de la liste | **déjà couvert** | `test/skills.test.ts:365`, `:375` (deleting a set). |
| 971 b | ↳ Échap ferme la confirmation seule, Cancel garde, Delete supprime, état vide | **navigateur du Module** | |
| 996 a | a URL already in the Library as an archived set shows that set, switching the archived on | **déjà couvert** | `test/skills.test.ts:679` (archived or not). |
| 996 b | ↳ « Show archived » coché, la rangée `sl-highlighted` | **navigateur du Module** | |
| 1046 a | the radar draws a point per set, numbers them in a legend, lists them as new, and drops an archived set : numérotation, changements « new », compte en attente | **déjà couvert** | `test/radar.test.ts:70` « by topic, then by ring from the centre, then by name, each from 1 » ; `test/changes.test.ts:38` « every skill that is not archived is new… » ; `:206` « new, back, moved and retired ones count… ». |
| 1046 b | ↳ « New » | **unitaire** | `test/change-tag.test.ts`, sur `changeTag`. |
| 1046 c | ↳ les points du radar de la Vue, la légende « 1. Alpha — Recommended », « 3 changes waiting », la liste « Changes waiting », un set archivé quitte le radar | **navigateur du Module** | |
| 1074 | changing the ring of a set moves its point to the band of the new ring | **déjà couvert** | `test/radar.test.ts:147` (dans son anneau). Le dessin de la Vue est prouvé par 851 b et 1046 c. |
| 1091 | a click on a point, or on a line of the legend, opens the set in the Library | **navigateur du Module** | |
| 1110 | the radar fits a 360 px wide screen, without a horizontal scroll | **navigateur du Module** | Mise en page. |
| 1146 a | hovering a point shows its set, its ring, its topic and its skills with their stars; leaving closes it : les étoiles | **déjà couvert** | `test/radar.test.ts:472` « stars are filled then empty, rounded and kept between 0 and 5 ». |
| 1146 b | ↳ le survol ouvre le panneau, son contenu, le départ du pointeur le ferme | **navigateur du Module** | Survol. C'est l'échec CI `skills-library.test.ts:1146`. |
| 1170 | the pointer can go from a point into its panel and click the name, which opens the set in the Library | **navigateur du Module** | |
| 1183 a | the two points of a set in two topics each open their own panel… : chaque point ne liste que les skills de son thème, dans l'ordre des thèmes | **déjà couvert** | `test/radar.test.ts:236` « each point lists only the skills of its topic… » ; `:242` « the points come in the order of the numbers, then of the topics ». |
| 1183 b | ↳ survol puis clavier d'un point à l'autre, le panneau suit | **navigateur du Module** | |
| 1226 a | the points are walked with Tab in the order of their numbers… : l'ordre des numéros | **déjà couvert** | `test/radar.test.ts:70`. |
| 1226 b | ↳ Tab suit les numéros, le focus ouvre le panneau, Échap le ferme, Entrée le rouvre | **navigateur du Module** | |
| 1253 | a tap on a point opens its panel instead of the set, and a tap elsewhere closes it | **navigateur du Module** | `pointerType: "touch"`. |
| 1270 a | the panel stays inside a 360 px wide screen, for every point : la position bornée | **déjà couvert** | `test/panel-position.test.ts:18` « stays inside the bounds on the left and on the right ». |
| 1270 b | ↳ le panneau de chaque point reste dans 360 px | **navigateur du Module** | Mise en page. |
| 1309 a | an edition is published with its introduction; a moved set must be explained before the next one; the editions are listed after a reload : intro requise, déplacement sans raison refusé, numéros, comptes par anneau | **déjà couvert** | `test/editions.test.ts:96` « a blank intro is refused » ; `:189` « a moved skill with no reason stops the publication, naming the skills » ; `:151` « the number follows the highest one » ; `:217` « counts the entries per ring, every ring present ». |
| 1309 b | ↳ « Moved: Try → Recommended », « Retired (was Watch) » | **unitaire** | `test/change-tag.test.ts`, sur `changeTag` et `ringName`. |
| 1309 c | ↳ « Next » désactivé, le dialogue refusé mène au panneau du set, « Why did it move? », « No change waiting », l'onglet Editions après un rechargement | **navigateur du Module** | |
| 1375 a | the .zip of an edition holds its post for the blog and its cover, for any edition : chemins et nom du `.zip`, front matter, sections du billet | **déjà couvert** | `test/post-zip.test.ts:6`, `:14` ; `test/post.test.ts:47` « is read back by gray-matter with the title, the images, the date and the author » ; `:239` « tells where a moved skill comes from and why… » ; `:292` « lists the retired sets with the ring they left… ». |
| 1375 b | ↳ le bouton remet un fichier `skills-radar-edition-<n>.zip` ; sa couverture est un PNG 1200 × 630 | **navigateur du Module** | `src/view/cover.ts` dessine sur un canvas ; téléchargement depuis la page du Module. |
| 1423 | the Editions tab says so when nothing is published | **navigateur du Module** | Avec 228 b. |
| 1430 a | a published set offers Archive only; the explanation of a move is asked only while the ring differs from the published one | **déjà couvert** | `test/skills.test.ts:370` « a set that is in an edition cannot » ; `:418` « a reason is kept while the ring differs from the published one » ; `:428` « returning to the published ring clears the reason ». |
| 1430 b | ↳ pas de « Delete » une fois publié, le champ paraît et disparaît, vidé | **navigateur du Module** | |
| 1454 a | the explanation of a move is limited to 280 characters | **déjà couvert** | `test/skills.test.ts:447` « a reason that is too long is refused and nothing is saved ». |
| 1454 b | ↳ `maxlength=280`, pas d'alerte | **navigateur du Module** | |
| 1469 | an edition is stored under its own key, then the index of the editions | **déjà couvert** | `test/storage.test.ts:44` « an edition written is read back » ; `:62` « the edition is written before the index ». |
| 1490 | the publish dialog fits a 360 px wide screen | **navigateur du Module** | Mise en page. |
| 1509 | a storage in the old model is migrated into sets of one skill, with no change waiting, and the old edition still downloads | **déjà couvert** | `test/storage.test.ts:105` « with no sets, the old skills are migrated… and sets is written » ; `:115` « the old skills are never written nor deleted » ; `test/migration.test.ts:53`, `:59`, `:76` ; `test/editions.test.ts:270` « an edition in the old form is converted… » ; `:290` « a migrated Library compared to the converted old edition shows every set unchanged » ; `test/post.test.ts:203` « gives a set of an edition kept in the old form a table row… ». Le téléchargement est prouvé par 1375 b. |
| 1580 a | a set made by hand takes two skills, one of them scored; published, it is updated when a skill is removed | **déjà couvert** | `test/skills.test.ts:465` « a new skill goes at the end of the set, not evaluated, with the template as its notes… » ; `:497` « a url that another skill of the set has is refused… » ; `:587` « is allowed even when the set was published… » ; `test/changes.test.ts:148` « a skill removed from the set makes it updated… » ; `:206`. |
| 1580 b | ↳ « New », « Updated » | **unitaire** | `test/change-tag.test.ts`. |
| 1580 c | ↳ le message du dialogue « Add a skill », la confirmation « Remove from set », « No change waiting » | **navigateur du Module** | |
| 1631 | a set that moved is explained before the next edition, which counts the sets per ring | **déjà couvert** | `test/editions.test.ts:189`, `:204` « the reasons are cleared from all the skills… and the summary counts the sets per ring ». Le parcours dans la Vue est celui de 1309 c. |
| 1655 | the post of a set of three skills has their table, the cards of the skills with notes, and the tooltip of its dot | **déjà couvert** | `test/post.test.ts:131` « puts the skills of a set in a table… » ; `:159` « gives each skill with notes its own part under the table… » ; `:167` « leaves out the notes of a skill that are empty or reduced to the template » ; `:98` « lists the skills of each set in the title of the radar… » ; `test/radar.test.ts:453` « names the set with its number and its ring, then a line per skill with its stars… ». |

Ce que la suite navigateur de Skills Library demandera à l'Hôte de test :

- **réseau simulé** : `https://raw.githubusercontent.com` et `https://api.github.com`, réponses par URL (texte, JSON, statut 403/404), hors ligne, réponses modifiables pendant un test, liste des requêtes reçues ;
- **stockage** pré-rempli (`sets`, `settings`, `skills`, `editions`, `edition:<n>`) et lu par le test ; gardé quand la page est rechargée ;
- **visibilité** et **`openView`** : pour le Widget ;
- **taille** : le Widget à sa taille déclarée ; la Vue à 360 px de large ;
- **contexte** : `locale` `en-US`, un thème ;
- **fichiers** : le téléchargement du `.zip` depuis la page du Module, sans aide de l'Hôte de test.

## Diagram

`packages/host/e2e/diagram.test.ts`, 45 tests. Tests unitaires : `../tessello-diagram/test/` (14 fichiers). Sans tests : `src/lib/storage.ts`, `src/lib/encoding.ts` (canvas), `src/view/png.ts` (canvas), `src/lib/store.svelte.ts`.

| Ligne | Test, ou morceau | Destin | Justification |
|---|---|---|---|
| 352 a | a visible connection handle stays reachable over a nearby shape, while ordinary hover finds the frontmost shape : écart constant des poignées | **déjà couvert** | `test/geometry.test.ts:36` « connection handles follow the rotated box with a constant 14 screen pixel gap at every zoom ». |
| 352 b | ↳ la poignée garde le survol au-dessus de la forme voisine, la flèche tirée part du port E | **navigateur du Module** | Survol dans `Canvas.svelte`. |
| 379 a | pulls a connection from a hovered shape while keeping Select, persists it and undoes it as one change : attache aux ports, une étape d'historique | **déjà couvert** | `test/arrows.test.ts:15` « is attached to a port when released on it, or within its reach » ; `test/history.test.ts:46` « undoes a change, then redoes it ». |
| 379 b | ↳ les poignées au survol et après l'écart, tirer garde l'outil Select, la flèche est sélectionnée, Ctrl+Z / Ctrl+Maj+Z, relue après un rechargement | **navigateur du Module** | |
| 419 a | connection handles cover all four sides, use current defaults and stay the same screen size after zoom and pan | **déjà couvert** | `test/geometry.test.ts:7` « directional connections use the cardinal ports of every built-in shape and image » ; `:36` ; `test/defaults.test.ts:67` « a new arrow takes the style of the defaults… ». |
| 419 b | ↳ le dialogue des défauts, des poignées de 18 px à 10 % et 400 % (molette + Ctrl), le déplacement au bouton du milieu, le nord tourné à droite | **navigateur du Module** | |
| 479 | abandoned connection gestures change neither selection nor storage, and the next pull still works | **navigateur du Module** | Gestes : clic, petit mouvement, retour, Échap, `pointercancel`. |
| 509 a | pulls from real custom anchors on a rotated resized shape, then falls back when anchors or the definition disappear : ancres d'une forme personnalisée, port disparu | **déjà couvert** | `test/geometry.test.ts:15` « custom connections choose existing anchors by normalized distance… » ; `:181` « follow its rotation and its size together » ; `test/arrows.test.ts:64`, `:70`, `:75` « on a port its shape no longer has, is automatic… ». |
| 509 b | ↳ l'aperçu part de l'ancre, la flèche tirée garde `outlet`, puis `null` sans ancre ou sans définition, relue après un rechargement | **navigateur du Module** | Hôte de test : stockage pré-rempli (`shapes`). |
| 566 | connection discovery respects tools, text editing, locks, groups and panning priority | **navigateur du Module** | |
| 599 | every built-in shape and image can pull to an automatic target, while locked targets stay free and distinct self ports form loops | **déjà couvert** | `test/geometry.test.ts:7` ; `test/arrows.test.ts:21` « is automatic when released elsewhere on the shape » ; `:52` « is free on a locked shape… » ; `:412` « is drawable between two shapes, two ports of one shape, or anything free » ; `:418` ; `:405` « with Shift, turns by steps of 45° around its start… ». Le geste de tirer est prouvé par 379 b. |
| 644 a | keeps two rectangles connected by an arrow after a reload, and the arrow follows a moved rectangle : installation, la Vue démarre, un diagramme et ses formes se relisent après un rechargement | **contrat** | C1. |
| 644 b | ↳ la flèche s'arrête au contour, et suit le rectangle déplacé | **déjà couvert** | `test/arrows.test.ts:98` « a single straight arrow goes from outline to outline, between the centers » ; `:157` « follows a shape that moved » ; `test/geometry.test.ts:47`, `:55`. |
| 644 c | ↳ l'outil Flèche tire entre deux formes, Select déplace une forme | **navigateur du Module** | |
| 677 a | draws each built-in shape, resizes it with Shift, turns it, styles it and writes its text… : tailles, proportions, angle | **déjà couvert** | `test/geometry.test.ts:242`, `:253` « keeping the proportions, the larger change wins » ; `:271` « is in whole degrees, from 0 to 359 » ; `test/defaults.test.ts:58`. |
| 677 b | ↳ chaque outil au double-clic, poignées de taille et de rotation (forme et texte), couleur, Ctrl+A, Ctrl+clic, taille de police pour toute la sélection, « Edit text », relu après un rechargement | **navigateur du Module** | |
| 746 a | an attached arrow follows the real outline of a shape that is resized or turned | **déjà couvert** | `test/geometry.test.ts:77` « an ellipse is left on its curve, not on its box » ; `:86` ; `:110` ; `:249` « in the fixed center mode, the center stays… ». |
| 746 b | ↳ le bouton « Resize: fixed corner » passe au mode centre fixe | **navigateur du Module** | |
| 775 a | three arrows A→B, A→B and B→A are all visible with their labels, and each is selected by a click on its own line | **déjà couvert** | `test/arrows.test.ts:116` « three straight arrows A→B, A→B and B→A are three distinct parallel lines » ; `:318` « is the nearest one within the reach » ; `:426`. |
| 775 b | ↳ les trois étiquettes ne se chevauchent pas à l'écran | **navigateur du Module** | Taille du texte rendu. |
| 799 a | a curved arrow between the north ports of two shapes is selected by a click anywhere on its visible line | **déjà couvert** | `test/arrows.test.ts:297` « on a curve, is the distance to the curve as drawn, near its start, its middle and its end » ; `:129` ; `:15`. |
| 799 b | ↳ le bouton « Curved » du panneau de la flèche | **navigateur du Module** | Avec 866 b. |
| 825 a | an elbow made by a drag is found after a reload, keeps its waypoints when its shape moves… | **déjà couvert** | `test/arrows.test.ts:189` « an elbow arrow leaves each shape perpendicular to its side, and turns halfway » ; `:277` « moves sideways, its corners becoming the waypoints of the arrow » ; `:245` « keeps its waypoints where they are when a shape moves… » ; `:292`. |
| 825 b | ↳ « Elbow », glisser le segment du milieu, relu après un rechargement, clic sur le dernier segment | **navigateur du Module** | |
| 866 a | a dashed arrow with heads at both ends, 3 wide, with its label dragged along it and aside, is found after a reload | **déjà couvert** | `test/arrows.test.ts:373` « at both ends: the line stops at both bases » ; `:458` « dragged to a point, takes the part of the length of the nearest point of the path… » ; `test/diagram.test.ts:156`. |
| 866 b | ↳ boutons du panneau, double-clic sur la ligne et sur l'étiquette, glisser l'étiquette, « Reset label », poignée de largeur, `stroke-dasharray` « 12 9 », relu après un rechargement | **navigateur du Module** | |
| 928 a | a drag on the empty canvas draws a free arrow, which moves by its body and is taken by a selection rectangle | **déjà couvert** | `test/arrows.test.ts:25` « is free when released on the empty canvas » ; `:405` ; `:393` « is within when all of it is, curve included ». |
| 928 b | ↳ tracer, un clic sans glisser ne trace rien, déplacer par le corps, rectangle de sélection | **navigateur du Module** | |
| 956 a | an end attached to the north-east port follows the shape turned by 90°, until its ends are detached | **déjà couvert** | `test/geometry.test.ts:130` « on a rectangle, they are its corners and the middles of its sides » ; `:150` « follow the rotation of the shape » ; `test/diagram.test.ts:224` « makes the ends attached to a port automatic… ». |
| 956 b | ↳ les ports montrés pendant le tracé, « Detach ends » | **navigateur du Module** | |
| 980 a | deleting a shape frees the ends of its arrows, where they were; Ctrl+Delete deletes its arrows too | **déjà couvert** | `test/diagram.test.ts:182` « frees the ends of the arrows attached to it, where they were drawn… » ; `:205` « with its arrows, also removes every arrow attached to it… ». |
| 980 b | ↳ les touches Suppr et Ctrl+Suppr | **navigateur du Module** | |
| 1002 a | a group is selected by a click on a member, moves as one block, and Alt+click selects a member alone | **déjà couvert** | `test/diagram.test.ts:240`, `:255` « a selection takes in every member of the groups it touches », `:262` ; `test/placement.test.ts:6` « a point goes to the nearest crossing of the grid, every 20 units ». |
| 1002 b | ↳ « Group selection », clic sur un membre, contour du groupe, glisser le bloc, Alt+clic, « Ungroup » | **navigateur du Module** | |
| 1032 | a locked shape is selected with a padlock, but neither moved, deleted nor taken by Ctrl+A, until it is unlocked | **navigateur du Module** | Règles dans le store et le canvas. |
| 1061 a | copies a group joined by an arrow and pastes it twice, 40 further each time, as new groups | **déjà couvert** | `test/clipboard.test.ts:25` « takes the selected shapes and the arrows whose two ends are in it » ; `:45` « adds new shapes, moved by the offset, and arrows joining the new shapes » ; `:60`, `:69` « each paste makes another new group ». |
| 1061 b | ↳ Ctrl+C / Ctrl+V, le décalage qui s'ajoute à chaque collage, la dernière copie sélectionnée | **navigateur du Module** | Le décalage cumulé est dans le store. |
| 1091 a | copies the style of a shape onto another, with its size when asked | **déjà couvert** | `test/clipboard.test.ts:95` « a shape gives its color, opacity, text size and alignment, and its size when asked » ; `:117`. |
| 1091 b | ↳ « Copy style »/« Paste style », la case « with size », Ctrl+Alt+C / Ctrl+Alt+V restent au canvas | **navigateur du Module** | |
| 1119 a | the grid and the guides are saved with the diagram, and the zoom fits the drawing : un petit dessin à sa taille réelle | **déjà couvert** | `test/placement.test.ts:59` « small content is shown at its real size, centered ». |
| 1119 b | ↳ G et « Guides » écrits dans le diagramme, zoom 125 % et 80 %, « Fit » | **navigateur du Module** | |
| 1143 a | undoes a move, a waypoint and a rename one by one, redoes them all, and finds them after a reload : pile d'annulation, diagramme relu inchangé | **déjà couvert** | `test/history.test.ts:46`, `:58`, `:87` « restores the whole diagram… the title, the grid and the guides » ; `:110` « goes on with a diagram read again as it is, but not with one changed meanwhile ». C'est l'échec CI `diagram.test.ts:1143`. |
| 1143 b | ↳ l'historique repart à l'ouverture, Ctrl+Z ×3 puis rien, Ctrl+Maj+Z ×3, la Vue cachée puis montrée garde son historique, relu après un rechargement | **navigateur du Module** | Hôte de test : `visibility`. |
| 1143 c | ↳ l'Hôte dit aux Modules qu'ils sont cachés puis visibles quand la page est cachée puis montrée | **Hôte** | `visibilitychange` dans `packages/host/src/main.ts:335` ; `home.test.ts:216` ne prouve que le passage Vue/Accueil. |
| 1206 | Ctrl+Z in the title field undoes the typing, not the diagram | **navigateur du Module** | |
| 1219 | deletes a diagram after a confirmation, then opens the first remaining one, or shows the empty state | **navigateur du Module** | |
| 1242 | an empty title becomes Untitled | **navigateur du Module** | Le titre « Untitled » est donné par la Vue (`src/lib/diagram.ts:141`). |
| 1253 a | tells the User when a change cannot be saved, and keeps it on screen : le message, et l'ordre d'écriture diagramme puis liste | **unitaire** | Nouveau `test/storage.test.ts`, sur `diagramStorage` de `src/lib/storage.ts` (`write`, `withSaveMessage`). |
| 1253 b | ↳ l'alerte, « Save failed », la forme reste à l'écran | **navigateur du Module** | Hôte de test : une écriture refusée avec `quota_exceeded`. |
| 1253 c | ↳ l'Hôte refuse une valeur de plus de 1 Mo | **déjà couvert** | Hôte : `packages/host-core/test/protocol.test.ts:456` « a value larger than the Convention allows, once serialized ». |
| 1268 a | inserts a chosen image with its caption as a group, finds it after a reload, and removes it from the storage once deleted for good : légende, groupe, images inutilisées, jauge | **déjà couvert** | `test/images.test.ts:50` « is captioned by the name of its file without the extension, or 'image' when pasted » ; `:57` « is placed at a point with its caption below it, as one group in front » ; `:11` « an image is unused when no diagram, custom shape or kept text refers to it » ; `test/usage.test.ts:12`, `:35`. |
| 1268 b | ↳ une image déjà stockée n'est pas écrite de nouveau | **unitaire** | `test/storage.test.ts`, sur `writeImage` de `diagramStorage`. |
| 1268 c | ↳ l'outil Image et le sélecteur de fichiers, l'encodage WebP et la clé SHA-256, la jauge qui monte, l'image retirée du stockage au rechargement suivant | **navigateur du Module** | `src/lib/encoding.ts` (canvas, `crypto.subtle`). |
| 1326 | stores a picture with transparency in PNG, and an SVG as it is | **navigateur du Module** | `src/lib/encoding.ts` (canvas). |
| 1357 a | deleting the diagram that shows an image removes the image from the storage : l'image n'est plus utilisée | **déjà couvert** | `test/images.test.ts:11`. |
| 1357 b | ↳ supprimer le diagramme retire l'image du stockage | **navigateur du Module** | |
| 1370 | refuses an image too heavy, with a message, and places nothing | **navigateur du Module** | La taille est connue après l'encodage (canvas). |
| 1383 a | pastes an image of the system clipboard in the middle of the view, captioned image : la légende « image » | **déjà couvert** | `test/images.test.ts:50`. |
| 1383 b | ↳ un collage de fichier place l'image au milieu de la vue | **navigateur du Module** | Événement `paste`. |
| 1402 a | makes a custom shape with two anchors, places it, attaches an arrow to its second anchor, and hides it from the palette without changing it | **déjà couvert** | `test/library.test.ts:67` « an anchor added takes the first identifier p<n> not taken… » ; `:28` ; `test/arrows.test.ts:64`, `:70`, `:75`. |
| 1402 b | ↳ l'éditeur de formes, la palette, « Show in diagram palette », la confirmation « 1 diagram uses it », le cadre pointillé d'une définition supprimée | **navigateur du Module** | |
| 1489 a | links a shape to a new diagram, follows it with Shift+click and comes back; a link to a deleted diagram says so and can be removed : lien lu | **déjà couvert** | `test/diagram.test.ts:129` « a shape keeps its link to a URL or to another diagram… ». |
| 1489 b | ↳ le dialogue « Link on this shape », le titre requis, le nouveau diagramme écrit avant la forme qui y mène, Maj+clic, « ← Back to », « Diagram not found », « Remove link » | **navigateur du Module** | Instable ralenti (`mesures.md` : `diagram.test.ts:1523`, 3/3) : la suite du Module attend que « ← Back » disparaisse. |
| 1546 a | a link to an external URL gets https:// and opens in a new tab : le lien enregistré par le dialogue reçoit `https://`, et Maj+clic ouvre un onglet | **navigateur du Module** | `test/diagram.test.ts:136` ne prouve que la lecture d'un lien stocké, pas l'enregistrement par `LinkDialog`. |
| 1546 b | ↳ l'onglet s'ouvre hors du bac à sable de l'iframe | **Hôte** | `allow-popups-to-escape-sandbox` ; `install.test.ts:8` ne vérifie que l'attribut (ligne 23). |
| 1567 a | new rectangles take the default color set in Diagram defaults, after a reload too; a size out of bounds is refused, and existing shapes are unchanged | **déjà couvert** | `test/defaults.test.ts:17`, `:58` « a new shape takes the size, text size and color of its type… » ; `:102` « sizes go from 10 to 800… ». |
| 1567 b | ↳ l'alerte et `aria-invalid` du dialogue, défauts écrits et relus après un rechargement | **navigateur du Module** | |
| 1598 a | Save as default for this shape type, and for arrows, make the style of the selection that of the next ones | **déjà couvert** | `test/defaults.test.ts:78`, `:90`. |
| 1598 b | ↳ les deux boutons et le message « Saved: new Ellipse shapes take this style. » | **navigateur du Module** | |
| 1621 | an image missing from the storage shows a missing image frame | **navigateur du Module** | Rendu de `ShapeView`. Hôte de test : stockage modifié entre deux chargements. |
| 1633 a | exports the whole diagram as a PNG… : nom du fichier, bornes du dessin | **déjà couvert** | `test/drawio.test.ts:230` « is the title cleaned of what a file name cannot hold… » ; `test/placement.test.ts:13`. |
| 1633 b | ↳ le PNG dessiné sur un canvas (2×, marge 20), ce qui est hors de l'écran compris, fond du thème ou transparent, Ctrl+Maj+E pour la sélection | **navigateur du Module** | `src/view/png.ts`. Hôte de test : un thème. |
| 1666 a | exports the diagram as a .drawio file, with a cell for each shape, group and arrow | **déjà couvert** | `test/drawio.test.ts:26`, `:86` « an arrow joins its shapes at their ports… », `:167` « a group is a cell around its members… », `:230`. |
| 1666 b | ↳ le bouton remet un fichier `<titre>.drawio` | **navigateur du Module** | Avec 1633 b. |
| 1704 a | the Widget lists the diagrams created in the View, the most recent first, and opens the View on the one clicked : le Widget démarre, liste le diagramme, ouvre la Vue dessus | **contrat** | C2. |
| 1704 b | ↳ les quatre plus récents d'abord, « just now » | **déjà couvert** | `test/recent.test.ts:7` « the four changed last, the most recent first » ; `:34`. |
| 1704 c | ↳ la Vue ouvre le diagramme reçu dans `context.params`, et dans un événement `navigation.params` | **navigateur du Module** | Hôte de test : paramètres de navigation. |
| 1704 d | ↳ l'Hôte transmet les paramètres par le handshake ou par un événement | **déjà couvert** | Hôte : `home.test.ts:192`. |
| 1729 | an empty Widget says so, and its “+ New” opens the View on a new diagram, which the Widget then lists | **navigateur du Module** | `openView({ new })`, un seul diagramme créé, que la Vue soit chargée ou non. |
| 1755 a | imports the files of living-documentation after a confirmation: diagrams, libraries and the images they refer to | **déjà couvert** | `test/import.test.ts:6`, `:48` « a rectangle and an ellipse of the original sizes… » ; `:242`, `:246`, `:265` « an image provided has its key, one that is not has a key no storage holds, and is reported ». |
| 1755 b | ↳ plusieurs fichiers au sélecteur, la confirmation qui compte et nomme `missing.png`, Cancel n'écrit rien, Import écrit et ouvre, relu après un rechargement | **navigateur du Module** | |
| 1804 a | refuses a file that is not JSON, naming it, and imports nothing | **déjà couvert** | `test/import.test.ts:14` « text that is not JSON, or JSON that is neither, is refused ». |
| 1804 b | ↳ l'alerte qui nomme le fichier, rien d'écrit | **navigateur du Module** | |
| 1816 | its User guide opens from the Launcher, with its screenshots | **contrat** | C3. |

Ce que la suite navigateur de Diagram demandera à l'Hôte de test :

- **stockage** pré-rempli et modifié entre deux chargements (`diagram:<id>`, `diagrams`, `shapes`, `defaults`, `image:<sha256>`) et lu par le test ; gardé quand la page est rechargée ; `keys` et `get` sur tout le stockage (la jauge le mesure) ; une écriture refusée avec `quota_exceeded` ;
- **visibilité** : `visibility` à la Vue (historique gardé) ;
- **`openView` et paramètres** : enregistrer les appels du Widget (`{ id }`, `{ new }`) ; démarrer la Vue avec `context.params` ; envoyer `navigation.params` ;
- **contexte** : `locale` `en-US`, un thème (fond du PNG) ;
- **fichiers et presse-papiers** : sélecteur de fichiers, téléchargements, `paste` synthétique, nouvel onglet : rien de plus que Playwright sur la page du Module.

## Pour le ticket 04 : l'Hôte de test

Ce que les quatre suites demandent, réuni :

| Besoin | Survival Kit | Watch Later | Skills Library | Diagram |
|---|---|---|---|---|
| Stockage en mémoire, pré-rempli et lu par le test | ✓ | ✓ | ✓ | ✓ |
| Le même stockage pour la Vue et le Widget, gardé quand la page est rechargée | ✓ | ✓ | ✓ | ✓ |
| Une écriture refusée (`quota_exceeded`, ou une autre erreur) | ✓ | ✓ | | ✓ |
| `visibility` envoyé à une Vue ou un Widget | ✓ | ✓ | ✓ | ✓ |
| `openView` du Widget enregistré, avec ses paramètres | ✓ | ✓ | ✓ | ✓ |
| Une Vue démarrée avec `context.params`, et `navigation.params` | ✓ | | | ✓ |
| Contexte : `locale`, thème | ✓ | ✓ | ✓ | ✓ |
| Taille du Widget déclarée par le Manifeste | | ✓ | ✓ | |
| Réseau simulé | | YouTube | GitHub | |

Le réseau simulé peut rester `page.route` de Playwright sur la page du Module : la page est servie depuis `dist/` en HTTP, sans CSP de l'Hôte. Fichiers, téléchargements, presse-papiers et nouvel onglet n'ont besoin de rien de plus que Playwright, puisque la page du Module n'est plus dans une iframe `sandbox`.
