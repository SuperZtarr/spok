/*
 * Fonctions d'export centralisées des vues : CSV, Excel, PDF (données et visuel), PNG, SVG
 * (PERT via canvas + inlining des styles). Utilisées par ExportDropdownButton dans chaque vue.
 * Champs exportés (CSV, Excel, PDF données) : choisis par l'utilisateur (ExportFieldsModal, mémorisés par espace via
 * useExportFields), colonnes dans l'ordre reçu ; liste des champs = registre shared EXPORT_FIELD_REGISTRY, valeurs =
 * EXPORT_FIELD_VALUES ci-dessous. Sans `fields`, tout le registre dans son ordre. Le JSON reste complet (export technique).
 */
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toPng } from 'html-to-image';
import type { Item, ItemRelation, ExportFieldId } from '@spok/shared';
import { VIEW_REGISTRY, EXPORT_FIELD_IDS, getExportFieldLabel, formatExternalRefs } from '@spok/shared';
import type { ViewMode } from '../stores/viewMode';

export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 100);
}

export function getViewLabel(viewMode?: ViewMode): string {
  if (!viewMode) return '';
  return VIEW_REGISTRY.find(v => v.id === viewMode)?.label ?? viewMode;
}

export function buildExportFilename(spaceName: string, viewMode?: ViewMode): string {
  const label = getViewLabel(viewMode);
  return sanitizeFilename(label ? `${spaceName} - ${label}` : spaceName);
}

