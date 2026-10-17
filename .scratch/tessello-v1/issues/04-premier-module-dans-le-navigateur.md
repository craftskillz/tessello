# 04: Premier Module dans le navigateur

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Premier parcours complet de l'Utilisateur dans un vrai navigateur. Il ouvre l'Hôte, dépose le `.zip` du Module d'exemple « Notes » (sans Permission, avec une Vue), le Validateur l'accepte, le Module apparaît dans le Lanceur et sa Vue s'ouvre en plein écran dans une iframe sandbox, en suivant la solution retenue au ticket 01. Les notes saisies sont conservées après rechargement. Un Module non conforme est refusé avec le rapport du Validateur. Ce ticket pose le point d'entrée de test D (navigateur réel).

**Blocked by:** 01 (Servir un Module à une iframe sandbox avec blocage réseau), 02 (Handshake et stockage, du SDK au cœur de l'Hôte)

**Status:** resolved

- [x] L'Hôte est une application web statique qui s'ouvre sans compte.
- [x] Déposer un `.zip` lance le Validateur dans le navigateur ; en cas d'erreur, l'Utilisateur voit les erreurs et rien n'est installé.
- [x] Avant l'installation, l'Utilisateur voit le nom, la version, l'icône, la description et l'Identifiant du Module.
- [x] Un Module installé apparaît dans un Lanceur toujours visible ; le sélectionner affiche sa Vue en plein écran dans une iframe sandbox.
- [x] Le Module « Notes » utilise le SDK en copie locale, passe le Validateur sans erreur ni avertissement et enregistre ses notes via le stockage de l'Hôte.
- [x] Les Modules installés et leurs données persistent après rechargement de la page (persistance navigateur derrière l'interface du ticket 02).
- [x] Si une Vue n'envoie pas `ready` dans le délai de la Convention, un message d'erreur clair remplace la Vue sans affecter le reste de l'Hôte.
- [x] Des tests navigateur couvrent l'installation, le refus d'un Module non conforme, l'ouverture de la Vue et la persistance.

## Comments

### Pointeur vers le ticket 01 (2026-10-17)

Le mécanisme d'affichage est tranché par l'ADR 0005 (`srcdoc` autonome, CSP en `<meta>`, fichiers locaux en URL `data:`). Le prototype à reprendre se trouve sur la branche `prototype/01-iframe-sandbox`, dossier `prototypes/01-iframe-sandbox/` (`public/inline.js`, `public/module.js`). La liste de ce qu'il faut reprendre ou compléter est dans le ticket 01, section « Ce que le ticket 04 doit reprendre du prototype ».

### Implémentation (2026-10-18)

- `@tessello/host` (`packages/host`, nouveau) : l'Hôte en site statique. `npm run build:host` produit `packages/host/dist/` (esbuild), `npm run start:host` le sert en local avec l'en-tête `Content-Security-Policy: frame-src 'none'` (ADR 0005). Il comprend le Lanceur, la zone de Vue, le dépôt d'un `.zip` n'importe où dans la page ou le choix d'un fichier, la fiche du Module avant l'installation (nom, version, icône, Identifiant, description, avertissements éventuels du Validateur), le rapport du Validateur en cas de refus et l'erreur de handshake.
- `src/srcdoc.ts` reprend `buildSrcdoc` et `cspFor` du prototype, réécrits :
  - fichiers binaires encodés depuis les octets ;
  - imports ES réécrits avec `es-module-lexer` (`export … from`, `export *`, `import()` littéral, commentaires ignorés) ;
  - `import.meta` remplacé par `{ url, resolve }` sous la racine du paquet ;
  - `srcset` réécrit, statique ou posé en JS ;
  - feuilles de style locales intégrées en `<style>` (Firefox) ;
  - setters `src`/`href` patchés pour les éléments hors du document (`new Image()`) ;
  - liens `href="#…"` ramenés à un changement de `location.hash`, car la `<base>` les ferait sortir de la page.
- La racine du paquet est `https://package.tessello.invalid/`. Elle n'est jamais résolue, et elle est absente de la CSP : une ressource locale non réécrite est bloquée au lieu de partir sur le réseau.
- Cœur de l'Hôte :
  - `host.inspect(zip)` valide le paquet et renvoie la fiche avec `install()`, ou le rapport ;
  - `host.modules()` liste les Modules installés ;
  - `Persistence` gagne `listModules`/`putModule` ;
  - `MountedSurface.loaded()` démarre le délai de handshake, et `SurfaceOptions.onHandshakeTimeout` est appelé s'il expire.
- `@tessello/convention` expose `readZip(bytes)`, qui renvoie le rapport et les fichiers, pour que l'Hôte n'ait pas à décompresser une seconde fois.
- Persistance navigateur : `packages/host/src/indexeddb-persistence.ts`. Le Lanceur garde l'ordre de première installation.
- Module d'exemple « Notes » : `examples/notes/`. Le SDK y est en copie locale, `view/tessello-sdk.js`, produite par `npm run build:sdk` ; un test vérifie qu'elle correspond au SDK. Notes n'affiche une modification qu'une fois enregistrée, et enchaîne les enregistrements.
- Point d'entrée D : `npm run test:browser`, en Chromium par défaut, ou avec `BROWSER=firefox|webkit`. Les tests sont dans `packages/host/e2e/` : installation, refus, persistance, délai de handshake (horloge Playwright) et chargement des fichiers du paquet sans requête réseau.
- Choix et limites :
  - Pas d'écran d'accord des Permissions (ticket 06) : la CSP suit les Permissions déclarées dans le Manifeste.
  - Installer un Identifiant connu remplace le Module et garde son stockage, sans la confirmation du ticket 07.
  - Un `import()` dont le chemin est calculé à l'exécution et les imports dans un Worker de type module ne passent toujours pas.
  - Les `url()` posées en JS (`element.style`, CSSOM, `<style>` ajouté à l'exécution) ne sont pas réécrites : la CSP les bloque, elles ne se chargent donc pas, sans rien laisser sortir.
  - Aucun test de blocage effectif (origine non déclarée, `frame-src 'none'`) : il revient au ticket 06, avec le Module « Météo » et des serveurs qui consignent ce qui les atteint.
  - La taille du document pour un paquet de 10 Mo n'est pas mesurée : chaque fichier y figure en base64 dans la table du runtime et, pour les scripts, dans l'import map, soit environ deux à trois fois la taille du paquet.

