import { useState, useRef, useCallback } from 'react';
import { Upload, X, Loader2, FileText, FileSpreadsheet, FileImage, FileArchive, File as FileIcon, Download } from 'lucide-react';

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'text/plain',
  'text/csv',
  'text/markdown',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/zip',
  'application/x-zip-compressed',
];

// Also accept by extension (some browsers report wrong MIME)
const ACCEPTED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.md',
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
  '.zip',
];

const MAX_SIZE = 25 * 1024 * 1024; // 25 Mo

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'pdf' || ext === 'doc' || ext === 'docx') return FileText;
  if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return FileSpreadsheet;
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) return FileImage;
  if (ext === 'zip') return FileArchive;
  return FileIcon;
}

function getFilenameFromUrl(url: string): string {
  try {
    const parts = url.split('/');
    const last = parts[parts.length - 1];
    // Remove timestamp prefix (e.g., "1707600000000-document.pdf" → "document.pdf")
    const match = last.match(/^\d+-(.+)$/);
    return match ? decodeURIComponent(match[1]) : decodeURIComponent(last);
  } catch {
    return 'Document';
  }
}

interface FileUploadZoneProps {
  currentUrl?: string | null;
  onUpload: (file: File) => void;
  onRemove?: () => void;
  isUploading?: boolean;
  disabled?: boolean;
}

export function FileUploadZone({
  currentUrl,
  onUpload,
  onRemove,
  isUploading = false,
  disabled = false,
}: FileUploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndUpload = useCallback(
    (file: File) => {
      setError(null);

      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const mimeOk = ACCEPTED_TYPES.includes(file.type);
      const extOk = ACCEPTED_EXTENSIONS.includes(ext);

      if (!mimeOk && !extOk) {
        setError('Format non supporté. Utilisez PDF, Office, texte, images ou archives.');
        return;
      }

      if (file.size > MAX_SIZE) {
        setError('Fichier trop volumineux (max 25 Mo).');
        return;
      }

      onUpload(file);
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (disabled || isUploading) return;

      const file = e.dataTransfer.files[0];
      if (file) validateAndUpload(file);
    },
    [disabled, isUploading, validateAndUpload]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !isUploading) setDragActive(true);
    },
    [disabled, isUploading]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndUpload(file);
      e.target.value = '';
    },
    [validateAndUpload]
  );

  // Display uploaded file
  if (currentUrl && !isUploading) {
    const filename = getFilenameFromUrl(currentUrl);
    const Icon = getFileIcon(filename);

    return (
      <div className="relative group flex items-center gap-3 p-3 border border-border rounded-lg bg-muted/30">
        <Icon className="w-8 h-8 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{filename}</p>
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Download className="w-3 h-3" />
            Télécharger
          </a>
        </div>
        {onRemove && !disabled && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
            title="Supprimer le fichier"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/50'
        } ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isUploading ? (
          <>
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <span className="text-sm text-muted-foreground">Upload en cours...</span>
          </>
        ) : (
          <>
            {dragActive ? (
              <FileText className="w-8 h-8 text-primary" />
            ) : (
              <Upload className="w-8 h-8 text-muted-foreground" />
            )}
            <div className="text-center">
              <span className="text-sm text-muted-foreground">
                Glissez un fichier, <span className="text-primary font-medium">cliquez pour sélectionner</span>
              </span>
              <p className="text-xs text-muted-foreground/70 mt-1">
                PDF, Office, texte, images, archives — max 25 Mo
              </p>
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={[...ACCEPTED_EXTENSIONS, ...ACCEPTED_TYPES].join(',')}
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
