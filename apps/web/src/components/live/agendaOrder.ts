/*
 * Règles de déplacement des lignes de la préparation côté client — miroir de PUT /live-sessions/:id/agenda/order :
 * l'animateur échange avec la voisine directe ; un présentateur n'échange sa ligne qu'avec SA ligne voisine
 * (les lignes des autres restent à leur position). moveTarget renvoie l'index cible ou null (bouton masqué).
 */
import type { LiveAgendaItem } from '@spok/shared';

export function moveTarget(agenda: LiveAgendaItem[], index: number, dir: -1 | 1, userId: string, isHost: boolean): number | null {
  if (isHost) {
    const j = index + dir;
    return j >= 0 && j < agenda.length ? j : null;
  }
  if (agenda[index]?.presenter.id !== userId) return null;
  for (let j = index + dir; j >= 0 && j < agenda.length; j += dir) {
    if (agenda[j].presenter.id === userId) return j;
  }
  return null;
}

export function swapIds(agenda: LiveAgendaItem[], i: number, j: number): string[] {
  const ids = agenda.map((a) => a.id);
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return ids;
}
