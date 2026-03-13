import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Item, ItemWithRelations, ContributionWithAuthor } from '@spok/shared';

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function formatDate(d?: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 100);
}

interface ItemExportData {
  item: ItemWithRelations;
  children?: Item[];
  spaceName?: string;
}

function buildPrintHtml(data: ItemExportData): string {
  const { item, children = [], spaceName } = data;
  const contributions = item.contributions || [];
  const relationsFrom = item.relationsFrom || [];
  const relationsTo = item.relationsTo || [];
  const tags = item.tags || [];

  const priorityLabels: Record<number, string> = { 1: 'Basse', 2: 'Normale', 3: 'Haute', 4: 'Urgente' };

  let html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${item.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.5; }
    h1 { font-size: 22px; margin-bottom: 8px; }
    .meta { color: #666; font-size: 13px; margin-bottom: 24px; border-bottom: 1px solid #e5e5e5; padding-bottom: 16px; }
    .meta span { margin-right: 16px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 14px; font-weight: 600; color: #333; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; }
    .description { font-size: 14px; line-height: 1.7; }
    .description img { max-width: 100%; height: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #e5e5e5; padding: 6px 10px; text-align: left; }
    th { background: #f5f7fa; font-weight: 600; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-right: 4px; border: 1px solid #e5e5e5; }
    .contribution { border-left: 3px solid #3b82f6; padding: 8px 12px; margin-bottom: 8px; background: #f9fafb; }
    .contribution .author { font-weight: 600; font-size: 13px; }
    .contribution .date { color: #999; font-size: 12px; }
    .contribution .content { font-size: 14px; margin-top: 4px; }
    .field { display: flex; gap: 8px; margin-bottom: 4px; font-size: 13px; }
    .field-label { font-weight: 600; min-width: 120px; color: #555; }
    .image-preview { max-width: 400px; max-height: 300px; border: 1px solid #e5e5e5; border-radius: 4px; margin-top: 8px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(item.title)}</h1>
  <div class="meta">
    <span><strong>Type :</strong> ${item.type}</span>
    ${item.status ? `<span><strong>Statut :</strong> ${item.status}</span>` : ''}
    ${item.priority ? `<span><strong>Priorité :</strong> ${priorityLabels[item.priority] || item.priority}</span>` : ''}
    ${spaceName ? `<span><strong>Espace :</strong> ${escapeHtml(spaceName)}</span>` : ''}
    <br/>
    <span><strong>Créé le :</strong> ${formatDate(item.createdAt)}</span>
    <span><strong>Modifié le :</strong> ${formatDate(item.updatedAt)}</span>
    ${item.assignedTo ? `<br/><span><strong>Assigné à :</strong> ${escapeHtml(item.assignedTo.name)}</span>` : ''}
    ${item.startDate ? `<span><strong>Début :</strong> ${formatDate(item.startDate)}</span>` : ''}
    ${item.endDate ? `<span><strong>Fin :</strong> ${formatDate(item.endDate)}</span>` : ''}
    ${item.dueDate ? `<span><strong>Échéance :</strong> ${formatDate(item.dueDate)}</span>` : ''}
  </div>`;

  // Tags
  if (tags.length > 0) {
    html += `<div class="section">
      <div class="section-title">Tags</div>
      <div>${tags.map(t => `<span class="tag" style="${t.color ? `border-color:${t.color};color:${t.color}` : ''}">${escapeHtml(t.name)}</span>`).join('')}</div>
    </div>`;
  }

  // Description
  if (item.description?.trim()) {
    html += `<div class="section">
      <div class="section-title">Description</div>
      <div class="description">${item.description}</div>
    </div>`;
  }

  // Image / Diagram preview
  if (item.url) {
    html += `<div class="section">
      <div class="section-title">${item.type === 'DIAGRAM' ? 'Diagramme' : 'Image'}</div>
      <img src="${escapeHtml(item.url)}" class="image-preview" />
    </div>`;
  }

  // Children
  if (children.length > 0) {
    html += `<div class="section">
      <div class="section-title">Éléments enfants (${children.length})</div>
      <table>
        <tr><th>Titre</th><th>Type</th><th>Statut</th><th>Priorité</th></tr>
        ${children.map(c => `<tr>
          <td>${escapeHtml(c.title)}</td>
          <td>${c.type}</td>
          <td>${c.status || '-'}</td>
          <td>${c.priority ? (priorityLabels[c.priority] || c.priority) : '-'}</td>
        </tr>`).join('')}
      </table>
    </div>`;
  }

  // Relations
  if (relationsFrom.length > 0 || relationsTo.length > 0) {
    html += `<div class="section">
      <div class="section-title">Relations</div>
      <table>
        <tr><th>Direction</th><th>Type</th><th>Commentaire</th></tr>
        ${relationsFrom.map(r => `<tr><td>→ sortante</td><td>${r.type}</td><td>${r.label || '-'}</td></tr>`).join('')}
        ${relationsTo.map(r => `<tr><td>← entrante</td><td>${r.type}</td><td>${r.label || '-'}</td></tr>`).join('')}
      </table>
    </div>`;
  }

  // Contributions
  if (contributions.length > 0) {
    html += `<div class="section">
      <div class="section-title">Contributions (${contributions.length})</div>
      ${(contributions as ContributionWithAuthor[]).map(c => `<div class="contribution">
        <div><span class="author">${escapeHtml((c as any).author?.name || 'Anonyme')}</span> <span class="date">${formatDate(c.createdAt)}</span></div>
        <div class="content">${c.content}</div>
      </div>`).join('')}
    </div>`;
  }

  html += '</body></html>';
  return html;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function printItem(data: ItemExportData) {
  const html = buildPrintHtml(data);
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
}

export function exportItemPDF(data: ItemExportData) {
  const { item, children = [], spaceName } = data;
  const contributions = (item.contributions || []) as ContributionWithAuthor[];
  const relationsFrom = item.relationsFrom || [];
  const relationsTo = item.relationsTo || [];
  const tags = item.tags || [];
  const priorityLabels: Record<number, string> = { 1: 'Basse', 2: 'Normale', 3: 'Haute', 4: 'Urgente' };

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = 15;

  // Title
  doc.setFontSize(18);
  doc.text(item.title, 14, y);
  y += 8;

  // Meta
  doc.setFontSize(9);
  doc.setTextColor(100);
  const metaParts = [
    `Type : ${item.type}`,
    item.status ? `Statut : ${item.status}` : '',
    item.priority ? `Priorité : ${priorityLabels[item.priority] || item.priority}` : '',
    spaceName ? `Espace : ${spaceName}` : '',
  ].filter(Boolean);
  doc.text(metaParts.join('  |  '), 14, y);
  y += 5;

  const dateParts = [
    `Créé : ${formatDate(item.createdAt)}`,
    `Modifié : ${formatDate(item.updatedAt)}`,
    item.assignedTo ? `Assigné à : ${item.assignedTo.name}` : '',
  ].filter(Boolean);
  doc.text(dateParts.join('  |  '), 14, y);
  y += 5;

  if (item.startDate || item.endDate || item.dueDate) {
    const dates = [
      item.startDate ? `Début : ${formatDate(item.startDate)}` : '',
      item.endDate ? `Fin : ${formatDate(item.endDate)}` : '',
      item.dueDate ? `Échéance : ${formatDate(item.dueDate)}` : '',
    ].filter(Boolean);
    doc.text(dates.join('  |  '), 14, y);
    y += 5;
  }

  doc.setTextColor(0);

  // Tags
  if (tags.length > 0) {
    doc.setDrawColor(200);
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont(undefined!, 'bold');
    doc.text('Tags', 14, y);
    y += 5;
    doc.setFont(undefined!, 'normal');
    doc.setFontSize(9);
    doc.text(tags.map(t => t.name).join(', '), 14, y);
    y += 6;
  }

  // Description
  if (item.description?.trim()) {
    doc.setDrawColor(200);
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont(undefined!, 'bold');
    doc.text('Description', 14, y);
    y += 5;
    doc.setFont(undefined!, 'normal');
    doc.setFontSize(9);
    const descText = stripHtml(item.description);
    const lines = doc.splitTextToSize(descText, 180);
    // Check if we need a new page
    if (y + lines.length * 4 > 280) {
      doc.addPage();
      y = 15;
    }
    doc.text(lines, 14, y);
    y += lines.length * 4 + 4;
  }

  // Children table
  if (children.length > 0) {
    if (y > 240) { doc.addPage(); y = 15; }
    doc.setDrawColor(200);
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont(undefined!, 'bold');
    doc.text(`Éléments enfants (${children.length})`, 14, y);
    doc.setFont(undefined!, 'normal');
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [['Titre', 'Type', 'Statut', 'Priorité']],
      body: children.map(c => [
        c.title,
        c.type,
        c.status || '-',
        c.priority ? (priorityLabels[c.priority] || String(c.priority)) : '-',
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: { 0: { cellWidth: 80 } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Relations
  if (relationsFrom.length > 0 || relationsTo.length > 0) {
    if (y > 250) { doc.addPage(); y = 15; }
    doc.setDrawColor(200);
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont(undefined!, 'bold');
    doc.text('Relations', 14, y);
    doc.setFont(undefined!, 'normal');
    y += 2;

    const relRows = [
      ...relationsFrom.map(r => ['→ sortante', r.type, r.label || '-']),
      ...relationsTo.map(r => ['← entrante', r.type, r.label || '-']),
    ];

    autoTable(doc, {
      startY: y,
      head: [['Direction', 'Type', 'Commentaire']],
      body: relRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Contributions
  if (contributions.length > 0) {
    if (y > 250) { doc.addPage(); y = 15; }
    doc.setDrawColor(200);
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont(undefined!, 'bold');
    doc.text(`Contributions (${contributions.length})`, 14, y);
    doc.setFont(undefined!, 'normal');
    y += 5;

    for (const c of contributions) {
      if (y > 270) { doc.addPage(); y = 15; }
      doc.setFontSize(9);
      doc.setFont(undefined!, 'bold');
      doc.text(`${(c as any).author?.name || 'Anonyme'} — ${formatDate(c.createdAt)}`, 14, y);
      doc.setFont(undefined!, 'normal');
      y += 4;
      const cText = stripHtml(c.content);
      const cLines = doc.splitTextToSize(cText, 180);
      if (y + cLines.length * 4 > 280) { doc.addPage(); y = 15; }
      doc.text(cLines, 14, y);
      y += cLines.length * 4 + 4;
    }
  }

  doc.save(`${sanitizeFilename(item.title)}.pdf`);
}
