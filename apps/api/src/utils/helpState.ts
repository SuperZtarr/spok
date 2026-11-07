/*
 * Suivi de l'aide par compte : réponse au tutoriel d'accueil et annonces traitées, exposés par GET/PATCH /user/help-state.
 * resolveOnboardingDone : un compte qui n'a jamais répondu est « nouvel arrivant » seulement s'il a été créé après la mise en
 * place du suivi ; les comptes plus anciens connaissent déjà SPOK et reçoivent directement les nouveautés.
 * mergeHandled : ajoute et retire des identifiants sans écraser ceux d'un autre onglet ou d'un autre appareil.
 * Fonctions pures, sans accès à la base.
 */

/** Date de mise en place du suivi : les comptes créés avant ne se voient pas proposer le tutoriel d'accueil. */
export const HELP_STATE_SINCE = new Date('2026-11-07T00:00:00Z');

export function resolveOnboardingDone(stored: boolean | null, createdAt: Date): boolean {
  return stored ?? createdAt < HELP_STATE_SINCE;
}

export function mergeHandled(current: string[], add: string[] = [], remove: string[] = []): string[] {
  const removed = new Set(remove);
  return [...new Set([...current, ...add])].filter((id) => !removed.has(id));
}
