import type { Item } from '@spok/shared';
import type { ViewMode } from '../stores/viewMode';
import { buildExportFilename, exportCSV, exportJSON, exportExcel, exportDataPDF, exportContainerPNG } from '../lib/exportUtils';
import { ExportDropdownButton } from './ui/ExportDropdownButton';
import type { ExportOptionGroup } from './ui/ExportDropdownButton';

interface SpaceExportButtonProps {
  items: Item[];
  spaceName: string;
  viewMode?: ViewMode;
  viewContainerRef?: React.RefObject<HTMLDivElement>;
}

type FormatSet = { csv: boolean; excel: boolean; json: boolean; pdf: boolean; png: boolean };

function getFormats(viewMode?: ViewMode): FormatSet {
  if (viewMode === 'pert')     return { csv: false, excel: false, json: false, pdf: true,  png: true  };
  if (viewMode === 'timeline') return { csv: true,  excel: true,  json: false, pdf: true,  png: true  };
  return                              { csv: true,  excel: true,  json: true,  pdf: true,  png: false };
}

export function SpaceExportButton({ items, spaceName, viewMode, viewContainerRef }: SpaceExportButtonProps) {
  const filename = buildExportFilename(spaceName, viewMode);
  const fmt = getFormats(viewMode);

  if (!items || items.length === 0) return null;

  const dataOptions = [
    ...(fmt.csv  ? [{ label: 'CSV (.csv)',    onClick: () => exportCSV(items, filename) }] : []),
    ...(fmt.excel? [{ label: 'Excel (.xlsx)', onClick: () => exportExcel(items, filename) }] : []),
    ...(fmt.json ? [{ label: 'JSON (.json)',  onClick: () => exportJSON(items, filename, spaceName) }] : []),
  ];
  const pdfOptions = fmt.pdf ? [{ label: 'PDF — données (.pdf)', onClick: () => exportDataPDF(items, filename, spaceName) }] : [];
  const pngOptions = fmt.png && viewContainerRef ? [{ label: 'PNG — vue actuelle (.png)', onClick: () => viewContainerRef.current ? exportContainerPNG(viewContainerRef.current, filename) : Promise.resolve() }] : [];

  const groups: ExportOptionGroup[] = [
    ...(dataOptions.length ? [{ options: dataOptions }] : []),
    ...(pdfOptions.length  ? [{ options: pdfOptions }]  : []),
    ...(pngOptions.length  ? [{ options: pngOptions }]  : []),
  ];

  return <ExportDropdownButton groups={groups} />;
}