function stripHtmlSafe(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

function formatDate(d?: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function downloadFile(content: string | ArrayBuffer, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Valeur exportée de chaque champ du registre EXPORT_FIELD_REGISTRY (Record strict : un champ ajouté au registre sans
 *  valeur ici casse la compilation). `titles` = titre de chaque item de l'export, pour la colonne Parent. */
export const EXPORT_FIELD_VALUES: Record<ExportFieldId, (item: Item, titles: Map<string, string>) => string | number> = {
  title: item => item.title,
  type: item => item.type,
  status: item => item.status || '',
  priority: item => item.priority ?? '',
  parent: (item, titles) => item.parentId ? (titles.get(item.parentId) || item.parentId) : '',
  assignee: item => (item as any).assignedTo?.name || item.assignedToName || '',
  tags: item => item.tags?.map(t => t.name).join(', ') || '',
  externalRefs: item => formatExternalRefs(item.externalRefs ?? []),
  createdBy: item => item.createdBy?.name || '',
  contents: item => (item.contents ?? []).map(c => c.name || c.url || c.value || '').filter(Boolean).join(', '),
  id: item => item.id,
  dueDate: item => formatDate(item.dueDate),
  startDate: item => formatDate(item.startDate),
  endDate: item => formatDate(item.endDate),
  createdAt: item => formatDate(item.createdAt),
  updatedAt: item => formatDate(item.updatedAt),
  description: item => stripHtmlSafe(item.description || ''),
};

/** Lignes de l'export : une par item, colonnes = `fields` dans l'ordre donné (défaut : tout le registre), clés = libellés. */
export function buildItemRows(items: Item[], fields: readonly ExportFieldId[] = EXPORT_FIELD_IDS): Record<string, string | number>[] {
  const titleMap = new Map(items.map(i => [i.id, i.title]));
  return items.map(item => {
    const row: Record<string, string | number> = {};
    for (const id of fields) row[getExportFieldLabel(id)] = EXPORT_FIELD_VALUES[id](item, titleMap);
    return row;
  });
}

export function buildRelationRows(items: Item[]) {
  const titleMap = new Map(items.map(i => [i.id, i.title]));
  const relations: { De: string; Vers: string; Type: string; Commentaire: string }[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const rels = (item as any).relationsFrom as ItemRelation[] | undefined;
    if (!rels) continue;
    for (const rel of rels) {
      if (seen.has(rel.id)) continue;
      seen.add(rel.id);
      relations.push({ 'De': titleMap.get(rel.fromItemId) || rel.fromItemId, 'Vers': titleMap.get(rel.toItemId) || rel.toItemId, 'Type': rel.type, 'Commentaire': rel.label || '' });
    }
  }
  return relations;
}

export function exportCSV(items: Item[], filename: string, fields: readonly ExportFieldId[] = EXPORT_FIELD_IDS) {
  const rows = buildItemRows(items, fields);
  if (rows.length === 0) return;
  const headers = fields.map(getExportFieldLabel);
  const csv = [headers.join(';'), ...rows.map(row => headers.map(h => `"${String(row[h]).replace(/"/g, '""')}"`).join(';'))].join('\n');
  downloadFile('﻿' + csv, `${filename}.csv`, 'text/csv;charset=utf-8');
}

export function exportJSON(items: Item[], filename: string, spaceName: string) {
  const data = {
    space: spaceName,
    exportedAt: new Date().toISOString(),
    items: items.map(item => ({
      id: item.id, type: item.type, title: item.title,
      description: item.description || null,
      status: item.status || null, priority: item.priority ?? null,
      parentId: item.parentId || null, assignedToId: item.assignedToId || null,
      tags: item.tags?.map(t => t.name) || [],
      dueDate: item.dueDate || null, startDate: item.startDate || null, endDate: item.endDate || null,
      createdAt: item.createdAt, updatedAt: item.updatedAt,
      relationsFrom: (item as any).relationsFrom || [],
      contributions: (item as any).contributions || [],
    })),
  };
  downloadFile(JSON.stringify(data, null, 2), `${filename}.json`, 'application/json');
}

export function exportExcel(items: Item[], filename: string, fields: readonly ExportFieldId[] = EXPORT_FIELD_IDS) {
  const wb = XLSX.utils.book_new();
  const wsItems = XLSX.utils.json_to_sheet(buildItemRows(items, fields), { header: fields.map(getExportFieldLabel) });
  XLSX.utils.book_append_sheet(wb, wsItems, 'Items');
  const relationRows = buildRelationRows(items);
  if (relationRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(relationRows), 'Relations');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadFile(buf, `${filename}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/** Longueur maximale d'une cellule Description dans le PDF données (tableau lisible ; CSV et Excel la gardent entière). */
const PDF_DESCRIPTION_MAX = 200;

export function exportDataPDF(items: Item[], filename: string, spaceName: string, fields: readonly ExportFieldId[] = EXPORT_FIELD_IDS) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(16);
  doc.text(spaceName, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')} — ${items.length} élément${items.length > 1 ? 's' : ''}`, 14, 21);
  doc.setTextColor(0);
  const rows = buildItemRows(items, fields);
  const columns = fields.map(getExportFieldLabel);
  const titleCol = fields.indexOf('title');
  const descCol = fields.indexOf('description');
  const clip = (text: string, max: number) => text.length > max ? text.slice(0, max - 3) + '...' : text;
  autoTable(doc, {
    startY: 26, head: [columns],
    body: rows.map(row => columns.map(col => String(row[col] ?? ''))),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: titleCol >= 0 ? { [titleCol]: { cellWidth: 60 } } : {},
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      if (data.column.index === titleCol) data.cell.text = [clip(data.cell.text.join(''), 80)];
      if (data.column.index === descCol) data.cell.text = [clip(data.cell.text.join(' '), PDF_DESCRIPTION_MAX)];
    },
  });
  const relationRows = buildRelationRows(items);
  if (relationRows.length > 0) {
    doc.addPage();
    doc.setFontSize(14);
    doc.text('Relations', 14, 15);
    autoTable(doc, {
      startY: 22, head: [['De', 'Vers', 'Type', 'Commentaire']],
      body: relationRows.map(r => [r['De'], r['Vers'], r['Type'], r['Commentaire']]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
  }
  doc.save(`${filename}.pdf`);
}

interface TextDocContribution {
  content: string;
  createdAt: string;
  author: { name: string };
}

interface TextDocItem {
  id: string;
  title: string;
  status?: string | null;
  description?: string | null;
  _depth?: number;
  contributions?: TextDocContribution[];
}

interface TextDocPortalGroup {
  spaceId: string;
  spaceName: string;
  items: TextDocItem[];
}

/**
 * Export PDF de la Vue Texte : reproduit le document affiché à l'écran (arbre, titres,
 * descriptions, contributions) plutôt que le tableau générique d'`exportDataPDF` — on reçoit
 * donc les items déjà triés/filtrés par TextView (recherche en cours, groupes portails inclus),
 * pas la liste brute de l'espace.
 */
export function exportTextDocumentPDF(
  mainItems: TextDocItem[],
  portalGroups: TextDocPortalGroup[],
  filename: string,
  spaceName: string,
  statusLabels: Record<string, string>,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageHeight = 297;
  const marginX = 14;
  const marginBottom = 15;
  const maxWidth = 210 - marginX * 2;
  let y = 15;

  doc.setFontSize(16);
  doc.text(spaceName, marginX, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')}`, marginX, y);
  doc.setTextColor(0);
  y += 8;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - marginBottom) {
      doc.addPage();
      y = 15;
    }
  };

  const writeLines = (text: string, x: number, width: number, fontSize: number, lineHeight: number) => {
    if (!text) return;
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, width);
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, x, y);
      y += lineHeight;
    }
  };

  const writeItem = (item: TextDocItem) => {
    const depth = item._depth || 0;
    const indent = marginX + depth * 6;
    const width = maxWidth - depth * 6;

    doc.setFontSize(depth === 0 ? 13 : 11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    const statusLabel = statusLabels[item.status || ''] || '';
    const titleLine = statusLabel ? `${item.title}  [${statusLabel}]` : item.title;
    for (const line of doc.splitTextToSize(titleLine, width)) {
      ensureSpace(6);
      doc.text(line, indent, y);
      y += 6;
    }
    doc.setFont('helvetica', 'normal');

    const description = stripHtmlSafe(item.description || '').trim();
    if (description) {
      doc.setTextColor(60);
      writeLines(description, indent, width, 9, 4.5);
      doc.setTextColor(0);
    }

    for (const c of item.contributions || []) {
      ensureSpace(5);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`${c.author.name} — ${formatDate(c.createdAt)}`, indent + 3, y);
      y += 4.5;
      doc.setTextColor(40);
      writeLines(stripHtmlSafe(c.content || '').trim(), indent + 3, width - 3, 8.5, 4.2);
      doc.setTextColor(0);
    }
    y += 3;
  };

  for (const item of mainItems) writeItem(item);

  for (const group of portalGroups) {
    ensureSpace(11);
    y += 4;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80);
    doc.text(group.spaceName, marginX, y);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    y += 7;
    for (const item of group.items) writeItem(item);
  }

  doc.save(`${filename}.pdf`);
}

