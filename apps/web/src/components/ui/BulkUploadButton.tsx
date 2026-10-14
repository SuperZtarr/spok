/*
 * Import en masse dans les vues Images et Documents : trois briques à partager l'état d'un même useBulkUpload.
 * - BulkUploadButton : bouton de la barre de vue (#view-header), sélection de fichiers multiple.
 * - BulkUploadDropZone : enveloppe le contenu de la vue, accepte le glisser-déposer de fichiers depuis
 *   l'explorateur (ignore les glisser internes dnd-kit : seuls les DataTransfer de type 'Files' comptent).
 * - BulkUploadStatus : bandeau de progression « 12/40 », puis bilan avec la liste des fichiers refusés.
 * Usage : `const bulk = useBulkUpload(spaceId, 'image')` dans la vue, puis passer `bulk` aux trois.
 * Ne s'affiche que si l'utilisateur peut éditer (la condition reste dans la vue, comme NewItemButton).
 */
import { useRef, useState, type ReactNode, type DragEvent } from 'react';
import { Upload, Loader2, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { useBulkUpload } from '../../hooks/useBulkUpload';
import { IMAGE_ACCEPTED_TYPES, type UploadKind } from '../../lib/uploadRules';

type BulkUpload = ReturnType<typeof useBulkUpload>;

const LABELS: Record<UploadKind, { button: string; drop: string }> = {
  image: { button: 'Importer des images', drop: 'Déposez vos images pour les importer' },
  document: { button: 'Importer des documents', drop: 'Déposez vos documents pour les importer' },
};

export function BulkUploadButton({ bulk, kind }: { bulk: BulkUpload; kind: UploadKind }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        data-tour="bulk-upload"
        onClick={() => inputRef.current?.click()}
        disabled={bulk.running}
        title={LABELS[kind].button}
        className="inline-flex items-center gap-1 h-7 px-2.5 rounded text-xs font-medium border border-border bg-background hover:bg-muted disabled:opacity-50 transition-colors flex-shrink-0"
      >
        {bulk.running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">{LABELS[kind].button}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={kind === 'image' ? IMAGE_ACCEPTED_TYPES.join(',') : undefined}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          void bulk.start(files);
        }}
      />
    </>
  );
}

function hasFiles(e: DragEvent) {
  return Array.from(e.dataTransfer.types).includes('Files');
}

export function BulkUploadDropZone({ bulk, kind, enabled, children }: {
  bulk: BulkUpload; kind: UploadKind; enabled: boolean; children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  if (!enabled) return <>{children}</>;
  return (
    <div
      className="relative flex flex-col flex-1 min-h-0"
      onDragOver={(e) => {
        if (!hasFiles(e) || bulk.running) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setOver(false);
        if (!bulk.running) void bulk.start(Array.from(e.dataTransfer.files));
      }}
    >
      {children}
      {over && (
        <div className="absolute inset-2 z-40 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 pointer-events-none">
          <span className="flex items-center gap-2 text-sm font-medium text-primary">
            <Upload className="w-5 h-5" /> {LABELS[kind].drop}
          </span>
        </div>
      )}
    </div>
  );
}

export function BulkUploadStatus({ bulk }: { bulk: BulkUpload }) {
  if (bulk.progress) {
    const { done, total } = bulk.progress;
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/40 text-xs flex-shrink-0">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        <span>Import en cours… {done}/{total}</span>
        <div className="flex-1 h-1.5 rounded bg-muted overflow-hidden max-w-xs">
          <div className="h-full bg-primary transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </div>
    );
  }
  if (!bulk.result) return null;
  const { succeeded, failures } = bulk.result;
  return (
    <div className="px-3 py-1.5 border-b border-border bg-muted/40 text-xs flex-shrink-0">
      <div className="flex items-center gap-2">
        {failures.length === 0
          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
          : <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
        <span>
          {succeeded} fichier{succeeded > 1 ? 's' : ''} importé{succeeded > 1 ? 's' : ''}
          {failures.length > 0 && `, ${failures.length} refusé${failures.length > 1 ? 's' : ''}`}
        </span>
        <button type="button" onClick={bulk.dismissResult} className="ml-auto p-0.5 rounded hover:bg-muted" title="Fermer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {failures.length > 0 && (
        <ul className="mt-1 max-h-32 overflow-auto space-y-0.5 text-muted-foreground">
          {failures.map((f, i) => (
            <li key={`${f.name}-${i}`} className="truncate"><span className="font-medium text-foreground">{f.name}</span> — {f.reason}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
