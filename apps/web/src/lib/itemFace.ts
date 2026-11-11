/*
 * Visage d'un élément (décision Thomas 2026-11-08, règle businessRules « item-vignette-format ») : ce qu'une vignette
 * montre, le même dans toutes les vues à format égal. Seule source de cette décision ; ItemVignette.tsx ne fait
 * qu'afficher, chaque vue ne garde que son cadre (glisser, menu ⋮, couleurs, colonnes).
 * Trois formats, contenu progressif :
 *   ligne  (Liste, arbre, Planning, MindMap, Loupe minimale) : miniature 24 px, titre, l'info la plus utile, pastilles
 *   carte  (Kanban, Activité, Favoris, Loupe intermédiaire)   : + infos du type, extrait 2 lignes, tags
 *   grande (Loupe zoomée, copie de vignette)                  : + toutes les infos, description 4 lignes, bouton Ouvrir
 * Miniature : première image, sinon premier schéma (son aperçu), sinon 1re page du premier fichier qui en a une (avec
 * son extension), sinon icône du type. Pastilles : nombre de contenus par sorte (Images, Fichiers, Liens, Schémas),
 * celui servant de miniature non compté. Extrait : description, sinon début du texte du premier fichier
 * (aperçu des fichiers, 2026-11-11, règle businessRules « item-contents-file-preview »).
 * Contenus lus dans item.contents (liste sans xml), seule source depuis le lot 4 (plus d'Item.url ni de repli par
 * type). Toute adresse passe par safeHref (dangereuse = ignorée).
 * Params : FaceSource (item normalisé), format, libellés du type et du statut dans l'espace.
 * Infos selon le type : profil `display` du registre des types (@spok/shared), jamais de test de type en dur.
 */
import type { ItemContentKind } from '@spok/shared';
import { ITEM_CONTENT_KINDS, getItemTypeDef } from '@spok/shared';
import { getPriorityConfig } from '../constants/ui';
import { safeHref, htmlToText } from './sanitizeHtml';
import { formatDate } from './utils';

export type VignetteFormat = 'ligne' | 'carte' | 'grande';

/** Contenu tel que les listes le renvoient (sans xml) */
export interface FaceContent {
  kind: ItemContentKind;
  url?: string | null;
  name?: string | null;
  /** FILE : image de la 1re page (aperçu calculé à l'envoi) */
  previewUrl?: string | null;
  /** FILE : début du texte */
  excerpt?: string | null;
}

export interface FaceSource {
  type: string;
  contents?: FaceContent[] | null;
  priority?: number | null;
  dueDate?: string | Date | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  assigneeName?: string | null;
  childCount?: number;
  description?: string | null;
}

export interface FaceCover {
  /** image : première image ; schema : aperçu du premier schéma ; document : 1re page du premier fichier qui en a
   *  une ; icon : icône du type */
  kind: 'image' | 'schema' | 'document' | 'icon';
  url?: string;
  /** document : extension du fichier (PDF, DOCX…), en pastille sur la miniature */
  label?: string;
}

const COVER_CONTENT_KIND: Record<FaceCover['kind'], ItemContentKind | null> = { image: 'IMAGE', schema: 'DIAGRAM', document: 'FILE', icon: null };

export interface ContentBadge {
  kind: ItemContentKind;
  count: number;
}

export interface ItemFace {
  cover: FaceCover;
  meta: string[];
  text?: string;
  textLines?: 2 | 4;
  badges: ContentBadge[];
  /** Adresse complète affichée en clair (contenu principal = lien, grande) */
  address?: string;
  /** Bouton « Ouvrir » du contenu principal (premier fichier, sinon premier lien), grande seulement */
  openHref?: string;
}

const DAY_MS = 86_400_000;
const CARD_TEXT_MAX = 180;
const BLOCK_MAX = 320;

const isDefined = (value: string | null | undefined | false): value is string => !!value;

/** Contenus de l'élément (liste vide si la route ne les renvoie pas) */
export function contentsOf(item: Pick<FaceSource, 'contents'>): FaceContent[] {
  return item.contents ?? [];
}

/** Miniature : première image, sinon premier schéma pourvu d'un aperçu, sinon 1re page du premier fichier qui en a
 *  une (aperçu des fichiers, 2026-11-11), sinon icône. */
export function coverOf(item: Pick<FaceSource, 'type' | 'contents'>): FaceCover {
  const contents = contentsOf(item);
  for (const [kind, coverKind] of [['IMAGE', 'image'], ['DIAGRAM', 'schema']] as const) {
    const url = contents.filter((c) => c.kind === kind).map((c) => safeHref(c.url)).find(Boolean);
    if (url) return { kind: coverKind, url };
  }
  const file = contents.find((c) => c.kind === 'FILE' && safeHref(c.previewUrl));
  if (file) {
    const label = fileExtension(file.name) ?? fileExtension(file.url);
    return { kind: 'document', url: safeHref(file.previewUrl)!, ...(label ? { label } : {}) };
  }
  return { kind: 'icon' };
}

