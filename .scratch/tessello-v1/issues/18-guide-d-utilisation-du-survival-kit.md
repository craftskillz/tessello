# 18: Guide d'utilisation du Survival Kit

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Sources : le ticket 15 et la rétrodoc `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/survival-kit.md`.

**What to build:** Un Utilisateur qui réinstalle le Survival Kit ouvre ⓘ, puis « User guide ». Il y trouve un vrai mode d'emploi illustré : à quoi sert le kit, comment se servir du Widget et des trois panneaux, comment importer un kit de living-documentation, où vont ses données et que faire quand un message apparaît.

**Blocked by:** 17 (Lire le Guide d'utilisation d'un Module depuis le Lanceur)

**Status:** resolved

- [x] Le Guide d'utilisation est écrit en anglais, la langue par défaut du Module, dans `guide/guide.md` du paquet. Il commence par un sommaire dont les liens `#…` mènent aux sections.
- [x] Il couvre les parcours de la rétrodoc, adaptés au Module :
  - myTasks : ajout, priorités, filtres, modification, suppression ;
  - myNotes : notes, les cinq types de blocs, copie d'un bloc Code, modes lecture et édition ;
  - myLinks : catégories, liens, couleurs.
- [x] Il couvre aussi ce que le Module ajoute ou change par rapport à l'original : le Widget L, l'ouverture filtrée sur Urgent, l'import d'un `.survival-kit.json`, le thème et la langue qui suivent l'Hôte, l'ajout de `https://`, et les confirmations avant chaque suppression.
- [x] Une section « Your data » explique où le kit est rangé, et comment le sauvegarder ou le versionner. Elle précise que la Vue et le Widget partagent ce kit, et qu'une désinstallation l'efface.
- [x] Une section « When something goes wrong » reprend chaque message d'erreur du Module et dit quoi faire.
- [x] Des captures d'écran de la Vue et du Widget, prises sur le Module construit dans l'Hôte, illustrent le Guide. Le paquet reste bien sous la limite de 10 Mo.
- [x] Le paquet construit passe le Validateur sans erreur ni avertissement. Le test navigateur du Survival Kit ouvre son Guide d'utilisation depuis ⓘ.

## Comments

### Décisions prises à l'écriture du ticket (2026-10-19)

- **Anglais seulement.** L'Hôte n'affiche encore qu'un Guide d'utilisation par Module (ticket 16). La version française viendra avec les Guides par langue.
- **Captures produites par un script.** Elles sont prises dans l'Hôte construit, avec Playwright, à partir d'un kit d'exemple, pour qu'elles montrent le vrai Module.

### Implémentation (2026-10-19)

- **Guide** : `sample-modules/survival-kit/guide/guide.md`, avec sept captures dans `guide/images/` (environ 470 Ko). La vue d'ensemble est prise en densité 2×. Les gros plans sont pris en 1×, car le Markdown ne fixe pas la taille d'affichage d'une image et une capture 2× s'afficherait au double de sa taille.
- **Captures** : un script Playwright ponctuel, non versionné, installe le paquet construit dans l'Hôte construit et importe un kit d'exemple avec « Import a kit ». À reprendre si l'on veut régénérer les captures automatiquement, et peut-être à verser dans `scripts/`.
- **Le HTML brut s'affiche comme du texte** : le Guide n'utilise donc pas `<kbd>`, et les touches s'écrivent en gras.
