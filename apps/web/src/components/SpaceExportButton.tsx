/* Export complet d'un espace (items + arborescence) depuis la toolbar.
   CSV, Excel et PDF données passent par la fenêtre « Champs à exporter » (option fieldsExport d'ExportDropdownButton) ;
   JSON reste complet, PNG et PDF propre à une vue (`pdfExport`, ex. Vue Texte) restent directs. */
import type { Item, ExportFieldId } from '@spok/shared';
import type { ViewMode } from '../stores/viewMode';
import { buildExportFilename, exportCSV, exportJSON, exportExcel, exportDataPDF, exportContainerPNG } from '../lib/exportUtils';
import { ExportDropdownButton } from './ui/ExportDropdownButton';
import type { ExportOptionGroup } from './ui/ExportDropdownButton';

interface SpaceExportButtonProps {
  items: Item[];
  spaceName: string;
  viewMode?: ViewMode;
  viewContainerRef?: React.RefObject<HTMLDivElement>;
  /** Remplace l'export PDF par défaut (table de données) par un export propre à la vue appelante. */
  pdfExport?: () => void | Promise<void>;
}

type FormatSet = { csv: boolean; excel: boolean; json: boolean; pdf: boolean; png: boolean };

function getFormats(viewMode?: ViewMode): FormatSet {
  if (viewMode === 'pert')     return { csv: false, excel: false, json: false, pdf: true,  png: true  };
  if (viewMode === 'timeline') return { csv: true,  excel: true,  json: false, pdf: true,  png: true  };
  return                              { csv: true,  excel: true,  json: true,  pdf: true,  png: false };
}

export function SpaceExportButton({ items, spaceName, viewMode, viewContainerRef, pdfExport }: SpaceExportButtonProps) {
  const filename = buildExportFilename(spaceName, viewMode);
  const fmt = getFormats(viewMode);

  if (!items || items.length === 0) return null;

  const dataOptions = [
    ...(fmt.csv  ? [{ label: 'CSV (.csv)',    fieldsExport: { format: 'CSV', run: (f: ExportFieldId[]) => exportCSV(items, filename, f) } }] : []),
    ...(fmt.excel? [{ label: 'Excel (.xlsx)', fieldsExport: { format: 'Excel', run: (f: ExportFieldId[]) => exportExcel(items, filename, f) } }] : []),
    ...(fmt.json ? [{ label: 'JSON (.json)',  onClick: () => exportJSON(items, filename, spaceName) }] : []),
  ];
  const pdfOptions = fmt.pdf ? [pdfExport
    ? { label: 'PDF — données (.pdf)', onClick: pdfExport }
    : { label: 'PDF — données (.pdf)', fieldsExport: { format: 'PDF', run: (f: ExportFieldId[]) => exportDataPDF(items, filename, spaceName, f) } }] : [];
  const pngOptions = fmt.png && viewContainerRef ? [{ label: 'PNG — vue actuelle (.png)', onClick: () => viewContainerRef.current ? exportContainerPNG(viewContainerRef.current, filename) : Promise.resolve() }] : [];

  const groups: ExportOptionGroup[] = [
    ...(dataOptions.length ? [{ options: dataOptions }] : []),
    ...(pdfOptions.length  ? [{ options: pdfOptions }]  : []),
    ...(pngOptions.length  ? [{ options: pngOptions }]  : []),
  ];

  return <ExportDropdownButton groups={groups} />;
}
