# Session Journal - SPOK

## Accords permanents

> Procedures operationnelles (demarrage, commit, push, donnees) : voir `memory/procedures.md`

### Workflow Git
- Ne JAMAIS merger dans master ni pusher sans accord explicite de l'utilisateur
- Commiter sur la branche worktree (`claude/*`)
- Tester en local avant merge
- Merger et pusher uniquement quand l'utilisateur dit "merge et push"

### Communication
- Etre direct et factuel
- Instruction claire = executer, pas demander confirmation
- Ne pas proposer d'implementation non demandee

### Anti-tunnel
- 1 etape = 1 tour, presenter le plan avant de coder
- Si erreur : s'arreter, expliquer, attendre les instructions

### Documentation
- Specs techniques : `docs/specs/` (pour Claude, mecanismes et comportements)
- Doc fonctionnelle SPOK : a definir (cartographie par role/navigabilite)
- NE PAS creer d'items DOCUMENT dans SPOK apres chaque commit (ancien accord retire)

## EN COURS — 2026-04-16

- Fix cache logo : déplacé public/logo.png → src/assets/logo.png (import Vite hashé), 7 composants mis à jour
- MindMap : vignettes élargies max-w 200→260px, RADIAL_STEP 350→420, positionsStorageKey v2→v3

## EN COURS — 2026-04-15

- Nettoyage espaces doc : doublons Modèle de données annulés (102 items), Modales todos passés en cours
- Espaces restructurés : Pages publiques (cmnxnu81f01h8n856xt1fj4bo), Pages utilisateur (cmnxohuia01mln856b8bu9luo) créés
- Pages publiques groupées : Authentification / Accès par lien / Découverte
- Pages utilisateur groupées : Navigation globale / Visualisations globales
- Structure espace Interface utilisateur legacy vidée — à supprimer
- Organisation cible (cmnxq6a9d01rqn8569geutzga) enrichie dans Projet SPOK : arbre complet avec Visions Globales, Structure de la page, Administration, Modèle de données, Systèmes
- 37 vues d'espace créées et regroupées en 5 catégories (Tableau de bord, Basique, Types, Planification, Exploration)
- Vues globales groupées en 3 sections (Vues globales, Mes activités, Divers)
- Feat : champ description sur Space (schema Prisma, API, textarea settings, tooltip header)
- Fix seed : Role.ADMIN et Role.VIEWER n'existent pas dans l'enum → remplacés par Role.MEMBER
- Commit & push → prod Railway
- Prochaine étape : mettre à jour spok-doc skill avec descriptions fonctionnelles des espaces
- Feat : vignettes MindMap réorganisées + illustrations par type (favicon, date réunion, doc, image) — 5bdf57d
- Chore : cleanup 7 scripts tmp API, docs/technical ajoutés, MCP client + launch scripts, assets pub (favicon/logo), skills spok-rebuild + spok-tnr — c7343a5
- Deploy prod → push origin/master

## EN COURS — 2026-04-13

- Nettoyage CLAUDE Documentations : ~20 items annulés (doublons/obsolètes), ~63 items requalifiés en to_validate
- Items skills déplacés sous leur parent skill (SPOK START/DEPLOY/API/DOC/TNR/REBUILD) via script Python
- Nouvelles skills créées : spok-tnr (.claude/skills/spok-tnr/), spok-rebuild (.claude/skills/spok-rebuild/)
- settings.local.json : permissions ajoutées pour git worktree list, Chrome navigate/tabs
- Mémoire : feedback session-journal, reference_skills_spok.md (IDs items skills dans SPOK)
- Structure "Fichiers de consignes" créée dans CLAUDE Documentations (CLAUDE.md, Skills, Memory, docs/)
- Consignes skills rapatriées dans les skills concernées (côté utilisateur, branche worktree)

## EN COURS — 2026-04-12

- Push prod : 2 commits (e30f753 fix éclatement H2/H3 menus vues, 9fcd494 chore skills)
