/*
 * Traduction XML exacte du document d'export brut (registre @spok/shared rawExport.ts, décision Thomas 2026-11-27).
 * Raison d'être : le même document en JSON ou en XML, sans perte — un fichier XML réimporté redonne le JSON d'origine.
 * Règles d'écriture (rawExportToXml) :
 *   - objet → un élément par clé ; liste → type="array", une entrée par valeur nommée par RAW_EXPORT_XML_LIST_ITEMS ;
 *   - nombre → type="number", booléen → type="boolean", null → nil="true", texte → contenu de l'élément ;
 *   - clé de RAW_EXPORT_OPAQUE_KEYS (JSON libre) → type="json", texte JSON ;
 *   - retour chariot écrit &#13; (sinon normalisé par la lecture XML) ; caractères interdits en XML 1.0 (contrôles hors
 *     tabulation et retours à la ligne) retirés.
 * rawExportFromXml lit ces annotations (fast-xml-parser, ordre conservé) et rend la valeur JavaScript ; le contrôle du
 * contenu (schéma) reste à utils/rawExport.ts. Ne jamais lire ces fichiers autrement : les types viennent des attributs.
 */
import { XMLParser } from 'fast-xml-parser';
import { RAW_EXPORT_XML_LIST_ITEMS, RAW_EXPORT_XML_ROOT, RAW_EXPORT_OPAQUE_KEYS } from '@spok/shared';

const OPAQUE = new Set<string>(RAW_EXPORT_OPAQUE_KEYS);
// eslint-disable-next-line no-control-regex
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
const CARRIAGE_RETURN = /\u000D/g;

function escapeText(s: string): string {
  return s.replace(INVALID_XML_CHARS, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(CARRIAGE_RETURN, '&#13;');
}

function writeValue(name: string, value: unknown, indent: string, out: string[]): void {
  if (value === null || value === undefined) { out.push(`${indent}<${name} nil="true"/>`); return; }
  if (OPAQUE.has(name)) { out.push(`${indent}<${name} type="json">${escapeText(JSON.stringify(value))}</${name}>`); return; }
  if (Array.isArray(value)) {
    if (value.length === 0) { out.push(`${indent}<${name} type="array"/>`); return; }
    out.push(`${indent}<${name} type="array">`);
    const entry = RAW_EXPORT_XML_LIST_ITEMS[name] ?? 'entry';
    for (const v of value) writeValue(entry, v, indent + '  ', out);
    out.push(`${indent}</${name}>`);
    return;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) { out.push(`${indent}<${name} type="object"/>`); return; }
    out.push(`${indent}<${name}>`);
    for (const [k, v] of entries) writeValue(k, v, indent + '  ', out);
    out.push(`${indent}</${name}>`);
    return;
  }
  if (typeof value === 'number') { out.push(`${indent}<${name} type="number">${String(value)}</${name}>`); return; }
  if (typeof value === 'boolean') { out.push(`${indent}<${name} type="boolean">${String(value)}</${name}>`); return; }
  out.push(`${indent}<${name}>${escapeText(String(value))}</${name}>`);
}

/** Document (objet JSON) → texte XML */
export function rawExportToXml(doc: object): string {
  const out: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', `<${RAW_EXPORT_XML_ROOT}>`];
  for (const [k, v] of Object.entries(doc)) writeValue(k, v, '  ', out);
  out.push(`</${RAW_EXPORT_XML_ROOT}>`);
  return out.join('\n') + '\n';
}

type OrderedNode = Record<string, unknown> & { ':@'?: Record<string, string> };

const isTextNode = (n: OrderedNode) => Object.prototype.hasOwnProperty.call(n, '#text');
const tagOf = (n: OrderedNode) => Object.keys(n).find((k) => k !== ':@')!;

function readNode(node: OrderedNode): unknown {
  const attrs = node[':@'] ?? {};
  if (attrs.nil === 'true') return null;
  const children = (node[tagOf(node)] as OrderedNode[]) ?? [];
  const text = children.filter(isTextNode).map((c) => String(c['#text'])).join('');
  const elements = children.filter((c) => !isTextNode(c));
  switch (attrs.type) {
    case 'array': return elements.map(readNode);
    case 'object': return Object.fromEntries(elements.map((c) => [tagOf(c), readNode(c)]));
    case 'number': { const n = Number(text.trim()); if (!Number.isFinite(n)) throw new Error(`Nombre invalide : ${text}`); return n; }
    case 'boolean': return text.trim() === 'true';
    case 'json': return JSON.parse(text);
    default:
      if (elements.length > 0) return Object.fromEntries(elements.map((c) => [tagOf(c), readNode(c)]));
      return text;
  }
}

/** Texte XML → document (objet JSON non contrôlé). Lève une erreur si le XML est illisible ou n'a pas la bonne racine. */
export function rawExportFromXml(xml: string): unknown {
  const parser = new XMLParser({
    preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: '',
    parseTagValue: false, parseAttributeValue: false, trimValues: false, processEntities: true, htmlEntities: true,
  });
  const nodes = parser.parse(xml) as OrderedNode[];
  const root = nodes.find((n) => !isTextNode(n) && tagOf(n) === RAW_EXPORT_XML_ROOT);
  if (!root) throw new Error(`Élément racine <${RAW_EXPORT_XML_ROOT}> absent`);
  const elements = ((root[RAW_EXPORT_XML_ROOT] as OrderedNode[]) ?? []).filter((c) => !isTextNode(c));
  return Object.fromEntries(elements.map((c) => [tagOf(c), readNode(c)]));
}
