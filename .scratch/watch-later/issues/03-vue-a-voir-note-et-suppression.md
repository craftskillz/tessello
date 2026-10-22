# 03: Statut vue / à voir, cacher les vues, note et suppression

Spec parente : `.scratch/watch-later/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Le détail d'une vidéo : on la marque comme vue ou à voir, on y écrit une note, on la supprime. Les vidéos vues peuvent être cachées, et ce choix est retenu.

**Blocked by:** 01 (Squelette)

**Status:** ready-for-agent

- [ ] Chaque carte a un bouton « Vue » / « À voir » qui bascule le statut (et `watchedAt`). Une vidéo vue est signalée sur sa carte.
- [ ] Un bouton « Détails » (ou un clic hors du titre et de la miniature) ouvre un panneau : titre, chaîne, date d'ajout, statut, note, suppression.
- [ ] La note est facultative, enregistrée quand on quitte le champ, et limitée à 2 000 caractères. Une carte qui a une note le montre (icône).
- [ ] « Supprimer » demande une confirmation dans une boîte de dialogue du Module.
- [ ] Un interrupteur « Cacher les vues », vrai par défaut, est enregistré dans la clé `settings` et retrouvé après un rechargement. Quand il est actif, marquer une vidéo comme vue la fait disparaître, avec un message « Marquée comme vue · Annuler ».
- [ ] Test navigateur : marquer une vidéo comme vue la cache, décocher « Cacher les vues » la montre, et une note survit au rechargement.
