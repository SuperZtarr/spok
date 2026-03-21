import { useMemo } from 'react';
import { FileText, Download, File, FileSpreadsheet, FileImage, FileArchive } from 'lucide-react';
import type { Item } from '@spok/shared';

function getFileIcon(url: string) {
  const ext = url.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return FileText;
  if (['doc', 'docx', 'odt', 'rtf', 'txt', 'md'].includes(ext)) return FileText;
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return FileSpreadsheet;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return FileImage;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return FileArchive;
  return File;
}

function getFileExtension(url: string): string {
  const parts = url.split('.');
  return parts.length > 1 ? parts.pop()!.toUpperCase() : '';
}

interface DocumentsViewProps {
  items: Item[] | undefined;
  onEdit?: (id: string) => void;
}

export function DocumentsView({ items, onEdit }: DocumentsViewProps) {
  const documents = useMemo(() => {
    if (!items) return [];
    return items.filter(item => item.type === 'DOCUMENT' && item.url);
  }, [items]);

  if (documents.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
          <p className="text-lg font-medium">Aucun document</p>
          <p className="text-sm text-muted-foreground">Cet espace ne contient aucun item de type DOCUMENT.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {documents.map(doc => {
          const Icon = getFileIcon(doc.url!);
          const ext = getFileExtension(doc.url!);
          return (
            <div
              key={doc.id}
              className="group flex items-start gap-3 p-3 rounded-lg border bg-card hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
              onClick={() => onEdit?.(doc.id)}
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.title}</p>
                {doc.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{doc.description}</p>
                )}
                {ext && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-medium bg-muted rounded">
                    {ext}
                  </span>
                )}
              </div>
              <a
                href={doc.url!}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-shrink-0 p-1 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                title="Telecharger"
              >
                <Download className="w-4 h-4 text-muted-foreground" />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
