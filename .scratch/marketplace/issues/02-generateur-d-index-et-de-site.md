# 02: Générateur de l'index et du site

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** À partir des fiches et des paquets, le Générateur produit `index.json` et les pages statiques du site de la Marketplace.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `index.json` (`format: 1`, date de génération) contient, pour chaque Module : la fiche, et ce qu'on tire du Manifeste de la dernière version (nom, description, icône, Permissions, Widgets, version de la Convention, Guide d'utilisation). Le format est documenté dans le paquet.
- [ ] Les Modules et versions bannis ou retirés restent dans l'index avec leur état (le format le prévoit dès maintenant, le ticket 04 l'alimente).
- [ ] Le site : une page de liste avec recherche (nom, description, tags, Créateur) et filtre par Permission ; une page par Module avec la fiche, le Guide rendu, les captures, le texte de l'ADR 0015 et un bouton « Install in Tessello » vers `https://<Hôte>/#install=<URL>`. Il est en anglais, sans dépendance à un service tiers.
- [ ] La recherche et le filtre sont une fonction partagée, que l'Hôte réutilise (ticket 06).
- [ ] Les Modules bannis ou retirés n'apparaissent ni dans la liste ni dans la recherche.
- [ ] Tests unitaires : des fiches vers l'index, recherche et filtre, un Module banni, un retiré, une version bannie.
