import { useState, useRef, useEffect } from 'react';
import { Download } from 'lucide-react';
import { Button } from './ui/Button';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import type { Item, ItemRelation } from '@spok/shared';
interface SpaceExportButtonProps {
  items: Item[];
  spaceName: string;
  viewContainerRef?: React.RefObject<HTMLDivElement>;
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

function exportPDF(items: Item[], spaceName: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Title
  doc.setFontSize(16);
  doc.text(spaceName, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')} — ${items.length} élément${items.length > 1 ? 's' : ''}`, 14, 21);
  doc.setTextColor(0);

  // Items table
  const rows = buildItemRows(items);
  const columns = ['Titre', 'Type', 'Statut', 'Priorité', 'Assigné à', 'Tags', 'Date échéance', 'Date début', 'Date fin'];

  autoTable(doc, {
    startY: 26,
    head: [columns],
    body: rows.map(row => columns.map(col => (row as any)[col] || '')),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 60 }, // Titre
    },
    didParseCell: (data) => {
      // Truncate long titles
      if (data.column.index === 0 && data.cell.text.join('').length > 80) {
        data.cell.text = [data.cell.text.join('').slice(0, 77) + '...'];
      }
    },
  });

  // Relations table on next page if any
  const relationRows = buildRelationRows(items);
  if (relationRows.length > 0) {
    doc.addPage();
    doc.setFontSize(14);
    doc.text('Relations', 14, 15);

    autoTable(doc, {
      startY: 22,
      head: [['De', 'Vers', 'Type', 'Commentaire']],
      body: relationRows.map(r => [r['De'], r['Vers'], r['Type'], r['Commentaire']]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
  }

  doc.save(`${sanitizeFilename(spaceName)}.pdf`);
}

async function exportViewPNG(container: HTMLDivElement, spaceName: string) {
  const canvas = await html2canvas(container, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(spaceName)}_vue.png`;
  a.click();
}

export function SpaceExportButton({ items, spaceName, viewContainerRef }: SpaceExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
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
      <Button variant="bordered" size="sm" onClick={() => setOpen(!open)} title="Exporter">
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
          <div className="h-px bg-border mx-2 my-1" />
          <button
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
            onClick={() => { exportPDF(items, spaceName); setOpen(false); }}
          >
            PDF — données (.pdf)
          </button>
          {viewContainerRef && (
            <button
              className="w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors disabled:opacity-50"
              disabled={capturing}
              onClick={async () => {
                if (!viewContainerRef.current) return;
                setCapturing(true);
                setOpen(false);
                try {
                  await exportViewPNG(viewContainerRef.current, spaceName);
                } finally {
                  setCapturing(false);
                }
              }}
            >
              {capturing ? 'Capture en cours…' : 'PNG — vue actuelle (.png)'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
