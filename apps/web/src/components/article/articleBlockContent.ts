/*
 * Contenu calculé d'un bloc d'article (rendu par type, décision Thomas 2026-10-24) — fonctions pures, sans DOM :
 * - blockMetaLine(item) : ligne d'infos discrète sous l'intertitre, seulement pour les types où elle a du sens —
 *   MEETING : date + heures (fin du même jour = heure seule) ; TASK / BUG : statut · Échéance … · priorité ;
 *   PROJECT : plage de dates · statut ; PERIOD : plage de dates ; autres types → null. Champ vide ou date invalide :
 *   omis. Libellé de statut fourni par l'API (référentiels de l'espace d'origine), priorité via PRIORITIES.
 * - siteIconUrl(url) : icône du site d'un lien (https://origine/favicon.ico), null hors http(s). Calculée ici, sans
 *   passer par /url-meta ; l'image peut ne pas exister : ArticleBlock affiche alors l'icône de repli.
 * Utilisé par ArticleBlock (lecture, Composer, impression).
 */
import type { ArticleBlockView } from '@spok/shared';
import { formatDate, formatDateTime } from '../../lib/utils';
import { PRIORITIES } from '../../constants/ui';

type BlockItem = NonNullable<ArticleBlockView['item']>;

const valid = (iso: string | null): iso is string => !!iso && !Number.isNaN(new Date(iso).getTime());

const timeOnly = (iso: string) => new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

function dateRange(start: string | null, end: string | null): string | null {
  const s = valid(start) ? formatDate(start) : null;
  const e = valid(end) ? formatDate(end) : null;
  if (s && e) return `du ${s} au ${e}`;
  if (s) return `à partir du ${s}`;
  if (e) return `jusqu’au ${e}`;
  return null;
}

function meetingWhen(start: string | null, end: string | null): string | null {
  if (valid(start) && valid(end)) return `${formatDateTime(start)} – ${sameDay(start, end) ? timeOnly(end) : formatDateTime(end)}`;
  if (valid(start)) return formatDateTime(start);
  if (valid(end)) return formatDateTime(end);
  return null;
}

const join = (parts: (string | null | undefined)[]) => {
  const kept = parts.filter((p): p is string => !!p);
  return kept.length ? kept.join(' · ') : null;
};

export function blockMetaLine(item: BlockItem): string | null {
  switch (item.type) {
    case 'MEETING':
      return meetingWhen(item.startDate, item.endDate);
    case 'TASK':
    case 'BUG':
      return join([
        item.statusLabel,
        valid(item.dueDate) ? `Échéance ${formatDate(item.dueDate)}` : null,
        item.priority != null ? PRIORITIES.find((p) => p.value === item.priority)?.label : null,
      ]);
    case 'PROJECT':
      return join([dateRange(item.startDate, item.endDate), item.statusLabel]);
    case 'PERIOD':
      return dateRange(item.startDate, item.endDate);
    default:
      return null;
  }
}

export function siteIconUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? `${u.origin}/favicon.ico` : null;
  } catch {
    return null;
  }
}
