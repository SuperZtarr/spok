import { useState, useRef, useCallback, useEffect } from 'react';
import { Workflow } from 'lucide-react';
import { Button } from './Button';

interface DrawioEditorProps {
  xml: string;
  onChange: (xml: string) => void;
  onImageExport?: (blob: Blob) => void;
  onSaveAndClose?: () => void;
  previewUrl?: string;
  editable?: boolean;
}

const DRAWIO_URL = 'https://embed.diagrams.net/?embed=1&proto=json&spin=1&ui=kennedy&saveAndExit=1&noExitBtn=1';

export function DrawioEditor({ xml, onChange, onImageExport, onSaveAndClose, previewUrl, editable = true }: DrawioEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingExportRef = useRef(false);
  const closeAfterExportRef = useRef(false);

  // Handle messages from draw.io iframe
  const handleMessage = useCallback((evt: MessageEvent) => {
    if (!iframeRef.current || evt.source !== iframeRef.current.contentWindow) return;

    try {
      const msg = JSON.parse(evt.data);

      if (msg.event === 'init') {
        iframeRef.current.contentWindow?.postMessage(
          JSON.stringify({
            action: 'load',
            xml: xml || '',
            autosave: 1,
          }),
          '*'
        );
      } else if (msg.event === 'autosave') {
        onChange(msg.xml);
      } else if (msg.event === 'save') {
        onChange(msg.xml);
        // Request PNG export after save
        if (onImageExport) {
          pendingExportRef.current = true;
          closeAfterExportRef.current = !!msg.exit;
          iframeRef.current.contentWindow?.postMessage(
            JSON.stringify({ action: 'export', format: 'png', scale: 2 }),
            '*'
          );
        } else if (msg.exit) {
          // No image export needed, just close and save
          setIsEditing(false);
          onSaveAndClose?.();
        }
      } else if (msg.event === 'export' && pendingExportRef.current) {
        pendingExportRef.current = false;
        if (onImageExport && msg.data) {
          fetch(msg.data)
            .then(r => r.blob())
            .then(blob => {
              onImageExport(blob);
              if (closeAfterExportRef.current) {
                closeAfterExportRef.current = false;
                setIsEditing(false);
                onSaveAndClose?.();
              }
            })
            .catch(() => {});
        }
      } else if (msg.event === 'exit') {
        setIsEditing(false);
      }
    } catch {
      /* ignore non-JSON messages */
    }
  }, [xml, onChange, onImageExport, onSaveAndClose]);

  useEffect(() => {
    if (isEditing) {
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [isEditing, handleMessage]);

  if (isEditing) {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 z-[100] bg-background"
      >
        <iframe
          ref={iframeRef}
          src={DRAWIO_URL}
          className="w-full h-full border-0"
        />
      </div>
    );
  }

  // Preview mode — show PNG from url, or placeholder
  return (
    <div className="space-y-2">
      {previewUrl ? (
        <div
          className="border rounded-md p-4 bg-white dark:bg-gray-900 overflow-auto cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
          style={{ maxHeight: '300px' }}
          onClick={() => editable && setIsEditing(true)}
          title={editable ? 'Cliquer pour modifier' : undefined}
        >
          <img src={previewUrl} alt="Diagramme" className="max-w-full h-auto max-h-[260px] object-contain mx-auto" />
        </div>
      ) : xml ? (
        <div
          className="border rounded-md p-8 text-center text-muted-foreground cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
          onClick={() => editable && setIsEditing(true)}
          title={editable ? 'Cliquer pour modifier' : undefined}
        >
          <Workflow className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Diagramme enregistré (cliquer pour voir)</p>
        </div>
      ) : (
        <div className="border rounded-md p-8 text-center text-muted-foreground border-dashed">
          <Workflow className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Aucun diagramme</p>
        </div>
      )}
      {editable && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsEditing(true)}
        >
          <Workflow className="w-4 h-4 mr-1" />
          {xml ? 'Modifier le diagramme' : 'Créer un diagramme'}
        </Button>
      )}
    </div>
  );
}
