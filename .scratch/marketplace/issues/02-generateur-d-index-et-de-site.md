# 02: Générateur de l'index et du site

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** À partir des fiches et des paquets, le Générateur produit `index.json` et les pages statiques du site de la Marketplace.

**Blocked by:** 01

**Status:** resolved

- [x] `index.json` (`format: 1`, date de génération) contient, pour chaque Module : la fiche, et ce qu'on tire du Manifeste de la dernière version (nom, description, icône, Permissions, Widgets, version de la Convention, Guide d'utilisation). Le format est documenté dans le paquet.
- [x] Les Modules et versions bannis ou retirés restent dans l'index avec leur état (le format le prévoit dès maintenant, le ticket 04 l'alimente).
- [x] Le site : une page de liste avec recherche (nom, description, tags, Créateur) et filtre par Permission ; une page par Module avec la fiche, le Guide rendu, les captures, le texte de l'ADR 0015 et un bouton « Install in Tessello » vers `https://<Hôte>/#install=<URL>`. Il est en anglais, sans dépendance à un service tiers.
- [x] La recherche et le filtre sont une fonction partagée, que l'Hôte réutilise (ticket 06).
- [x] Les Modules bannis ou retirés n'apparaissent ni dans la liste ni dans la recherche.
- [x] Tests unitaires : des fiches vers l'index, recherche et filtre, un Module banni, un retiré, une version bannie.

## Comments

- 2026-10-23 — Fait. `packages/marketplace` : `buildIndex` (`src/generator.ts`, le Générateur d'index), `searchModules` et `declaredPermissions` (`src/search.ts`, la recherche partagée avec l'Hôte), `PERMISSION_FILTERS` et `permissionFilter` (`src/permission-filter.ts`), `renderSite` (`src/site.ts`, les pages) et `scripts/build-site.ts` (`npm run build:marketplace -- --repo <dépôt> --out <dossier> --host <URL de l'Hôte> [--packages <dossier>]`), qui écrit `index.json`, les fichiers d'images, les pages et `search.js`. Format de l'index, chemins des fichiers et pages documentés dans `packages/marketplace/README.md`.
- **Guide d'utilisation** : le rendu Markdown de l'Hôte passe dans `@tessello/convention` (`renderGuide(markdown, chemin, imageSource)`, avec `slug` et `escapeHtml`), pour que l'Hôte et le site le rendent de la même façon. L'index porte le Markdown du Guide et, pour chaque image, son chemin dans le paquet et son fichier à côté de `index.json` (`modules/<espace>/<nom>/<version>/<chemin>`). L'Hôte (ticket 06) récupère ces fichiers et appelle `renderGuide` avec des URL `data:`.
- **`latest`** : ce que dit le paquet de la version la plus récente ni retirée ni bannie (`describedVersion`). Le paquet doit avoir l'empreinte de la fiche, sinon `index/sha256-mismatch` et `latest: null` : l'index ne décrit jamais un code qui n'est pas celui de la fiche. Les tickets 06 et 07 doivent lire `latest` comme « la plus récente installable ».
- **Filtre par Permission** : l'Utilisateur choisit ce qu'il accepte (« No internet access » accepte `localNetwork`, « No local network access » accepte `network`, « No Permissions » n'accepte rien). Les libellés sont en anglais ; l'Hôte traduit les siens pour les mêmes valeurs.
- **Modules bannis ou retirés** : absents de la liste et de la recherche, mais leur page reste, sans bouton d'installation ni Guide, avec la raison du Bannissement ou une note neutre de Retrait, pour qu'un lien partagé ne tombe pas sur une erreur 404.
- **Reste pour le ticket 05** : servir `index.json` et les fichiers avec `Access-Control-Allow-Origin: *` (fichier `_headers`), noté dans le README.
- Tests : 15 sur le Générateur, 15 sur le site, 2 sur le script de construction (dossier temporaire, sans réseau), 10 sur `renderGuide` dans la Convention. Suite complète verte (1006).