/** Début du texte du premier fichier qui en a un (repli de l'extrait d'une vignette sans description) */
export function fileExcerptOf(item: Pick<FaceSource, 'contents'>): string | undefined {
  return contentsOf(item).find((c) => c.kind === 'FILE' && c.excerpt?.trim())?.excerpt?.trim();
}

/** Pastilles : nombre par sorte, dans l'ordre fixe, sans le contenu affiché en miniature. */
export function badgesOf(item: Pick<FaceSource, 'type' | 'contents'>, cover: FaceCover = coverOf(item)): ContentBadge[] {
  const contents = contentsOf(item);
  const coverKind = COVER_CONTENT_KIND[cover.kind];
  return ITEM_CONTENT_KINDS
    .map((kind) => ({ kind, count: contents.filter((c) => c.kind === kind).length - (kind === coverKind ? 1 : 0) }))
    .filter((badge) => badge.count > 0);
}

function excerpt(html: string | null | undefined, max: number): string | undefined {
  // Espace après chaque fin de bloc : sinon le texte colle les paragraphes
  const text = htmlToText((html ?? '').replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>|<br\s*\/?>/gi, '$& ')).replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function datesOf(item: FaceSource): string | null {
  const parts = [item.startDate, item.endDate].filter(Boolean).map((d) => formatDate(d as string | Date));
  return parts.length ? parts.join(' → ') : null;
}

const dueOf = (item: FaceSource) => (item.dueDate ? `Échéance ${formatDate(item.dueDate)}` : null);

function durationOf(item: FaceSource): string | null {
  if (!item.startDate || !item.endDate) return null;
  const days = Math.round((new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / DAY_MS) + 1;
  if (days < 1) return null;
  return days === 1 ? '1 jour' : `${days} jours`;
}

export function hostOf(url: string | null | undefined): string | null {
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

/** Contenu principal à ouvrir : premier fichier, sinon premier lien (adresse sûre seulement). */
function mainContent(contents: FaceContent[]): { kind: ItemContentKind; href: string; name?: string | null } | null {
  for (const kind of ['FILE', 'LINK'] as const) {
    const content = contents.find((c) => c.kind === kind && safeHref(c.url));
    if (content) return { kind, href: safeHref(content.url)!, name: content.name };
  }
  return null;
}

/** Info du contenu principal : extension d'un fichier, nom du site d'un lien. */
function mainInfo(main: ReturnType<typeof mainContent>): string | null {
  if (!main) return null;
  return main.kind === 'FILE' ? fileExtension(main.name || main.href) ?? fileExtension(main.href) : hostOf(main.href);
}

/**
 * | Type               | ligne               | carte                 | grande : ajoute                     |
 * | Tâche, Anomalie    | statut              | statut, échéance      | priorité, assigné                   |
 * | Projet             | statut              | statut, dates         | enfants, assigné                    |
 * | Réunion            | date                | date                  | assigné                             |
 * | Période            | dates               | dates                 | durée                               |
 * | Note               | —                   | —                     | —                                   |
 * | Élément (contenus) | extension ou site   | extension ou site     | adresse d'un lien, bouton Ouvrir    |
 * | Autres             | statut              | type, statut          | —                                   |
 * Texte : aucun en ligne, extrait 2 lignes en carte, description 4 lignes en grande.
 */
export function itemFace(item: FaceSource, format: VignetteFormat, labels: { type: string; status: string | null }): ItemFace {
  const contents = contentsOf(item);
  const cover = coverOf(item);
  const badges = badgesOf(item, cover);
  const big = format === 'grande';
  const main = mainContent(contents);
  const assignee = big ? item.assigneeName : null;

  let meta: (string | null | undefined | false)[];
  // Profil d'affichage du type : registre des types (display), jamais de test de type ici
  switch (getItemTypeDef(item.type)?.display) {
    case 'task':
      meta = format === 'ligne' ? [labels.status] : [labels.status, dueOf(item), big && getPriorityConfig(item.priority)?.label, assignee];
      break;
    case 'project':
      meta = format === 'ligne' ? [labels.status] : [labels.status, datesOf(item), big && childrenOf(item.childCount), assignee];
      break;
    case 'meeting':
      meta = [datesOf(item) ?? dueOf(item), assignee];
      break;
    case 'period':
      meta = [datesOf(item), big && durationOf(item)];
      break;
    case 'content':
      meta = [mainInfo(main)];
      break;
    default:
      meta = format === 'ligne' ? [labels.status] : [labels.type, labels.status];
  }

  const face: ItemFace = { cover, badges, meta: meta.filter(isDefined) };
  // Sans description, le début du premier fichier dit ce que l'élément contient (aperçu des fichiers)
  const max = big ? BLOCK_MAX : CARD_TEXT_MAX;
  const text = format === 'ligne' ? undefined : excerpt(item.description, max) ?? excerpt(fileExcerptOf(item), max);
  if (text) {
    face.text = text;
    face.textLines = big ? 4 : 2;
  }
  if (big && main) {
    face.openHref = main.href;
    if (main.kind === 'LINK') face.address = main.href;
  }
  return face;
}
