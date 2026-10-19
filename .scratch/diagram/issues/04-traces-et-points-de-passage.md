# 04: Tracé droit, courbe ou coudé, et points de passage

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** Chaque flèche choisit son tracé : droit, courbe ou coudé. On peut lui ajouter des points de passage pour lui donner des angles. Ce ticket remplace l'interrupteur global courbe/droit de l'original, et répond au manque « on ne peut pas ajouter de points à une flèche ».

**Blocked by:** 03 (Connexions)

**Status:** ready-for-agent

- [ ] Le panneau de flèche permet de choisir le tracé : **Straight**, **Curved** ou **Elbow**. La valeur par défaut vient des valeurs par défaut (ticket 11) ou est « Straight ». Les diagrammes importés de l'original reprennent leur ancien `edgesStraight` sur chaque flèche.
- [ ] Une flèche sélectionnée montre une poignée au milieu de chaque segment. La glisser crée un point de passage. Un point de passage se glisse, et un double-clic le retire. « Reset route » les retire tous.
- [ ] Un point de passage s'aligne exactement à l'horizontale ou à la verticale de son voisin quand il en est proche.
- [ ] Les points de passage ne bougent pas quand une forme se déplace. Seuls les segments d'extrémité suivent.
- [ ] Le tracé suit le mode choisi :
  - **Straight** : une ligne brisée qui passe par les points de passage ;
  - **Curved** : une courbe lisse qui passe par eux ;
  - **Elbow** : des segments horizontaux et verticaux calculés automatiquement, qui sortent perpendiculairement au côté de la forme (ou du point d'attache) ; glisser un segment intermédiaire le décale latéralement et crée les points de passage nécessaires.
- [ ] Une extrémité automatique vise le point de passage le plus proche, et non l'autre extrémité.
- [ ] La zone de clic (ticket 03) suit le tracé, quel que soit le mode.
- [ ] Tests unitaires : tracé de chaque mode, avec et sans points de passage ; alignement d'un point de passage ; sortie perpendiculaire d'un tracé coudé.
- [ ] Test navigateur : créer un coude par glisser, le retrouver après un rechargement, déplacer la forme d'arrivée, et sélectionner la flèche par un clic sur son dernier segment.
