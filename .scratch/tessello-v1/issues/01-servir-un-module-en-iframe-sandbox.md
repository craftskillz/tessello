# 01: Servir un Module à une iframe sandbox avec blocage réseau

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Un prototype minimal tranche la première question technique ouverte de la spec : comment l'Hôte affiche les fichiers d'un Module, stockés localement, dans une iframe sandbox d'origine opaque (ADR 0001), tout en **bloquant réellement** les accès réseau non couverts par ses Permissions (ADR 0004). Il faut comparer au moins deux pistes, un service worker et une origine dédiée au contenu des Modules, et retenir celle qui applique effectivement la politique de sécurité de contenu aux requêtes et aux ressources de l'iframe. Le prototype peut être jetable ; c'est la décision qui compte.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Un prototype charge dans une iframe sandbox (sans `allow-same-origin`) une page et ses ressources relatives provenant d'un stockage local du navigateur.
- [ ] Dans ce prototype, une requête et une ressource distante vers une origine déclarée réussissent, et vers une origine non déclarée elles sont bloquées par le navigateur.
- [ ] Les fuites résiduelles connues (ouverture d'un lien dans un nouvel onglet, WebRTC) sont vérifiées et leur statut est noté.
- [ ] Le comportement est vérifié au moins sur Chrome et Firefox ; Safari est vérifié ou signalé comme non testé.
- [ ] La solution retenue, les pistes écartées et leurs raisons sont consignées dans un nouvel ADR, avec les conséquences pour l'hébergement sur Cloudflare Pages (en-têtes, domaines, coût).
- [ ] Une note indique ce que le ticket 04 doit reprendre du prototype.
