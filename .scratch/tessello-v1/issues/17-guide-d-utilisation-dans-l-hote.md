# 17: Lire le Guide d'utilisation d'un Module depuis le Lanceur

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Décision : ADR 0010.

**What to build:** Le bouton ⓘ d'un Module du Lanceur ouvre « About <Module> ». Ce dialogue montre l'identité du Module, le bouton « User guide », les Permissions accordées et la désinstallation. « User guide » affiche le Guide d'utilisation dans un grand dialogue, aux couleurs de l'Hôte, avec ses images, sans exécuter aucun code du Module.

**Blocked by:** 16 (Guide d'utilisation obligatoire dans la Convention et le Validateur)

**Status:** resolved

- [x] Le bouton ⓘ d'un Module actif s'appelle « About <nom> ». Son dialogue montre l'icône, le nom, la version, l'Identifiant et la description, puis le bouton « User guide », puis les Permissions accordées et « Uninstall… », comme avant.
- [x] « User guide » relit le Guide d'utilisation dans le dossier du Module, comme l'ouverture d'une Vue relit ses fichiers. Si le dossier a disparu ou n'est plus conforme, le dialogue le dit, au lieu d'afficher un Guide périmé.
- [x] Le Guide d'utilisation s'affiche dans un grand dialogue, dans une iframe sandbox sans `allow-scripts`, avec une CSP qui n'autorise que les images `data:` et les styles en ligne. Ce dialogue a deux boutons : « Back », qui revient à « About », et « Close ».
- [x] Le rendu suit la Convention :
  - le HTML brut apparaît comme du texte ;
  - les images relatives au Guide sont prises dans le paquet, et une image distante ou absente est remplacée par son texte alternatif ;
  - les liens `https:`, `http:` et `mailto:` s'ouvrent dans un nouvel onglet, les liens `#…` mènent au titre correspondant, et tout autre lien s'affiche comme du texte.
- [x] Les titres reçoivent un identifiant au format de GitHub (`## Your data` → `#your-data`), pour qu'un sommaire écrit dans le Guide fonctionne.
- [x] Le rendu est testé là où il est écrit : HTML brut, images, liens, identifiants des titres. Un test navigateur couvre le parcours : ⓘ, « User guide », Guide affiché avec son image, lien `#…` suivi, retour à « About ».

## Comments

### Décisions prises à l'écriture du ticket (2026-10-19)

- **Dans un dialogue, pas à la place de la Vue.** L'Utilisateur lit le Guide d'utilisation sans quitter la Vue ouverte, et rien n'est démonté ni rechargé.
- **Rendu par l'Hôte, affichage isolé.** L'Hôte convertit le Markdown avec `marked`. Le HTML brut est échappé, et l'iframe sans script et sa CSP rendent le résultat inerte, même si le rendu laissait passer quelque chose.
- **Hors périmètre** : le Guide d'utilisation sur l'écran d'accord, avant l'installation ; les Modules inactifs (nouveaux, en conflit, introuvables) ; un Guide par langue (voir le ticket 16).

### Implémentation (2026-10-19)

- **Nom accessible du bouton ⓘ : « About ».** Avec « About Notes », la recherche du bouton « Notes » trouvait aussi ce bouton-là, et quinze tests navigateur échouaient. Le nom du Module reste dans l'infobulle (« About Notes »), comme l'ancien bouton « Permissions ».
- **`<base href="about:srcdoc">`.** Sans cette balise, un lien `#…` se résout contre l'adresse de l'Hôte et charge l'Hôte dans l'iframe. Le test navigateur vérifie qu'après le clic, la page affiche toujours `about:srcdoc#your-data` et a défilé jusqu'au titre.
- **Rendu** : `packages/host/src/guide.ts` (`renderGuide`, `guideDocument`), avec `marked` en mode GFM. Les tâches à cocher et le texte barré s'affichent aussi.
