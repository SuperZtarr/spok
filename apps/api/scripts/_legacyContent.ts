/**
 * Correspondance « ancien champ → contenu » des scripts de données (contenus multiples). Était le pont API
 * src/utils/contentBridge.ts (lot 2), retiré au lot 4 (2026-11-11) avec Item.url : ne sert plus qu'aux scripts
 * backfill-item-contents.ts (recopie, lot 1) et migrate-item-types.ts (lot 4), qui lisent la colonne items.url
 * restée en base. Correspondance : IMAGE + url → IMAGE ; DOCUMENT + url → FILE ; LINK + url → LINK ;
 * DIAGRAM + content.xml → DIAGRAM (url = aperçu), sans xml → IMAGE ; tout autre type portant une url → LINK.
 * Ne pas importer depuis src/ : l'application ne lit plus jamais items.url.
 */
export type ContentKind = 'IMAGE' | 'FILE' | 'LINK' | 'DIAGRAM';

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json', zip: 'application/zip',
  drawio: 'application/vnd.jgraph.mxfile', xml: 'application/xml',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
};

/** Nom lisible tiré de l'adresse : dernier segment, sans le préfixe horodaté des envois R2 (« 1730000000000-») */
export function nameFromUrl(url: string): string | null {
  try {
    const last = decodeURIComponent(new URL(url, 'http://local').pathname.split('/').pop() || '');
    return last.replace(/^\d{10,}-/, '') || null;
  } catch { return null; }
}

export function mimeFromUrl(url: string): string | null {
  const ext = (nameFromUrl(url) ?? '').split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? null;
}

type LegacyItem = { id: string; type: string; url: string | null; content: unknown; createdById: string; createdAt: Date };
export type LegacyDraft = { itemId: string; kind: ContentKind; url: string | null; name: string | null;
  mimeType: string | null; xml: string | null; position: number; createdById: string; createdAt: Date };

/** xml draw.io rangé dans content.xml, ou undefined */
export function legacyXml(content: unknown): string | undefined {
  const xml = content && typeof content === 'object' ? (content as Record<string, unknown>).xml : undefined;
  return typeof xml === 'string' && xml.trim() ? xml : undefined;
}

/** Contenu à créer depuis l'ancien champ d'un élément, ou null si rien à recopier */
export function draftForLegacy(item: LegacyItem): LegacyDraft | null {
  const base = { itemId: item.id, position: 0, createdById: item.createdById, createdAt: item.createdAt, xml: null as string | null };
  const file = (kind: ContentKind, url: string): LegacyDraft => ({ ...base, kind, url, name: nameFromUrl(url), mimeType: mimeFromUrl(url) });
  switch (item.type) {
    case 'IMAGE': return item.url ? file('IMAGE', item.url) : null;
    case 'DOCUMENT': return item.url ? file('FILE', item.url) : null;
    case 'LINK': return item.url ? { ...base, kind: 'LINK', url: item.url, name: null, mimeType: null } : null;
    case 'DIAGRAM': {
      const xml = legacyXml(item.content);
      if (xml) return { ...base, kind: 'DIAGRAM', url: item.url, name: null, mimeType: null, xml };
      return item.url ? file('IMAGE', item.url) : null;
    }
    // Autre type portant une url (Note, Tâche…) : l'adresse est gardée en contenu Lien (lot 4, url abandonnée)
    default: return item.url ? { ...base, kind: 'LINK', url: item.url, name: null, mimeType: null } : null;
  }
}
