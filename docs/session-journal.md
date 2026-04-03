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
