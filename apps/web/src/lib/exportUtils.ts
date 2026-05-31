import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toPng } from 'html-to-image';
import type { Item, ItemRelation } from '@spok/shared';
import { VIEW_REGISTRY } from '@spok/shared';
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

export function buildItemRows(items: Item[]) {
  const titleMap = new Map(items.map(i => [i.id, i.title]));
  return items.map(item => ({
    'Titre': item.title,
    'Type': item.type,
    'Statut': item.status || '',
    'Priorité': item.priority ?? '',
    'URL': item.url || '',
    'Parent': item.parentId ? (titleMap.get(item.parentId) || item.parentId) : '',
    'Assigné à': (item as any).assignedTo?.name || '',
    'Tags': item.tags?.map(t => t.name).join(', ') || '',
    'Date échéance': formatDate(item.dueDate),
    'Date début': formatDate(item.startDate),
    'Date fin': formatDate(item.endDate),
    'Créé le': formatDate(item.createdAt),
    'Modifié le': formatDate(item.updatedAt),
    'Description': stripHtmlSafe(item.description || ''),
  }));
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

export function exportCSV(items: Item[], filename: string) {
  const rows = buildItemRows(items);
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(';'), ...rows.map(row => headers.map(h => `"${String((row as any)[h]).replace(/"/g, '""')}"`).join(';'))].join('\n');
  downloadFile('﻿' + csv, `${filename}.csv`, 'text/csv;charset=utf-8');
}

export function exportJSON(items: Item[], filename: string, spaceName: string) {
  const data = {
    space: spaceName,
    exportedAt: new Date().toISOString(),
    items: items.map(item => ({
      id: item.id, type: item.type, title: item.title,
      description: item.description || null, url: item.url || null,
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

export function exportExcel(items: Item[], filename: string) {
  const wb = XLSX.utils.book_new();
  const wsItems = XLSX.utils.json_to_sheet(buildItemRows(items));
  XLSX.utils.book_append_sheet(wb, wsItems, 'Items');
  const relationRows = buildRelationRows(items);
  if (relationRows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(relationRows), 'Relations');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadFile(buf, `${filename}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export function exportDataPDF(items: Item[], filename: string, spaceName: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(16);
  doc.text(spaceName, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')} — ${items.length} élément${items.length > 1 ? 's' : ''}`, 14, 21);
  doc.setTextColor(0);
  const rows = buildItemRows(items);
  const columns = ['Titre', 'Type', 'Statut', 'Priorité', 'Assigné à', 'Tags', 'Date échéance', 'Date début', 'Date fin'];
  autoTable(doc, {
    startY: 26, head: [columns],
    body: rows.map(row => columns.map(col => (row as any)[col] || '')),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { 0: { cellWidth: 60 } },
    didParseCell: (data) => { if (data.column.index === 0 && data.cell.text.join('').length > 80) data.cell.text = [data.cell.text.join('').slice(0, 77) + '...']; },
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
