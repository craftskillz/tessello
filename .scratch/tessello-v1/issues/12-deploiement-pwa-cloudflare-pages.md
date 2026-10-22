# 12: Déploiement PWA sur Cloudflare Pages

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** L'Hôte est en ligne à une adresse publique sur Cloudflare Pages et installable comme application (PWA), pour un coût nul, avec les en-têtes HTTP qu'exige la solution retenue au ticket 01.

**Blocked by:** 04 (Premier Module dans le navigateur)

**Status:** ready-for-agent

- [ ] L'Hôte est installable comme PWA et s'ouvre hors ligne une fois installé, avec les Modules déjà installés.
- [ ] Le déploiement sur Cloudflare Pages est reproductible à partir du dépôt et documenté, y compris les en-têtes HTTP nécessaires.
- [ ] Le déploiement n'introduit aucun service dont le coût croît sans plafond ; les quotas gratuits utilisés sont notés.
- [ ] Si l'Hôte reçoit sa propre politique de sécurité de contenu, `connect-src` autorise `https:` et `http://localhost:*` / `http://127.0.0.1:*`, sans quoi l'installation par URL échoue sans bruit (ADR 0009, ticket 08).
- [ ] Les tests navigateur passent contre l'Hôte déployé ou un équivalent local fidèle.
- [ ] La création de comptes, de domaines ou de projets chez un tiers n'est faite qu'avec l'accord explicite du mainteneur.

### Marketplace (2026-10-22)

Cloudflare Pages est confirmé (ADR 0014) : son offre gratuite n'a pas de limite de bande passante, alors que celle de Netlify met le site en pause au-delà de son quota. Le Mainteneur crée lui-même un compte Cloudflare gratuit (sans carte bancaire). La Marketplace aura son propre projet Cloudflare Pages (ticket 05 de marketplace). Le domaine reste à choisir : les adresses `*.pages.dev` conviennent en attendant.
