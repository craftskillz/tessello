# 07: Mise à jour et désinstallation

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** L'Utilisateur met à jour un Module en installant sa nouvelle version, sans perdre ses données ni accorder d'accès à son insu, et peut désinstaller un Module proprement (ADR 0003 et 0004).

**Blocked by:** 06 (Permissions : accord à l'installation et blocage réel)

**Status:** resolved

- [x] Installer un paquet dont l'Identifiant est déjà installé est présenté comme une mise à jour, avec le nom et la version installés et entrants, et demande une confirmation.
- [x] Une mise à jour remplace le code du Module et conserve son stockage.
- [x] Si la nouvelle version déclare des Permissions supplémentaires, seules celles-ci sont présentées et un nouvel accord est demandé ; en cas de refus, la version installée reste intacte.
- [x] La désinstallation demande confirmation, puis supprime le Module et son stockage.
- [x] Le Lanceur et l'Accueil reflètent immédiatement chaque installation, mise à jour et désinstallation.
- [x] Ces parcours sont couverts au point d'entrée C (règles) et par au moins un test navigateur (mise à jour avec nouvelle Permission).

## Comments

### Implémentation (2026-10-18)

- **Cœur de l'Hôte** (`packages/host-core`) :
  - `inspectZip` d'un paquet dont l'Identifiant est enregistré renvoie `update`, avec `installed` (nom lu dans le Manifeste sur disque, l'Identifiant à défaut ; version enregistrée ; dossier), `added` (les Permissions déclarées et non accordées) et `update()`. Rien n'est écrit avant `update()` ; refuser, c'est ne pas l'appeler.
  - `update()` cherche à nouveau le dossier qui déclare l'Identifiant (il a pu être renommé depuis), remplace son code (`folders.replace` : les nouveaux fichiers d'abord, puis la suppression des anciens ; `.git/` reste), puis met à jour le registre : version, dossier, et Permissions accordées réunies avec celles déclarées. Le stockage n'est pas touché. Un Module dont le dossier a disparu retrouve un dossier : son ancien nom s'il est libre, sinon un nom suffixé.
  - Un dossier qui déclare un Identifiant enregistré reste en `conflict` (ADR 0007) : seul un paquet est une mise à jour.
  - `uninstall(id)` supprime le stockage, puis le dossier s'il déclare encore l'Identifiant, puis l'enregistrement et la place sur l'Accueil. Interrompue, la désinstallation peut être relancée. Un dossier en conflit n'est pas supprimé et devient « new ».
  - La persistance gagne `folders.replace`, `folders.remove` et `storage.clear`, en mémoire et dans le Dossier des Modules.
- **Interface** (`packages/host/src/main.ts`) :
  - L'écran « Update <Module>? » montre le nom et la version installés et entrants, avertit si les noms diffèrent, affiche les avertissements du Validateur et, s'il y en a, seulement les Permissions ajoutées (« What <Module> can now also do ») avec « Accept and update » ; sinon le bouton est « Update ».
  - Après une mise à jour, le Widget est remonté et une Vue affichée est rouverte avec le nouveau code. Une Vue gardée derrière l'Accueil est abandonnée.
  - « Uninstall… » est dans la fenêtre des Permissions d'un Module actif et dans celle d'un Module introuvable. La confirmation nomme le dossier supprimé. La Vue et le Widget sont arrêtés avant la suppression, pour qu'ils n'écrivent plus dans le stockage supprimé.
  - Un échec de mise à jour ou de désinstallation est signalé, et le Lanceur et l'Accueil sont rafraîchis.
- **Tests** :
  - `host-core/test/modules.test.ts` : la présentation de la mise à jour, le remplacement du code avec conservation du stockage et de `.git/`, la différence de Permissions, le refus, un dossier renommé (et un autre dossier sous l'ancien nom, non touché), un dossier disparu, un dossier toujours en conflit. Pour la désinstallation : dossier, stockage, registre et Accueil, Module introuvable, dossier en conflit.
  - `host/e2e/update.test.ts` : une mise à jour de Notes qui ajoute une Permission `network` (refusée puis acceptée, la note conservée, le nouveau code affiché), et une désinstallation (annulée puis confirmée, le dossier et les données supprimés du dossier OPFS).
- **Limites** :
  - Une mise à jour interrompue peut laisser un mélange des deux versions, alors que le registre garde l'ancienne version. Aucun accès n'est gagné, car la CSP suit les Permissions enregistrées et `open()` bloque les Permissions ajoutées. L'Utilisateur n'est pas prévenu.
  - Le message de conflit est écrit deux fois dans `main.ts` (Lanceur et écran d'inspection).
