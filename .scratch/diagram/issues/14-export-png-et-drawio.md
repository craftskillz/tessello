# 14: Export PNG et draw.io

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** L'Utilisateur télécharge la sélection ou le diagramme en PNG, et le diagramme en `.drawio` (parcours 12 et 13, sans les parties propres à living-documentation).

**Blocked by:** 04 (Tracés), 09 (Formes personnalisées), 13 (Hôte : téléchargements)

**Status:** ready-for-agent

### PNG

- [ ] « Export PNG » (Ctrl/Cmd+Maj+E) produit l'image de la sélection, ou de tout le diagramme si rien n'est sélectionné. Le rendu se fait **à partir du modèle**, et non par une capture de la vue : le contenu hors de l'écran est inclus (Q-017). Les flèches entre formes sélectionnées sont incluses.
- [ ] Le fond suit le thème courant, avec l'option « transparent ». L'échelle est de 2× pour la netteté. Le nom de fichier vient du titre nettoyé.

### draw.io

- [ ] « Export as drawio (.drawio) » télécharge un fichier qui contient :
  - les formes (styles draw.io équivalents) et leurs textes ;
  - les groupes ;
  - les flèches, avec leurs points d'attache (`exitX`/`entryX`…) et leurs points de passage, dans le style `edgeStyle` correspondant au tracé (`orthogonalEdgeStyle` pour le coudé, `curved=1` pour le courbe) ;
  - les étiquettes ;
  - les images, intégrées en data URL, ce qui les rend disponibles hors ligne puisqu'elles sont déjà dans le stockage.
- [ ] Les pertes connues sont signalées dans un message, comme dans l'original : les rotations d'étiquette indépendantes, que draw.io ne sait pas représenter.
- [ ] Le fichier s'ouvre dans draw.io (app.diagrams.net) avec le même aspect. C'est une vérification manuelle, faite une fois et notée dans les commentaires du ticket.

### Tests

- [ ] Tests unitaires : conversion d'un diagramme qui contient chaque type d'élément en XML draw.io (formes, points d'attache, points de passage, groupes, image intégrée).
- [ ] Tests navigateur : téléchargement d'un PNG dont les octets commencent par la signature PNG, puis téléchargement d'un `.drawio` analysable qui contient le bon nombre de cellules.
