# 12: Déploiement PWA sur Cloudflare Pages

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** L'Hôte est en ligne à une adresse publique sur Cloudflare Pages et installable comme application (PWA), pour un coût nul, avec les en-têtes HTTP qu'exige la solution retenue au ticket 01.

**Blocked by:** 04 (Premier Module dans le navigateur)

**Status:** ready-for-human

- [x] L'Hôte est installable comme PWA et s'ouvre hors ligne une fois installé, avec les Modules déjà installés.
- [x] Le déploiement sur Cloudflare Pages est reproductible à partir du dépôt et documenté, y compris les en-têtes HTTP nécessaires.
- [x] Le déploiement n'introduit aucun service dont le coût croît sans plafond ; les quotas gratuits utilisés sont notés.
- [x] Si l'Hôte reçoit sa propre politique de sécurité de contenu, `connect-src` autorise `https:` et `http://localhost:*` / `http://127.0.0.1:*`, sans quoi l'installation par URL échoue sans bruit (ADR 0009, ticket 08).
- [x] Les tests navigateur passent contre l'Hôte déployé ou un équivalent local fidèle.
- [x] La création de comptes, de domaines ou de projets chez un tiers n'est faite qu'avec l'accord explicite du mainteneur.

### Marketplace (2026-10-22)

Cloudflare Pages est confirmé (ADR 0014) : son offre gratuite n'a pas de limite de bande passante, alors que celle de Netlify met le site en pause au-delà de son quota. Le Mainteneur crée lui-même un compte Cloudflare gratuit (sans carte bancaire). La Marketplace aura son propre projet Cloudflare Pages (ticket 05 de marketplace). Le domaine reste à choisir : les adresses `*.pages.dev` conviennent en attendant.

## Comments

- 2026-10-25 — **Implémentation.** `packages/host/scripts/headers.ts` est la source unique des en-têtes : le build écrit `dist/_headers` (`/*` → `Content-Security-Policy: frame-src 'none'`, seule directive, sans `connect-src` ; `/sw.js` → `Cache-Control: no-cache`) et `serve.ts` sert `dist/` avec les mêmes, d'où un équivalent local fidèle. PWA : `manifest.webmanifest`, `icon.svg` (SVG `any`, accepté par Chromium), et un service worker (`src/service-worker.ts` → `dist/sw.js`) qui ne sert que les fichiers de l'Hôte en cache-first, sous un cache nommé d'après une empreinte de ces fichiers ; il laisse passer tout le reste (Modules, Marketplace, téléchargements par URL, autres pages du site). Test navigateur `e2e/pwa.test.ts` : manifeste sans erreur ni erreur d'installabilité, puis hors ligne, rechargement servi par le service worker avec l'en-tête CSP, et le Module installé s'ouvre. Déploiement : `.github/workflows/deploy-host.yml` (typecheck, tests, tests navigateur, puis `wrangler@4.149.0 pages deploy` vers le projet `tessello` dans un job séparé, sauté sans la variable `CLOUDFLARE_ACCOUNT_ID`) ; `DEPLOYING.md` documente en-têtes, mise en place et quotas gratuits. Vérifié en local : 529 tests unitaires, 203 tests navigateur (+2 PWA).
- 2026-10-25 — **Reste à faire, avec l'accord du Mainteneur :** créer le projet Pages `tessello` (adresse `https://tessello.pages.dev/`, déjà le défaut de `TESSELLO_HOST` dans la Marketplace), donner le jeton *Cloudflare Pages: Edit* et inscrire `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` dans `craftskillz/tessello`, pousser, puis vérifier les `curl -sI` de `DEPLOYING.md` et installer l'app dans Chrome. Non couvert par les tests : le démarrage à froid de l'app installée hors ligne et la ré-autorisation du Dossier des Modules (ADR 0007), qui demande un geste de l'Utilisateur.
