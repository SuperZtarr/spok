/*
 * Contenu calculé d'un bloc d'article (rendu par type, décision Thomas 2026-10-24) — fonctions pures, sans DOM :
 * - blockMetaLine(item) : ligne d'infos discrète sous l'intertitre, seulement pour les types où elle a du sens —
 *   MEETING : date + heures (fin du même jour = heure seule) ; TASK / BUG : statut · Échéance … · priorité ;
 *   PROJECT : plage de dates · statut ; PERIOD : plage de dates ; autres types → null. Champ vide ou date invalide :
 *   omis. Libellé de statut fourni par l'API (référentiels de l'espace d'origine), priorité via PRIORITIES.
 *   Le choix se fait sur le profil `display` du registre des types (task / project / meeting / period), pas sur le type.
 * - siteIconUrl(url) : icône du site d'un lien (https://origine/favicon.ico), null hors http(s). Calculée ici, sans
 *   passer par /url-meta ; l'image peut ne pas exister : ArticleBlock affiche alors l'icône de repli.
 * - blockContents(item) : contenus affichables de l'élément (adresse sûre ; schéma sans aperçu écarté), dans l'ordre
 *   reçu de l'API (Images, Fichiers, Liens, Schémas). Contenus multiples, lot 3a (2026-11-08).
 * - blockLayout(item) : 'figure' si l'élément ne porte que des images / schémas (image + légende, peut flotter),
 *   'links' s'il ne porte que des liens (cartes, texte dessous), sinon 'section' (intertitre, infos, texte, contenus).
 *   Le rendu suit les contenus, plus le type (règle article-block-display-by-contents).
 * Utilisé par ArticleBlock (lecture, Composer, impression) et ArticleEditor (habillage proposé si 'figure').
 */
import type { ArticleBlockContent, ArticleBlockView } from '@spok/shared';
import { getItemTypeDef } from '@spok/shared';
import { isSafeUrl } from '../../lib/sanitizeHtml';
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
  // Profil d'affichage du type : registre des types (display)
  switch (getItemTypeDef(item.type)?.display) {
    case 'meeting':
      return meetingWhen(item.startDate, item.endDate);
    case 'task':
      return join([
        item.statusLabel,
        valid(item.dueDate) ? `Échéance ${formatDate(item.dueDate)}` : null,
        item.priority != null ? PRIORITIES.find((p) => p.value === item.priority)?.label : null,
      ]);
    case 'project':
      return join([dateRange(item.startDate, item.endDate), item.statusLabel]);
    case 'period':
      return dateRange(item.startDate, item.endDate);
    default:
      return null;
  }
}

export function blockContents(item: Pick<BlockItem, 'contents'>): ArticleBlockContent[] {
  return (item.contents ?? []).filter((c) => !!c.url && isSafeUrl(c.url));
}

export type BlockLayout = 'figure' | 'links' | 'section';

export function blockLayout(item: Pick<BlockItem, 'contents'>): BlockLayout {
  const shown = blockContents(item);
  if (shown.length === 0) return 'section';
  if (shown.every((c) => c.kind === 'IMAGE' || c.kind === 'DIAGRAM')) return 'figure';
  if (shown.every((c) => c.kind === 'LINK')) return 'links';
  return 'section';
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