function prepareSvgForExport(original: SVGSVGElement): SVGSVGElement {
  const clone = original.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  // Strip zoom transform so the full diagram renders at natural size
  clone.style.transform = '';
  clone.style.transformOrigin = '';

  // Walk original + clone in parallel: inline computed styles, replace foreignObject with <text>
  function walk(origEl: Element, cloneEl: Element) {
    if (origEl.tagName === 'foreignObject') {
      // Replace foreignObject with SVG <text> showing the item title
      const title = origEl.querySelector('span')?.textContent?.trim() || '';
      const x = parseFloat(origEl.getAttribute('x') || '4');
      const y = parseFloat(origEl.getAttribute('y') || '2');
      const h = parseFloat(origEl.getAttribute('height') || '28');
      const w = parseFloat(origEl.getAttribute('width') || '160');
      const ns = 'http://www.w3.org/2000/svg';
      const text = document.createElementNS(ns, 'text');
      text.setAttribute('x', String(x + 2));
      text.setAttribute('y', String(y + h / 2));
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-size', '11');
      text.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
      text.setAttribute('fill', '#1e293b');
      // Estimate max chars based on node width (~6px per char at font-size 11)
      const maxChars = Math.floor((w - 12) / 6);
      text.textContent = title.length > maxChars ? title.slice(0, maxChars - 1) + '…' : title;
      cloneEl.parentNode?.replaceChild(text, cloneEl);
      return; // no recursion into foreignObject
    }

    // Inline fill and stroke from computed styles (resolves CSS vars + Tailwind classes)
    const computed = window.getComputedStyle(origEl);
    const fill = computed.getPropertyValue('fill');
    const stroke = computed.getPropertyValue('stroke');
    const strokeWidth = computed.getPropertyValue('stroke-width');
    const opacity = computed.getPropertyValue('opacity');
    if (fill) (cloneEl as SVGElement).setAttribute('fill', fill);
    if (stroke) (cloneEl as SVGElement).setAttribute('stroke', stroke);
    if (strokeWidth) (cloneEl as SVGElement).setAttribute('stroke-width', strokeWidth);
    if (opacity && opacity !== '1') (cloneEl as SVGElement).setAttribute('opacity', opacity);

    const origChildren = Array.from(origEl.children);
    const cloneChildren = Array.from(cloneEl.children);
    origChildren.forEach((child, i) => { if (cloneChildren[i]) walk(child, cloneChildren[i]); });
  }

  walk(original, clone);
  return clone;
}

