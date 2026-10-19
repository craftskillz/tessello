# 15: Module Survival Kit

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.
Source du portage : la fonctionnalité Survival Kit de living-documentation, rétrodocumentée dans `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/survival-kit.md` (code : `living-documentation/src/frontend-svelte/src/lib/survival-kit/`, `src/routes/survival-kit.ts`).

**What to build:** Le Survival Kit devient un Module Tessello, dans `sample-modules/survival-kit/`. C'est un tableau de bord sur un seul écran, avec trois panneaux : myTasks, myNotes et myLinks. Il est destiné plus tard à la marketplace, mais ce ticket ne contient rien qui lui soit propre. Le Module est écrit en Svelte 5 et compilé par esbuild en fichiers statiques ; aucun serveur ne tourne, ni dans l'Hôte ni ailleurs. Il ne déclare aucune Permission. Le portage reprend le comportement décrit dans la rétrodoc (parcours J1 à J3, règles métier, messages anglais et français), avec les écarts listés ci-dessous.

**Blocked by:** aucun (la Convention, le Validateur et l'Hôte sont prêts depuis le ticket 08)

**Status:** resolved

### Paquet et construction

- [x] `sample-modules/survival-kit/` contient les sources Svelte et un script de construction (esbuild et le plugin Svelte). Ce script écrit le paquet : `manifest.json`, `icon.svg`, `view/` et `widget/`. Le SDK est importé depuis `@tessello/sdk` et intégré au bundle, sans copie de `tessello-sdk.js`.
- [x] La Vue et le Widget sont chacun une page unique, qui respecte §4 : ni `localStorage`, ni routeur à base d'historique, ni `alert`/`confirm`, ni frame imbriquée.
- [x] Le paquet passe le Validateur sans erreur ni avertissement. Le test des exemples (`packages/cli/test/examples.test.ts`) couvre aussi `sample-modules/`.
- [x] Identifiant provisoire : `@tessello/survival-kit`. La réservation des Espaces de noms relève de la marketplace.

### Stockage (remplace le fichier `.survival-kit.json` et l'API GET/PUT)

- [x] Le kit est rangé dans le stockage de l'Hôte (§6.1) sous trois clés : `tasks`, `notes` et `links`. La forme des données est celle de `types.ts`. Chaque changement est enregistré aussitôt, sans le délai de 400 ms, car §4 exige de persister tout de suite.
- [x] Un échec de lecture au démarrage affiche une erreur et bloque l'édition, au lieu de montrer un kit vide qui écraserait les données au premier changement (Q-004).
- [x] Un échec d'écriture, par exemple `quota_exceeded`, est signalé à l'Utilisateur (Q-004).
- [x] La Vue relit le stockage quand elle redevient visible (événement `visibility`). Ainsi, une case cochée dans le Widget pendant que la Vue attendait derrière l'Accueil n'est pas écrasée.

### Écarts voulus par rapport à l'original

- [x] Le texte et la priorité d'une tâche se modifient, ainsi que le nom et la couleur d'une catégorie (Q-005).
- [x] La suppression d'une tâche demande une confirmation, comme toutes les autres suppressions (Q-006).
- [x] Le thème suit celui de l'Hôte (`theme`, puis `theme.changed`) au lieu du bouton ☾/☀. Les six couleurs gardent une variante claire et une variante sombre.
- [x] La langue suit le `locale` du handshake, avec les catalogues anglais et français portés. L'anglais sert par défaut.
- [x] Une URL de lien sans schéma reçoit `https://`. Dans un srcdoc, une URL relative mènerait à une adresse cassée.
- [x] Sont retirés : le lien d'en-tête et son masquage (Q-007), le bouton Word Cloud et le commit git automatique. Le Lanceur tient lieu de lien d'en-tête. Le Dossier des Modules, versionnable par l'Utilisateur, répond à Q-003.

### Import d'un kit existant

- [x] Une action « Import a kit » lit un fichier `.survival-kit.json` choisi par l'Utilisateur. La lecture est défensive : un tableau absent ou invalide est ignoré, et un fichier illisible est refusé avec un message.
- [x] Le kit importé remplace le kit actuel, après une confirmation qui indique le nombre de tâches, de notes et de catégories importées.

### Widget L (2 × 2)

- [x] Le Widget affiche les tâches Urgent non terminées, que l'on peut cocher, avec le nombre de tâches urgentes et de tâches à faire. En dessous figurent les catégories de liens et leurs liens, qui s'ouvrent dans un nouvel onglet.
- [x] « open kit » ouvre la Vue (`navigation.openView`). Le nombre de tâches urgentes ouvre la Vue filtrée sur Urgent (`params: { filter: "urgent" }`), et la Vue applique ce paramètre au handshake comme à `navigation.params`.
- [x] Le Widget relit le stockage quand il redevient visible, ne défile pas et s'adapte à sa cellule (§7.1).

### Question technique à trancher

- [x] **Bouton « copy » d'un bloc Code.** Le Module tourne dans une iframe sandbox à origine opaque, et l'Hôte ne lui accorde pas `clipboard-write`. Il faut vérifier dans Chromium si `navigator.clipboard.writeText`, ou un repli par `document.execCommand("copy")`, fonctionne. Si rien ne fonctionne, l'écart est signalé avec une proposition (attribut `allow` sur l'iframe dans l'Hôte, ou note dans la Convention). Le Module ne doit pas échouer en silence : sans copie possible, il sélectionne le code.

### Tests

- [x] Tests unitaires, là où les règles sont écrites : construction des blocs (listes, tableaux), lecture défensive d'un kit importé, ajout de `https://`. Le script `npm test` couvre `sample-modules/*/test`.
- [x] Tests navigateur (point d'entrée D, avec le paquet construit puis zippé) :
  - installation, puis une tâche, une note avec un bloc Code et un lien retrouvés après un rechargement ;
  - le Widget coche une tâche urgente, puis la Vue rouverte la montre terminée ;
  - le Widget ouvre la Vue filtrée sur Urgent ;
  - import d'un `.survival-kit.json` ;
  - échec d'écriture signalé ;
  - le résultat de la question du presse-papiers.

## Comments

### Décisions prises à l'écriture du ticket (2026-10-19)

Choix de l'utilisateur : Widget L (« mini dashboard »), Svelte, correction de Q-005 et Q-006, import d'un kit existant, aucune Permission, dossier `sample-modules/survival-kit`.

Choix de l'agent, à contester si besoin :

- **Suppression d'une tâche.** Elle demande une confirmation, plutôt qu'une annulation, par cohérence avec les autres suppressions.
- **Import.** Il remplace le kit, sans fusion, car fusionner poserait des collisions d'`id`.
- **Forme des données.** Elle reste celle de l'original (`titre`, `liens`, `nom`…), pour que l'import soit direct.
- **Paquet construit.** Il n'est pas versionné : les tests le construisent. À revoir si l'on veut qu'un `git clone` dans le Dossier des Modules suffise.

### Implémentation (2026-10-19)

- **Presse-papiers (question tranchée).** Mesuré dans Chromium (Playwright), sans aucune permission accordée au navigateur : `navigator.clipboard.writeText` est refusé par la politique de permissions de l'iframe (« The Clipboard API has been blocked because of a permissions policy »), mais `document.execCommand("copy")`, appelé pendant le clic, copie bien le texte. Le test navigateur relit le presse-papiers depuis la page de l'Hôte. Le Module essaie donc l'API asynchrone, puis `execCommand`, puis sélectionne le code et l'indique (« selected: press Ctrl+C »). Aucun changement de l'Hôte ni de la Convention n'est nécessaire pour Chromium. `execCommand` est déprécié : si un navigateur le retire, la proposition reste l'attribut `allow="clipboard-write"` sur l'iframe dans l'Hôte. Firefox et Safari n'ont pas été vérifiés, faute de sélecteur de dossier.
- **Construction.** `sample-modules/survival-kit/scripts/build.ts` exporte `buildPackage(out)` et écrit le paquet dans `dist/` (ignoré par git). `sample-modules/*` est un espace de travail npm : `svelte` et `esbuild-svelte` y sont des dépendances de développement. Le test des exemples et les tests navigateur (`zipSample`) construisent le paquet dans un dossier temporaire.
- **Stockage.** Chaque liste est écrite dès qu'elle change. Le Widget relit les tâches juste avant d'en cocher une, pour ne pas écraser un changement fait dans la Vue entre-temps. Une relecture ratée au retour de visibilité bloque l'édition, comme au démarrage. Ce blocage n'a pas de test navigateur : l'Hôte n'offre pas de moyen simple de faire échouer une lecture.
- **Lecture défensive.** Les éléments illisibles d'une liste sont écartés, une priorité ou une couleur inconnue reprend sa valeur par défaut, et un `id` absent ou en double est remplacé, car les listes de la Vue sont indexées par `id`. Un fichier qui n'est pas du JSON, ou qui ne contient aucune des trois listes, est refusé.
- **Schéma des liens.** Seuls `http(s)://`, `mailto:` et `tel:` sont gardés tels quels, et tout le reste reçoit `https://`. Un lien importé ne peut donc pas exécuter de script (`javascript:`). La règle s'applique à l'enregistrement et à l'affichage, ce qui couvre aussi les liens importés.
- **Langue et accessibilité.** Les libellés sans clé de l'original (« toggle ») passent dans les catalogues. Les boutons d'icône (✎, ✕, ＋) reçoivent un nom accessible.
