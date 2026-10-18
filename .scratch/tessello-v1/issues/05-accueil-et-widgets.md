# 05: Accueil et Widgets

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** L'Utilisateur dispose d'un Accueil qui regroupe les Widgets de ses Modules dans une grille, peut les réordonner, et passe d'un Widget à la Vue correspondante. Le Module « Notes » gagne un Widget.

**Blocked by:** 03 (Thème, visibilité, navigation et erreurs du protocole), 04 (Premier Module dans le navigateur), 04 bis (Le code et les données des Modules dans le Dossier des Modules)

**Status:** resolved

- [x] L'Accueil affiche les Widgets des Modules installés dans une grille où S occupe 1×1 cellule, M 2×1 et L 2×2.
- [x] L'Utilisateur peut réordonner les Widgets et l'ordre est conservé après rechargement.
- [x] Un Module sans Widget n'apparaît pas sur l'Accueil mais reste accessible par le Lanceur.
- [x] Le Module « Notes » propose un Widget S ; interagir avec lui ouvre sa Vue, avec des paramètres le cas échéant.
- [x] Les Widgets masqués (Accueil caché par une Vue) et les Vues masquées reçoivent `visibility` à faux, puis à vrai quand ils redeviennent visibles.
- [x] Un Widget qui plante ou ne termine pas son handshake est remplacé par un message d'erreur sans affecter les autres Widgets.
- [x] Des tests navigateur couvrent l'affichage de l'Accueil, le réordonnancement et l'ouverture de la Vue depuis un Widget.

## Comments

### Implémentation (2026-10-18)

- **Cœur de l'Hôte** (`packages/host-core`) :
  - `src/home.ts` : `host.home()` renvoie les Widgets des Modules actifs (Identifiant, nom, taille), dans l'ordre de l'Accueil. Les Widgets rangés viennent d'abord, dans leur ordre, puis les autres dans l'ordre d'activation. Un Module sans Widget n'y est pas.
  - `host.arrangeHome(ordre)` enregistre l'ordre dans `.tessello/home.json` (`{ "widgets": [Identifiants] }`). Un Module absent de l'Accueil, par exemple parce que son dossier a disparu, garde sa place et la retrouve quand il revient.
  - `Persistence` gagne `home` (lire, écrire). `ModuleEntry` gagne `widget`, la taille lue dans le Manifeste non validé, ou null.
- **Interface** (`packages/host/src/main.ts`) :
  - L'Accueil est une grille de cellules carrées de 160 px : S = 1×1, M = 2×1, L = 2×2. Chaque Widget tourne dans son iframe sandbox, construite comme une Vue (srcdoc + fichiers en `blob:`).
  - Le bouton « Arrange widgets » ouvre un mode où chaque Widget se déplace par glisser-déposer ou avec les boutons « Move … earlier / later ». Un Widget déplacé n'est pas rechargé (`moveBefore`, Chrome et Edge depuis la version 133).
  - Une Vue quittée pour l'Accueil reste chargée et masquée jusqu'à l'ouverture d'une autre Vue. Si son Widget la rouvre, elle revient telle quelle et reçoit les paramètres par `navigation.params`. Si on la rouvre depuis le Lanceur, elle est reconstruite : elle relit ainsi son dossier sur disque.
  - Visibilité : les Widgets reçoivent `visibility: false` quand une Vue cache l'Accueil, la Vue cachée le reçoit aussi, puis tous reçoivent `true` quand ils redeviennent visibles. Un onglet masqué cache aussi tout ce qui est affiché.
  - Un Widget qui ne termine pas son handshake en 10 s, dont le dossier n'est plus conforme ou demande de nouvelles Permissions, ou qui échoue à démarrer, est remplacé par un message dans sa cellule. Il est réessayé au prochain rafraîchissement (retour du focus, installation, ouverture d'une Vue).
  - Un `home.json` modifié à la main et illisible est ignoré : les Widgets reprennent l'ordre par défaut.
- **Notes** (1.1.0) : le Widget S affiche la note la plus récente et le nombre de notes, et relit le stockage quand il redevient visible. Un clic ouvre la Vue. « + » l'ouvre avec `{ note: "new" }`, et la Vue place alors le focus sur la nouvelle note. La copie du SDK passe à la racine du Module (`examples/notes/tessello-sdk.js`), partagée par la Vue et le Widget.
- **Tests** : `host-core/test/home.test.ts` et `host/e2e/home.test.ts` couvrent la grille, le réordonnancement après rechargement, l'ouverture de la Vue depuis le Widget, la visibilité, le Widget sans handshake et le Widget réparé.
- **Limites** :
  - Le mode de rangement n'apparaît qu'à partir de deux Widgets.
  - Sous 40rem, les cellules s'adaptent à la largeur de l'écran.
  - À chaque rafraîchissement, le Dossier des Modules est parcouru deux fois (Lanceur et Accueil).
