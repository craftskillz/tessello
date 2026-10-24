# 05: Déploiement de l'index et du site sur Cloudflare Pages

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** `index.json`, les captures et le site sont en ligne sur un projet Cloudflare Pages gratuit, distinct de celui de l'Hôte, et redéployés à chaque fusion.

**Blocked by:** 02, 03, ticket 12 de tessello-v1 (compte Cloudflare et domaine)

**Status:** resolved

- [x] `index.json` et les captures sont servis avec `Access-Control-Allow-Origin: *` (fichier `_headers`).
- [x] Le déploiement est reproductible depuis le dépôt et documenté ; les quotas gratuits utilisés sont notés.
- [x] L'adresse de l'index est fixée, et inscrite dans l'Hôte (ticket 06).
- [x] La création du projet Cloudflare Pages ou d'un domaine n'est faite qu'avec l'accord explicite du Mainteneur.

## Comments

- 2026-10-24 — **Décision du Mainteneur : le bouton « Marketplace » reste visible dans l'Hôte avant ce déploiement.** D'ici là, l'adresse inscrite dans l'Hôte (`https://marketplace.tessello.app/index.json`, provisoire) ne répond pas : l'écran dit « The Marketplace can't be reached » sans copie à montrer. Ce déploiement (et le domaine du ticket 12 de tessello-v1) y met fin.
- 2026-10-24 — **Décisions du Mainteneur :** l'adresse est `https://tessello-marketplace.pages.dev/` (pas de domaine à acheter ; l'adresse ne change plus, puisque chaque Hôte la porte), le déploiement se fait par envoi direct depuis GitHub Actions (`wrangler pages deploy`), et le compte Cloudflare est à créer par le Mainteneur.
- 2026-10-24 — **Implémentation.** Dans ce dépôt : `build-site.ts` écrit `_headers` (`Access-Control-Allow-Origin: *` sur `/index.json` et `/modules/*`) ; `MARKETPLACE_INDEX_URL` vaut `https://tessello-marketplace.pages.dev/index.json`. Dans `../tessello-marketplace`, non poussé : un job `deploy` dans `build.yml`, séparé du job qui installe les outils de Tessello, qui télécharge l'artefact du site et lance `wrangler@4.149.0 pages deploy` avec le secret `CLOUDFLARE_API_TOKEN` (permission unique *Cloudflare Pages: Edit*) et la variable `CLOUDFLARE_ACCOUNT_ID` ; sans cette variable, le job est sauté. Le `README.md` y note le déploiement et les quotas gratuits : 500 builds par mois, 20 000 fichiers, 25 Mio par fichier, 100 règles `_headers`.
- 2026-10-24 — **Reste à faire, avec l'accord du Mainteneur :** créer le compte Cloudflare et le projet Pages `tessello-marketplace` ; créer le jeton et l'inscrire avec l'identifiant du compte dans `craftskillz/tessello-marketplace` ; pousser ce commit de `craftskillz/tessello` puis monter `.github/tessello-commit` ; pousser `build.yml` et le `README.md` ; lancer Build et vérifier `curl -sI https://tessello-marketplace.pages.dev/index.json` (`access-control-allow-origin: *`).
- 2026-10-24 — **En ligne.** Le Mainteneur a créé le compte Cloudflare et le projet Pages `tessello-marketplace`, le jeton (*Cloudflare Pages: Edit*), le secret `CLOUDFLARE_API_TOKEN` et la variable `CLOUDFLARE_ACCOUNT_ID`, et poussé `craftskillz/tessello` (`934c7fe`) puis `craftskillz/tessello-marketplace` (`068faeb`, outils montés à `934c7fe`). Le run Build 40092356484 passe (`build` et `deploy`). `https://tessello-marketplace.pages.dev/index.json` répond 200 avec `access-control-allow-origin: *` et l'index vide (`"modules":[]`) ; le site répond 200. La règle `/modules/*` (icônes, captures) ne se vérifie en ligne qu'avec le premier Module publié (ticket 08) ; elle est couverte par le test de `build-site.ts`.
