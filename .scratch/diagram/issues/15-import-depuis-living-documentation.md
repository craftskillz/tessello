# 15: Import depuis living-documentation

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** L'Utilisateur reprend ses diagrammes, ses bibliothèques de formes et ses images de living-documentation. Il choisit les fichiers `.diagrams.json` et `.shape-libraries.json`, et éventuellement les images de son dossier `images/`.

**Blocked by:** 09 (Formes personnalisées), 10 (Liens)

**Status:** resolved

- [x] L'action « Import » ouvre un sélecteur de fichiers multiple, qui accepte `.diagrams.json`, `.shape-libraries.json` et des images. Le choix d'un dossier n'est pas garanti dans une iframe sandbox : c'est à vérifier, et sinon la sélection multiple suffit.
- [x] La lecture est défensive, comme pour le Survival Kit :
  - les éléments illisibles sont écartés ;
  - les valeurs inconnues reprennent leur défaut ;
  - un fichier qui n'est pas du JSON, ou qui n'a pas la forme attendue, est refusé avec un message.
- [x] La conversion vers le modèle de la spec :
  - les nœuds `anchor` deviennent des extrémités **libres** ;
  - `fromPort`/`toPort` deviennent des extrémités attachées, et leur absence une extrémité automatique ;
  - `edgesStraight` devient le tracé de chaque flèche ;
  - les champs de style, de verrou, de groupe et de lien sont repris ;
  - `evidence`, `kind`, `renderAs` et `description` sont ignorés.
- [x] Les images référencées (`imageSrc` des nœuds et des formes personnalisées) sont associées aux images choisies par leur nom de fichier, puis rangées comme au ticket 08. Une image non fournie donne le cadre « missing image », et un bilan indique les images manquantes.
- [x] Les diagrammes importés **s'ajoutent** aux diagrammes existants, avec de nouveaux identifiants. Les liens entre diagrammes importés sont réécrits vers ces nouveaux identifiants. Les bibliothèques importées s'ajoutent aussi, et les références des formes sont réécrites.
- [x] Une confirmation indique ce qui sera importé : le nombre de diagrammes, de bibliothèques, de formes et d'images, ainsi que les images manquantes. Si le quota ne suffit pas, l'import est refusé avant toute écriture.
- [x] Tests unitaires : conversion de la fixture `living-documentation/tests/fixtures/with-diagrams/testdocs/.diagrams.json` et d'un cas qui couvre les extrémités libres, les points d'attache et les liens entre diagrammes.
- [x] Test navigateur : import de cette fixture et d'une bibliothèque avec une image, puis rendu et rechargement.

## Comments

- L'action « Import » est dans la liste des diagrammes, à côté de « + Nouveau ». Elle ouvre une sélection multiple (`.json` et images). Le choix d'un dossier n'a pas été vérifié dans l'iframe sandbox ni ajouté : la sélection multiple suffit, comme le ticket le permet.
- La nature d'un fichier se lit à son contenu, pas à son nom : un tableau JSON est un `.diagrams.json`, un objet avec `libraries` un `.shape-libraries.json`. Un fichier refusé (pas du JSON, ou ni l'un ni l'autre) est nommé dans un message, et rien n'est importé.
- Les tailles, et la taille de texte (13), d'un nœud enregistré sans elles sont celles de l'éditeur d'origine, pour que le dessin garde sa géométrie. Une définition sans point d'attache reçoit les 8 points par défaut, comme dans l'original. Les angles passent des radians aux degrés. `edgeLabelOffsetX/Y` devient une place le long du trait et un écart, sur le tracé converti. La grille et les guides sont repris.
- Les images sont associées par leur nom de fichier, à la casse près. Seules les images référencées sont réduites et rangées (ticket 08). Une image non fournie, ou illisible, ou trop lourde, reçoit la clé `image:missing:<nom>`, qu'aucun stockage ne contient : elle est dessinée avec le cadre « missing image », et la confirmation la nomme.
- Chaque diagramme importé reçoit un nouvel identifiant, même si deux fichiers répètent le même. Un lien vers un diagramme non importé est gardé tel quel : il est signalé comme introuvable quand on le suit (ticket 10).
- Le quota est vérifié sur tout ce que l'import écrirait (images, bibliothèques, diagrammes, liste), avant la confirmation et avant toute écriture. Le premier diagramme importé s'ouvre ensuite.
