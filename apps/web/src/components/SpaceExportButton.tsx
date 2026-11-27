/* Export d'un espace depuis la toolbar.
   CSV, Excel et PDF données passent par la fenêtre « Champs à exporter » (option fieldsExport d'ExportDropdownButton) ;
   PNG et PDF propre à une vue (`pdfExport`, ex. Vue Texte) restent directs.
   Données brutes (JSON, XML — 2026-11-27) : fichier réimportable produit par l'API pour tout l'espace et ses sous-espaces
   (pas seulement les éléments de la vue), formats du registre shared RAW_EXPORT_FILE_FORMATS ; espace = celui de l'adresse
   (/spaces/:spaceId). Remplace l'ancien export JSON à plat. Réimport : gestion de la communauté (RawImportModal). */
import { useParams } from 'react-router-dom';
import type { Item, ExportFieldId } from '@spok/shared';
import { RAW_EXPORT_FILE_FORMATS } from '@spok/shared';
import type { ViewMode } from '../stores/viewMode';
import { buildExportFilename, exportCSV, exportRawData, exportExcel, exportDataPDF, exportContainerPNG } from '../lib/exportUtils';
import { ExportDropdownButton } from './ui/ExportDropdownButton';
import type { ExportOptionGroup } from './ui/ExportDropdownButton';
import { SPACE_TOOLBAR_HINTS } from '../help/spaceToolbar.hints';

interface SpaceExportButtonProps {
  items: Item[];
  spaceName: string;
  viewMode?: ViewMode;
  viewContainerRef?: React.RefObject<HTMLDivElement>;
  /** Remplace l'export PDF par défaut (table de données) par un export propre à la vue appelante. */
  pdfExport?: () => void | Promise<void>;
}

type FormatSet = { csv: boolean; excel: boolean; pdf: boolean; png: boolean };

function getFormats(viewMode?: ViewMode): FormatSet {
  if (viewMode === 'pert')     return { csv: false, excel: false, pdf: true,  png: true  };
  if (viewMode === 'timeline') return { csv: true,  excel: true,  pdf: true,  png: true  };
  return                              { csv: true,  excel: true,  pdf: true,  png: false };
}

export function SpaceExportButton({ items, spaceName, viewMode, viewContainerRef, pdfExport }: SpaceExportButtonProps) {
  const { spaceId } = useParams<{ spaceId: string }>();
  const filename = buildExportFilename(spaceName, viewMode);
  const fmt = getFormats(viewMode);
  const hasItems = !!items && items.length > 0;

  if (!hasItems && !spaceId) return null;

  const dataOptions = hasItems ? [
    ...(fmt.csv  ? [{ label: 'CSV (.csv)',    fieldsExport: { format: 'CSV', run: (f: ExportFieldId[]) => exportCSV(items, filename, f) } }] : []),
    ...(fmt.excel? [{ label: 'Excel (.xlsx)', fieldsExport: { format: 'Excel', run: (f: ExportFieldId[]) => exportExcel(items, filename, f) } }] : []),
  ] : [];
  const pdfOptions = fmt.pdf && hasItems ? [pdfExport
    ? { label: 'PDF — données (.pdf)', onClick: pdfExport }
    : { label: 'PDF — données (.pdf)', fieldsExport: { format: 'PDF', run: (f: ExportFieldId[]) => exportDataPDF(items, filename, spaceName, f) } }] : [];
  const pngOptions = fmt.png && hasItems && viewContainerRef ? [{ label: 'PNG — vue actuelle (.png)', onClick: () => viewContainerRef.current ? exportContainerPNG(viewContainerRef.current, filename) : Promise.resolve() }] : [];
  const rawOptions = spaceId ? RAW_EXPORT_FILE_FORMATS.map(f => ({
    label: `${f.label} (.${f.extension})`, onClick: () => exportRawData(spaceId, spaceName, f.id),
  })) : [];

  const groups: ExportOptionGroup[] = [
    ...(dataOptions.length ? [{ options: dataOptions }] : []),
    ...(pdfOptions.length  ? [{ options: pdfOptions }]  : []),
    ...(pngOptions.length  ? [{ options: pngOptions }]  : []),
    ...(rawOptions.length  ? [{ title: 'Données brutes', hint: SPACE_TOOLBAR_HINTS.rawData, options: rawOptions }] : []),
  ];

  return <ExportDropdownButton groups={groups} />;
}
