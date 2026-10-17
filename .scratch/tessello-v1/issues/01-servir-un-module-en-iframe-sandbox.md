# 01: Servir un Module à une iframe sandbox avec blocage réseau

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Un prototype minimal tranche la première question technique ouverte de la spec : comment l'Hôte affiche les fichiers d'un Module, stockés localement, dans une iframe sandbox d'origine opaque (ADR 0001), tout en **bloquant réellement** les accès réseau non couverts par ses Permissions (ADR 0004). Il faut comparer au moins deux pistes, un service worker et une origine dédiée au contenu des Modules, et retenir celle qui applique effectivement la politique de sécurité de contenu aux requêtes et aux ressources de l'iframe. Le prototype peut être jetable ; c'est la décision qui compte.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Un prototype charge dans une iframe sandbox (sans `allow-same-origin`) une page et ses ressources relatives provenant d'un stockage local du navigateur.
- [x] Dans ce prototype, une requête et une ressource distante vers une origine déclarée réussissent, et vers une origine non déclarée elles sont bloquées par le navigateur.
- [x] Les fuites résiduelles connues (ouverture d'un lien dans un nouvel onglet, WebRTC) sont vérifiées et leur statut est noté.
- [x] Le comportement est vérifié au moins sur Chrome et Firefox ; Safari est vérifié ou signalé comme non testé.
- [x] La solution retenue, les pistes écartées et leurs raisons sont consignées dans un nouvel ADR, avec les conséquences pour l'hébergement sur Cloudflare Pages (en-têtes, domaines, coût).
- [x] Une note indique ce que le ticket 04 doit reprendre du prototype.

## Comments

### Réponse (2026-10-17)

**Question tranchée :** comment l'Hôte sert-il les fichiers locaux d'un Module à une iframe sandbox d'origine opaque, en bloquant réellement le réseau non déclaré ?

**Verdict :** ni service worker, ni origine dédiée, contrairement à ce que supposait le ticket, qui attendait que l'une des deux pistes l'emporte. Les navigateurs ne font jamais passer par un service worker une iframe sandbox sans `allow-same-origin`, ni les requêtes d'un document opaque. Le constat est le même dans Chromium, Chrome, Firefox et WebKit. L'Hôte construit donc lui-même un document `srcdoc` autonome : CSP en `<meta>` en tête, fichiers locaux en URL `data:`, et un petit runtime pour `fetch`, XHR, Workers, URL posées à l'exécution et imports ES (import map). Décision et conséquences pour Cloudflare Pages : `docs/adr/0005-vues-et-widgets-construits-en-srcdoc-autonome.md`.

**Prototype (source primaire) :** branche `prototype/01-iframe-sandbox`, dossier `prototypes/01-iframe-sandbox/` (`README.md`, `results-*.json`). Lancement : `npm install && node run.mjs`.

**Navigateurs :** Chromium 143, Chrome 155, Firefox 144 (Gecko de Playwright) et WebKit 26 (Playwright) sont vérifiés. **Safari 26.6.2** (macOS 26.6.2) est vérifié à la main pour l'approche retenue (2026-10-18). Tous les contrôles de `probe()` passent, et aucune requête vers l'origine non déclarée n'atteint le serveur. `selfnav`, `form` et `prefetch` sont bloqués, et WebRTC fuit (paquets STUN). Le test du nouvel onglet n'a pas été fait dans Safari, dont le bloqueur arrête une ouverture qui ne vient pas d'un clic.

**Fuites résiduelles :** nouvel onglet et WebRTC fuient. WebRTC n'est pas observable dans le Firefox de Playwright, qui n'émet aucun paquet STUN même hors sandbox. La navigation de l'iframe est bloquée grâce à `frame-src 'none'` sur l'Hôte. Formulaire et prefetch sont bloqués.

### Point tranché (2026-10-18)

`frame-src 'none'` sur l'Hôte empêchait un Module d'intégrer une iframe, même vers une origine déclarée, ce qui s'écartait de la Convention §4. Décision de l'Utilisateur : **préciser la Convention**. Le §4 énumère désormais les ressources distantes, et interdit d'intégrer une frame et de naviguer l'iframe vers une autre URL, y compris une autre page du paquet : une Vue ou un Widget est une page unique. Le routage se fait par `location.hash`, car `history.pushState` avec une URL lève une `SecurityError` en origine opaque (vérifié dans les trois moteurs). Le Validateur avertit d'une frame intégrée (`sandbox/unavailable-api`). Voir l'ADR 0005.

### Ce que le ticket 04 doit reprendre du prototype

- `public/inline.js` (`buildSrcdoc`) comme point de départ du montage d'une Vue ou d'un Widget, et `cspFor(…, { inline: true })` dans `public/module.js` pour la CSP. Les deux sont à réécrire avec des tests, pas à copier tels quels.
- Le sandbox `allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox` (Convention §4), sans `allow-same-origin`.
- L'en-tête de l'Hôte `Content-Security-Policy: frame-src 'none'`, et aucune restriction des directives de chargement sur l'Hôte, puisque le `srcdoc` hérite de sa CSP. À reporter dans `_headers` (ticket 12).
- Ce que le prototype ne couvre pas et que le ticket 04 doit traiter :
  - fichiers binaires (PNG, polices), car le prototype n'encode que du texte ;
  - réécriture des imports ES avec un vrai lexer (par exemple `es-module-lexer`) au lieu de l'expression régulière actuelle, qui ignore `export … from` et ne distingue pas les commentaires ;
  - `import.meta.url` et `new URL("x", import.meta.url)`, qui pointent vers une URL `data:` ;
  - `srcset`, `<source>` et les `url()` posées en JS ;
  - dans Firefox, une feuille de style intégrée en `data:` s'applique parfois après `load` : envisager de l'intégrer en `<style>` plutôt qu'en `<link href="data:…">` ;
  - un `import()` dont le chemin relatif est calculé à l'exécution, qui ne passe pas.
- La taille du document, avec un paquet de 10 Mo encodé en base64 pour chaque Vue ou Widget ouverts : la mesurer. Si besoin, transmettre les gros fichiers par `postMessage` et en faire des URL `blob:` créées dans l'iframe.
- Le protocole : l'origine du message est `"null"`, l'Hôte doit donc identifier l'iframe par `event.source === iframe.contentWindow` (Convention §5).
- Pour le test Playwright de blocage effectif (point d'entrée D), le schéma de `serve.mjs` : des serveurs qui consignent ce qui les atteint, pour prouver qu'une requête bloquée n'a jamais touché le réseau.
