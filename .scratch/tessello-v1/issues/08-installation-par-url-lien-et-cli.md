# 08: Installation par URL, lien d'installation et `tessello install`

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** L'Utilisateur installe un Module en collant l'URL de son `.zip` ou en ouvrant un lien d'installation, et le Créateur lance `tessello install` sur un dossier, un `.zip` ou une URL pour que l'Hôte s'ouvre avec le Module prêt à installer. Ce ticket tranche la deuxième question technique ouverte de la spec : comment transmettre un paquet local à l'Hôte dans le navigateur.

**Blocked by:** 04 (Premier Module dans le navigateur)

**Status:** ready-for-agent

- [ ] Coller l'URL d'un `.zip` télécharge le paquet et lance le même parcours que l'installation par fichier ; une erreur de téléchargement (réseau, CORS, fichier invalide) est expliquée.
- [ ] Un lien d'installation vers l'Hôte, portant l'URL d'un paquet, ouvre directement le parcours d'installation, sans jamais installer sans confirmation.
- [ ] `tessello install` accepte un dossier, un `.zip` ou une URL, valide d'abord le paquet et refuse, avec le rapport, un Module non conforme.
- [ ] Pour un dossier ou un `.zip` local, le mécanisme retenu est documenté, avec ses raisons et ses limites (restrictions d'accès au réseau local du navigateur, taille).
- [ ] L'adresse de l'Hôte ouverte par le CLI est celle du déploiement par défaut, et peut être changée pour un Hôte local en développement.
- [ ] Le CLI est couvert au point d'entrée B, et le lien d'installation par un test navigateur.
