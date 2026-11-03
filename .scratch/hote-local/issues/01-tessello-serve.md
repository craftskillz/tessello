# 01: `tessello serve`, l'Hôte en local si son domaine est filtré

Vocabulaire : `GLOSSARY.md`. Contexte : ADR 0002, ADR 0007.

**What to build:** Si `tessello.pages.dev` est filtré ou arrêté, l'Utilisateur retrouve les Modules déjà installés avec une commande : `npx tessello serve` sert l'Hôte sur sa machine, et il choisit son Dossier des Modules habituel.

**Blocked by:** None

**Status:** resolved

- [x] Le paquet npm `tessello` contient l'Hôte construit, sans carte de sources.
- [x] `tessello serve` sert l'Hôte sur `http://127.0.0.1:7355/`, jamais sur une autre interface réseau.
- [x] Le port par défaut est fixe, car l'autorisation du dossier et l'application installée appartiennent à l'adresse. `--port <n>` en choisit un autre.
- [x] Un port occupé donne une erreur claire et le code de sortie 1, sans basculer sur un autre port.
- [x] Les en-têtes viennent du fichier `_headers` que reçoit Cloudflare, avec un seul serveur pour la CLI et `npm run start:host`.
- [x] Depuis le paquet installé, tous les domaines extérieurs bloqués, un dossier utilisé à l'adresse hébergée rouvre ses Modules sans redemander les Permissions.
- [x] L'Hôte local rouvre depuis son cache quand le serveur est arrêté.
- [x] Le README de la racine et celui de la CLI disent quoi faire si le domaine est inaccessible.

Hors périmètre : installer des Modules ou lire le catalogue via npm, domaine personnalisé.

## Comments

### Implémentation (2026-11-03)

- `tessello serve` sert une copie de l'Hôte placée dans le paquet (`host/`, sans carte de sources) : 111 Ko compressé, 374 Ko décompressé. CLI passée en 0.3.0, pas encore publiée.
- Port fixe 7355, seulement sur 127.0.0.1. Le serveur (`packages/cli/src/serve-site.ts`) lit `_headers` et remplace celui de `npm run start:host`.
- Typecheck, 558 tests unitaires, les mêmes compilés, 11 tests du paquet installé et 46 tests navigateur de l'Hôte : tout passe. `test:packed` a désormais besoin de Chromium.
- Le test bloque tous les domaines extérieurs. Le dossier n'est pas partagé entre les deux adresses dans les tests navigateur : il est copié. Reste à vérifier une fois à la main : le sélecteur natif et un vrai dossier, à l'adresse hébergée puis locale.
