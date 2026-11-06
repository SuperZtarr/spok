/*
 * Grille des vignettes de la Loupe (décision Thomas 2026-11-06) : ce qu'affiche un item selon son type et sa taille.
 * Le contenu est progressif : minimale = icône et titre (Image, Diagramme : leur image à la place de l'icône) ; intermédiaire et zoomée ajoutent les informations du tableau de
 * vignetteContent. Pour changer ce qu'une vignette montre, modifier ce fichier seul : LoupeVignette.tsx ne fait qu'afficher.
 * Document = pièce jointe et Image, Diagramme = image : leur fichier est dans `url`, passé par safeHref (adresse dangereuse
 * ignorée). Paramètres : item normalisé (VignetteSource), niveau de détail, libellés du type et du statut de l'espace.
 */
import { getPriorityConfig } from '../../constants/ui';
import { safeHref, htmlToText } from '../../lib/sanitizeHtml';
import { formatDate } from '../../lib/utils';

export type VignetteLevel = 'small' | 'mid' | 'big';

export interface VignetteSource {
  type: string;
  url?: string | null;
  priority?: number | null;
  dueDate?: string | Date | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  assigneeName?: string | null;
  childCount?: number;
  description?: string | null;
}

export interface VignetteContent {
  meta: string[];
  text?: string;
  textLines?: 1 | 4;
  imageUrl?: string;
  /** Adresse complète affichée en clair (Lien, zoomée) */
  address?: string;
  /** Bouton « Ouvrir » dans un nouvel onglet (Lien, Document, zoomée) */
  openHref?: string;
}

const DAY_MS = 86_400_000;
const LINE_MAX = 90;
const BLOCK_MAX = 320;

const isDefined = (value: string | null | undefined | false): value is string => !!value;

/** Image et Diagramme affichent une miniature : leur vignette est plus haute que les autres. */
export function hasImage(type: string, url: string | null | undefined): boolean {
  return (type === 'IMAGE' || type === 'DIAGRAM') && !!safeHref(url);
}

function excerpt(html: string | null | undefined, max: number): string | undefined {
  // Espace après chaque fin de bloc : sinon le texte colle les paragraphes
  const text = htmlToText((html ?? '').replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>|<br\s*\/?>/gi, '$& ')).replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function datesOf(item: VignetteSource): string | null {
  const parts = [item.startDate, item.endDate].filter(Boolean).map((d) => formatDate(d as string | Date));
  return parts.length ? parts.join(' → ') : null;
}

function dueOf(item: VignetteSource): string | null {
  return item.dueDate ? `Échéance ${formatDate(item.dueDate)}` : null;
}

function durationOf(item: VignetteSource): string | null {
  if (!item.startDate || !item.endDate) return null;
  const days = Math.round((new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / DAY_MS) + 1;
  if (days < 1) return null;
  return days === 1 ? '1 jour' : `${days} jours`;
}

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

/** Extension d'un fichier joint, sans les paramètres de l'adresse. Rien si ce n'est pas une extension plausible. */
export function fileExtension(url: string | null | undefined): string | null {
  const name = (url ?? '').split(/[?#]/)[0].split('/').pop() ?? '';
  const at = name.lastIndexOf('.');
  const extension = at > 0 ? name.slice(at + 1) : '';
  return /^[a-z0-9]{1,8}$/i.test(extension) ? extension.toUpperCase() : null;
}

const childrenOf = (count: number | undefined) => (!count ? null : count === 1 ? '1 enfant' : `${count} enfants`);

/**
 * | Type                    | Intermédiaire        | Zoomée : ajoute                         |
 * | Tâche, Anomalie         | statut, échéance     | priorité, assigné, description          |
 * | Projet                  | statut, dates        | enfants, assigné, description           |
 * | Réunion                 | date                 | assigné, description                    |
 * | Période                 | dates                | durée, description                      |
 * | Note                    | une ligne de texte   | description plus longue                 |
 * | Document                | extension            | description, bouton Ouvrir              |
 * | Lien                    | nom du site          | adresse, description, bouton Ouvrir     |
 * | Image, Diagramme        | miniature            | grande miniature                        |
 * | Autres                  | type, statut         | description                             |
 */
export function vignetteContent(item: VignetteSource, level: VignetteLevel, labels: { type: string; status: string | null }): VignetteContent {
  if (level === 'small') return hasImage(item.type, item.url) ? { meta: [], imageUrl: safeHref(item.url) } : { meta: [] };
  const big = level === 'big';
  const description = big ? excerpt(item.description, BLOCK_MAX) : undefined;
  const block = { text: description, textLines: 4 as const };
  const assignee = big ? item.assigneeName : null;
  const href = safeHref(item.url);

  switch (item.type) {
    case 'TASK':
    case 'BUG':
      return { ...block, meta: [labels.status, dueOf(item), big && getPriorityConfig(item.priority)?.label, assignee].filter(isDefined) };
    case 'PROJECT':
      return { ...block, meta: [labels.status, datesOf(item), big && childrenOf(item.childCount), assignee].filter(isDefined) };
    case 'MEETING':
      return { ...block, meta: [datesOf(item) ?? dueOf(item), assignee].filter(isDefined) };
    case 'PERIOD':
      return { ...block, meta: [datesOf(item), big && durationOf(item)].filter(isDefined) };
    case 'NOTE':
      return big ? { meta: [], ...block } : { meta: [], text: excerpt(item.description, LINE_MAX), textLines: 1 };
    case 'DOCUMENT':
      return { ...block, meta: [fileExtension(href)].filter(isDefined), openHref: big ? href : undefined };
    case 'LINK':
      return { ...block, meta: [hostOf(href)].filter(isDefined), address: big ? href : undefined, openHref: big ? href : undefined };
    case 'IMAGE':
    case 'DIAGRAM':
      return { meta: [], imageUrl: href };
    default:
      return { ...block, meta: [labels.type, labels.status].filter(isDefined) };
  }
}