function svgToDataUri(svg: SVGSVGElement): string {
  const prepared = prepareSvgForExport(svg);
  const svgStr = new XMLSerializer().serializeToString(prepared);
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
}

async function svgToCanvas(svg: SVGSVGElement, scale = 2): Promise<HTMLCanvasElement> {
  const width = svg.width.baseVal.value;
  const height = svg.height.baseVal.value;
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = svgToDataUri(svg);
  });
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

export async function exportSvgAsPng(svg: SVGSVGElement, filename: string): Promise<void> {
  const canvas = await svgToCanvas(svg, 2);
  canvas.toBlob(blob => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.png`;
    a.click();
  }, 'image/png');
}

export async function exportSvgAsPdf(svg: SVGSVGElement, filename: string): Promise<void> {
  const width = svg.width.baseVal.value;
  const height = svg.height.baseVal.value;
  const canvas = await svgToCanvas(svg, 2);
  const dataUrl = canvas.toDataURL('image/png');
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: width > height ? 'landscape' : 'portrait', unit: 'px', format: [width, height] });
  doc.addImage(dataUrl, 'PNG', 0, 0, width, height);
  doc.save(`${filename}.pdf`);
}

const toPngOptions = (container: HTMLElement) => ({
  backgroundColor: '#ffffff' as const,
  skipFonts: true,
  filter: (node: Node) => {
    if (node instanceof HTMLImageElement && node.src && !node.src.startsWith(window.location.origin) && !node.src.startsWith('data:')) return false;
    return true;
  },
  width: container.scrollWidth,
  height: container.scrollHeight,
});

export async function exportContainerPNG(container: HTMLElement, filename: string) {
  const dataUrl = await toPng(container, toPngOptions(container));
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${filename}.png`;
  a.click();
}

export async function exportContainerPDF(container: HTMLElement, filename: string) {
  const dataUrl = await toPng(container, { ...toPngOptions(container), pixelRatio: 2 });
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>(r => { img.onload = () => r(); });
  const w = container.scrollWidth;
  const h = container.scrollHeight;
  const doc = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'px', format: [w, h] });
  doc.addImage(dataUrl, 'PNG', 0, 0, w, h);
  doc.save(`${filename}.pdf`);
}
