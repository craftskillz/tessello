# 15: Import depuis living-documentation

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** L'Utilisateur reprend ses diagrammes, ses bibliothèques de formes et ses images de living-documentation. Il choisit les fichiers `.diagrams.json` et `.shape-libraries.json`, et éventuellement les images de son dossier `images/`.

**Blocked by:** 09 (Formes personnalisées), 10 (Liens)

**Status:** ready-for-agent

- [ ] L'action « Import » ouvre un sélecteur de fichiers multiple, qui accepte `.diagrams.json`, `.shape-libraries.json` et des images. Le choix d'un dossier n'est pas garanti dans une iframe sandbox : c'est à vérifier, et sinon la sélection multiple suffit.
- [ ] La lecture est défensive, comme pour le Survival Kit :
  - les éléments illisibles sont écartés ;
  - les valeurs inconnues reprennent leur défaut ;
  - un fichier qui n'est pas du JSON, ou qui n'a pas la forme attendue, est refusé avec un message.
- [ ] La conversion vers le modèle de la spec :
  - les nœuds `anchor` deviennent des extrémités **libres** ;
  - `fromPort`/`toPort` deviennent des extrémités attachées, et leur absence une extrémité automatique ;
  - `edgesStraight` devient le tracé de chaque flèche ;
  - les champs de style, de verrou, de groupe et de lien sont repris ;
  - `evidence`, `kind`, `renderAs` et `description` sont ignorés.
- [ ] Les images référencées (`imageSrc` des nœuds et des formes personnalisées) sont associées aux images choisies par leur nom de fichier, puis rangées comme au ticket 08. Une image non fournie donne le cadre « missing image », et un bilan indique les images manquantes.
- [ ] Les diagrammes importés **s'ajoutent** aux diagrammes existants, avec de nouveaux identifiants. Les liens entre diagrammes importés sont réécrits vers ces nouveaux identifiants. Les bibliothèques importées s'ajoutent aussi, et les références des formes sont réécrites.
- [ ] Une confirmation indique ce qui sera importé : le nombre de diagrammes, de bibliothèques, de formes et d'images, ainsi que les images manquantes. Si le quota ne suffit pas, l'import est refusé avant toute écriture.
- [ ] Tests unitaires : conversion de la fixture `living-documentation/tests/fixtures/with-diagrams/testdocs/.diagrams.json` et d'un cas qui couvre les extrémités libres, les points d'attache et les liens entre diagrammes.
- [ ] Test navigateur : import de cette fixture et d'une bibliothèque avec une image, puis rendu et rechargement.
