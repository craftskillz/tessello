# 19: Nettoyage du code du Survival Kit

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Référence : les skills `codebase-design` (modules profonds) et `code-review` (odeurs de Fowler) de `.agents/skills/`.

**What to build:** Le comportement du Survival Kit ne change pas pour l'Utilisateur. Son code devient plus simple à lire et à modifier, et chaque règle a un seul endroit où vivre. Un Créateur qui s'en inspire, ou un LLM qui le lit, y trouve un exemple propre.

**Blocked by:** 16 (Guide d'utilisation obligatoire dans la Convention et le Validateur)

**Status:** resolved

### Ce que « propre » veut dire ici

- **Modules profonds** : beaucoup de comportement derrière une petite interface, testé par cette interface. On applique le test de suppression : un module dont la suppression ne ferait pas réapparaître de complexité chez ses appelants est un simple relais, et il disparaît.
- **Odeurs de Fowler** : le code dupliqué, les noms mystérieux, les paquets de données qui voyagent ensemble, l'obsession des primitives (les sentinelles `-1`), les intermédiaires (*Middle Man*), les chaînes de messages.

### Critères

- [x] **Un seul accès au stockage, pour la Vue et le Widget.** La lecture du kit, l'écriture et le message d'une écriture ratée vivent dans un seul module. Le Widget ne refait pas ses propres lectures et n'a plus sa propre traduction des codes d'erreur.
- [x] **Le modèle parle anglais.** Le modèle interne s'écrit `title`, `links`, `name`, `blocks` et `color`, au lieu de `titre`, `liens`, `nom`, `blocs` et `theme`. La lecture défensive accepte aussi la forme de l'original, si bien qu'un `.survival-kit.json` s'importe toujours et qu'un kit écrit par la version 1.0.0 se relit sans perte. Le nom « Theme » est réservé au thème de l'Hôte : les six couleurs deviennent `Color`.
- [x] **Les règles du kit vivent dans `kit.ts` et y sont testées** : le filtre des tâches, les nouveaux identifiants sans collision, l'ajout de `https://` au moment de la lecture. Ce dernier point évite de corriger l'URL à chaque affichage.
- [x] **Une confirmation partagée, sans relais.** Les panneaux demandent une confirmation à un seul module, sans recevoir une fonction `confirmDelete` passée de composant en composant.
- [x] **Plus de champs éparpillés.** Chaque dialogue d'édition (tâche, note, bloc, catégorie, lien) tient son brouillon dans un seul état, `null` quand il est fermé. Les sentinelles `-1 = ajout` disparaissent.
- [x] **Plus de balisage dupliqué.** L'en-tête de panneau, la barre d'outils (édition, tout développer, ajout) et la carte repliable sont écrits une seule fois. Un bloc Code gère seul sa copie et son état.
- [x] La version passe à 1.1.0. `npm test`, `npm run typecheck` et `npm run test:browser` passent, et le paquet passe le Validateur sans erreur ni avertissement.

## Comments

### Décisions prises à l'écriture du ticket (2026-10-19)

- **Revient sur un choix du ticket 15** : la forme des données de l'original. L'import direct reste possible, parce que la lecture défensive, qui existait déjà, traduit l'ancienne forme. Le gain : un code entièrement en anglais, sans `noteTitre` ni `linkNom`.
- **Hors périmètre** : l'ordre des éléments (aucun réordonnancement, comme l'original) et les catégories identifiées par leur nom pour le dépliage. Ce comportement de l'original est gardé.

### Implémentation (2026-10-19)

- **`lib/storage.ts`** (`kitStorage`) : la seule interface vers le stockage de l'Hôte, pour la Vue (`store.svelte.ts`) comme pour le Widget. Elle range les catégories sous la clé `links` de l'original et transforme un échec d'écriture en message pour l'Utilisateur. Elle est testée avec un stockage en mémoire, ce qui fait de l'Hôte et de ce faux stockage deux adaptateurs : la couture est réelle.
- **`lib/kit.ts`** : nouvelles fonctions `matchesFilter` et `newId`. `newId` corrige une collision possible quand deux éléments sont ajoutés dans la même milliseconde, ce qui faisait planter les listes indexées par `id`. Les lecteurs acceptent les deux formes (`title`/`titre`, `color`/`theme: "t-…"`…) et ajoutent `https://` à la lecture.
- **`lib/confirmation.svelte.ts`** et **`ConfirmDialog.svelte`** remplacent la prop `confirmDelete`. La fonction s'appelle `ask`, et non `confirm`, que le Validateur signale.
- **Composants** : `PanelHead`, `CardsToolbar`, `Card` (avec `flush` pour les rangées de liens), `NoteBlock` et `CodeBlock`, qui gère seul sa copie et son minuteur. Les styles déplacés ont quitté `base.css`, et les couleurs deviennent les classes `.color-*`, avec les variables `--color-soft` et `--color-ink`.
- **Vérifications** : `svelte-check` 4.7.6, lancé une fois avec `npx`, ne signale rien dans les composants. Ses deux erreurs viennent de l'import de `base.css`, que la config ad hoc ne résout pas. `npm test` (226), `npm run typecheck` et `npm run test:browser` (54) passent.
- **Laissé tel quel** : les clés des catalogues (`notes_edit_bloc`…), qui reprennent celles de l'original, et le dépassement du bouton « copy » sur une ligne de code très longue, qui existait déjà avant.
