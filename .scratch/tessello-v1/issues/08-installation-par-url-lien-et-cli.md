# 08: Installation par URL, lien d'installation et `tessello install`

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** L'Utilisateur installe un Module en collant l'URL de son `.zip` ou en ouvrant un lien d'installation, et le Créateur lance `tessello install` sur un dossier, un `.zip` ou une URL pour que l'Hôte s'ouvre avec le Module prêt à installer. Ce ticket tranche la deuxième question technique ouverte de la spec : comment transmettre un paquet local à l'Hôte dans le navigateur.

**Blocked by:** 04 (Premier Module dans le navigateur)

**Status:** needs-triage

- [ ] Coller l'URL d'un `.zip` télécharge le paquet et lance le même parcours que l'installation par fichier ; une erreur de téléchargement (réseau, CORS, fichier invalide) est expliquée.
- [ ] Un lien d'installation vers l'Hôte, portant l'URL d'un paquet, ouvre directement le parcours d'installation, sans jamais installer sans confirmation.
- [ ] `tessello install` accepte un dossier, un `.zip` ou une URL, valide d'abord le paquet et refuse, avec le rapport, un Module non conforme.
- [ ] Pour un dossier ou un `.zip` local, le mécanisme retenu est documenté, avec ses raisons et ses limites (restrictions d'accès au réseau local du navigateur, taille).
- [ ] L'adresse de l'Hôte ouverte par le CLI est celle du déploiement par défaut, et peut être changée pour un Hôte local en développement.
- [ ] Le CLI est couvert au point d'entrée B, et le lien d'installation par un test navigateur.

## Comments

### À revoir après l'ADR 0007 (2026-10-18)

Un Module est désormais un dossier du Dossier des Modules. Il y entre par `git clone`, par copie, ou parce que son Créateur y travaille sur place. `tessello install <dossier>` n'a donc plus d'objet, et la question « comment transmettre un dossier local à l'Hôte » disparaît. Restent l'installation par URL, le lien d'installation et `tessello install <zip|url>` : leur utilité et leur forme sont à retrancher avant de passer ce ticket en `ready-for-agent`.

