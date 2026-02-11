import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, Loader2, Image as ImageIcon, ClipboardPaste } from 'lucide-react';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 Mo

interface ImageUploadZoneProps {
  currentUrl?: string | null;
  onUpload: (file: File) => void;
  onRemove?: () => void;
  isUploading?: boolean;
  disabled?: boolean;
}

export function ImageUploadZone({
  currentUrl,
  onUpload,
  onRemove,
  isUploading = false,
  disabled = false,
}: ImageUploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndUpload = useCallback(
    (file: File) => {
      setError(null);

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('Format non supporté. Utilisez JPEG, PNG, WebP ou GIF.');
        return;
      }

      if (file.size > MAX_SIZE) {
        setError('Fichier trop volumineux (max 5 Mo).');
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
      // Reset input for re-selection of same file
      e.target.value = '';
    },
    [validateAndUpload]
  );

  // Support Ctrl+V paste from clipboard (screenshots)
  useEffect(() => {
    if (disabled || isUploading || (currentUrl && !isUploading)) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            const file = new File([blob], `capture-${Date.now()}.png`, { type: blob.type });
            validateAndUpload(file);
          }
          return;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [disabled, isUploading, currentUrl, validateAndUpload]);

  // Display uploaded image
  if (currentUrl && !isUploading) {
    return (
      <div className="relative group">
        <img
          src={currentUrl}
          alt="Image uploadée"
          className="w-full max-h-64 object-contain rounded-lg border border-border bg-muted"
        />
        {onRemove && !disabled && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
            title="Supprimer l'image"
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
              <ImageIcon className="w-8 h-8 text-primary" />
            ) : (
              <Upload className="w-8 h-8 text-muted-foreground" />
            )}
            <div className="text-center">
              <span className="text-sm text-muted-foreground">
                Glissez une image, <span className="text-primary font-medium">cliquez pour sélectionner</span>
              </span>
              <p className="text-xs text-muted-foreground/70 mt-1 flex items-center justify-center gap-1">
                <ClipboardPaste className="w-3 h-3" /> ou Ctrl+V pour coller une capture
              </p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                JPEG, PNG, WebP, GIF — max 5 Mo
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
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
