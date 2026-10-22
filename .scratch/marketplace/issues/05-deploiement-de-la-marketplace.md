# 05: Déploiement de l'index et du site sur Cloudflare Pages

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** `index.json`, les captures et le site sont en ligne sur un projet Cloudflare Pages gratuit, distinct de celui de l'Hôte, et redéployés à chaque fusion.

**Blocked by:** 02, 03, ticket 12 de tessello-v1 (compte Cloudflare et domaine)

**Status:** ready-for-agent

- [ ] `index.json` et les captures sont servis avec `Access-Control-Allow-Origin: *` (fichier `_headers`).
- [ ] Le déploiement est reproductible depuis le dépôt et documenté ; les quotas gratuits utilisés sont notés.
- [ ] L'adresse de l'index est fixée, et inscrite dans l'Hôte (ticket 06).
- [ ] La création du projet Cloudflare Pages ou d'un domaine n'est faite qu'avec l'accord explicite du Mainteneur.
