# 11: Module d'exemple réseau local

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Un Module d'exemple « Prometheus local » (Permission `localNetwork`) montre comment un Module interroge un service de la machine de l'Utilisateur. Ce ticket tranche la troisième question technique ouverte de la spec : le comportement réel des navigateurs face aux requêtes vers le réseau local depuis une iframe sandbox servie par un site public.

**Blocked by:** 06 (Permissions : accord à l'installation et blocage réel)

**Status:** ready-for-agent

- [ ] Le Module passe le Validateur sans avertissement, et l'écran d'accord met en évidence sa Permission `localNetwork`.
- [ ] Il affiche l'état d'un Prometheus local, ou une explication claire quand le service est injoignable ou que le navigateur bloque l'accès.
- [ ] Le comportement de Chrome, Firefox et Safari (invite, blocage, conditions CORS) est vérifié et documenté pour les Créateurs.
- [ ] Si un navigateur rend `localNetwork` inutilisable, l'écart est signalé avec une proposition (documentation, Pont, révision de la Convention).
