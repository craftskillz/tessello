# 01: Squelette : coller une URL YouTube, voir la vidéo, la retrouver

Spec parente : `.scratch/watch-later/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** La première tranche de bout en bout du Module Watch Later. On l'installe dans l'Hôte, on colle une URL YouTube, une carte apparaît avec la miniature, le titre et la chaîne, et elle est retrouvée après un rechargement. Ce ticket pose le paquet, le modèle de données et `parseYouTubeUrl`.

**Blocked by:** aucun

**Status:** resolved

### Paquet

- [x] `sample-modules/watch-later/` est construit comme le Survival Kit et Diagram (Svelte 5, esbuild, `scripts/build.ts`, `dist/` ignoré par git). L'identifiant est `@craftskills/watch-later`, avec une icône.
- [x] Le Manifeste déclare `"network": ["https://www.youtube.com", "https://i.ytimg.com"]`.
- [x] Un Guide d'utilisation minimal existe, car la Convention l'exige. Il est complété au ticket 06.
- [x] Le paquet passe le Validateur sans erreur ni avertissement. Le test des exemples couvre `sample-modules/watch-later`.
- [x] Le thème suit celui de l'Hôte, et la langue suit le `locale` (catalogues anglais et français dès ce ticket).

### Ajouter

- [x] `parseYouTubeUrl` reconnaît les formes d'URL de la spec, avec le timestamp, et rejette le reste. Elle est testée unitairement.
- [x] Un champ « Coller une URL YouTube » en haut de la Vue ajoute la vidéo sur Entrée ou au collage. Ctrl/Cmd+V ailleurs dans la Vue (hors d'un champ de saisie) ajoute aussi.
- [x] À l'ajout, la carte s'affiche aussitôt avec la miniature, puis le titre et la chaîne lus par l'oEmbed (`https://www.youtube.com/oembed?url=…&format=json`). Si l'oEmbed échoue, le titre est l'URL, et « Réessayer » relance la lecture.
- [x] La date d'ajout est enregistrée et affichée en date relative (« il y a 3 jours »).

### Afficher et ouvrir

- [x] Pour ce ticket, la Vue affiche une seule ligne « Toutes », les plus récentes en premier. Les lignes par tag arrivent au ticket 04.
- [x] Un clic sur la miniature ou le titre ouvre la vidéo sur YouTube dans un nouvel onglet, au timestamp s'il y en a un.

### Stockage

- [x] Les vidéos sont dans la clé `videos`, enregistrées à chaque modification. Un échec d'écriture est affiché, et un échec de lecture au démarrage bloque l'ajout.
- [x] Test navigateur (oEmbed et miniatures simulés) : coller une URL, voir le titre, recharger, la vidéo est toujours là.
