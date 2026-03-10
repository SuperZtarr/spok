import { useState, useRef, useEffect } from 'react';
import { Download } from 'lucide-react';
import { Button } from './ui/Button';
import * as XLSX from 'xlsx';
import type { Item, ItemRelation } from '@spok/shared';

interface SpaceExportButtonProps {
  items: Item[];
  spaceName: string;
}

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function formatDate(d?: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function buildItemRows(items: Item[]) {
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
    'Description': stripHtml(item.description || ''),
  }));
}

function buildRelationRows(items: Item[]) {
  const titleMap = new Map(items.map(i => [i.id, i.title]));
  const relations: { De: string; Vers: string; Type: string; Commentaire: string }[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const rels = (item as any).relationsFrom as ItemRelation[] | undefined;
    if (!rels) continue;
    for (const rel of rels) {
      if (seen.has(rel.id)) continue;
      seen.add(rel.id);
      relations.push({
        'De': titleMap.get(rel.fromItemId) || rel.fromItemId,
        'Vers': titleMap.get(rel.toItemId) || rel.toItemId,
        'Type': rel.type,
        'Commentaire': rel.label || '',
      });
    }
  }
  return relations;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 100);
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

function exportCSV(items: Item[], spaceName: string) {
  const rows = buildItemRows(items);
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(';'),
    ...rows.map(row => headers.map(h => {
      const val = String((row as any)[h]).replace(/"/g, '""');
      return `"${val}"`;
    }).join(';')),
  ].join('\n');
  downloadFile('\uFEFF' + csv, `${sanitizeFilename(spaceName)}.csv`, 'text/csv;charset=utf-8');
}

function exportJSON(items: Item[], spaceName: string) {
  const data = {
    space: spaceName,
    exportedAt: new Date().toISOString(),
    items: items.map(item => ({
      id: item.id,
      type: item.type,
      title: item.title,
      description: item.description || null,
      url: item.url || null,
      status: item.status || null,
      priority: item.priority ?? null,
      parentId: item.parentId || null,
      assignedToId: item.assignedToId || null,
      tags: item.tags?.map(t => t.name) || [],
      dueDate: item.dueDate || null,
      startDate: item.startDate || null,
      endDate: item.endDate || null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      relationsFrom: (item as any).relationsFrom || [],
      contributions: (item as any).contributions || [],
    })),
  };
  downloadFile(JSON.stringify(data, null, 2), `${sanitizeFilename(spaceName)}.json`, 'application/json');
}

function exportExcel(items: Item[], spaceName: string) {
  const wb = XLSX.utils.book_new();

  const itemRows = buildItemRows(items);
  const wsItems = XLSX.utils.json_to_sheet(itemRows);
  XLSX.utils.book_append_sheet(wb, wsItems, 'Items');

  const relationRows = buildRelationRows(items);
  if (relationRows.length > 0) {
    const wsRelations = XLSX.utils.json_to_sheet(relationRows);
    XLSX.utils.book_append_sheet(wb, wsRelations, 'Relations');
  }

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadFile(buf, `${sanitizeFilename(spaceName)}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export function SpaceExportButton({ items, spaceName }: SpaceExportButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (!items || items.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)} title="Exporter">
        <Download className="w-4 h-4 mr-1" />
        Exporter
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-card border rounded-lg shadow-lg py-1 z-50 min-w-[160px]">
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
            onClick={() => { exportCSV(items, spaceName); setOpen(false); }}
          >
            CSV (.csv)
          </button>
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
            onClick={() => { exportJSON(items, spaceName); setOpen(false); }}
          >
            JSON (.json)
          </button>
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
            onClick={() => { exportExcel(items, spaceName); setOpen(false); }}
          >
            Excel (.xlsx)
          </button>
        </div>
      )}
    </div>
  );
}
