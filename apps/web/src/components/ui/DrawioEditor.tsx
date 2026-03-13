import { useState, useRef, useCallback, useEffect } from 'react';
import { Workflow, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from './Button';

interface DrawioEditorProps {
  xml: string;
  onChange: (xml: string) => void;
  onImageExport?: (blob: Blob) => void;
  previewUrl?: string;
  editable?: boolean;
}

const DRAWIO_URL = 'https://embed.diagrams.net/?embed=1&proto=json&spin=1&ui=kennedy&noSaveBtn=1&noExitBtn=1';

export function DrawioEditor({ xml, onChange, onImageExport, previewUrl, editable = true }: DrawioEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingExportRef = useRef(false);

  // Handle messages from draw.io iframe
  const handleMessage = useCallback((evt: MessageEvent) => {
    if (!iframeRef.current || evt.source !== iframeRef.current.contentWindow) return;

    try {
      const msg = JSON.parse(evt.data);

      if (msg.event === 'init') {
        // Editor is ready — load the diagram
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
          iframeRef.current.contentWindow?.postMessage(
            JSON.stringify({ action: 'export', format: 'png', scale: 2 }),
            '*'
          );
        }
      } else if (msg.event === 'export' && pendingExportRef.current) {
        pendingExportRef.current = false;
        // msg.data is a base64 data URL
        if (onImageExport && msg.data) {
          fetch(msg.data)
            .then(r => r.blob())
            .then(blob => onImageExport(blob))
            .catch(() => {});
        }
      } else if (msg.event === 'exit') {
        // Request PNG export before closing
        if (onImageExport && xml) {
          pendingExportRef.current = true;
          iframeRef.current.contentWindow?.postMessage(
            JSON.stringify({ action: 'export', format: 'png', scale: 2 }),
            '*'
          );
          // Wait briefly for export, then close
          setTimeout(() => {
            setIsEditing(false);
            setIsFullscreen(false);
          }, 500);
        } else {
          setIsEditing(false);
          setIsFullscreen(false);
        }
      }
    } catch {
      /* ignore non-JSON messages */
    }
  }, [xml, onChange, onImageExport]);

  useEffect(() => {
    if (isEditing) {
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [isEditing, handleMessage]);

  // Escape to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreen]);

  // When closing editor, export PNG
  const handleClose = useCallback(() => {
    if (onImageExport && xml && iframeRef.current?.contentWindow) {
      pendingExportRef.current = true;
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ action: 'export', format: 'png', scale: 2 }),
        '*'
      );
      // Give time for the export message to come back
      setTimeout(() => {
        setIsEditing(false);
        setIsFullscreen(false);
      }, 500);
    } else {
      setIsEditing(false);
      setIsFullscreen(false);
    }
  }, [onImageExport, xml]);

  if (isEditing) {
    return (
      <div
        ref={containerRef}
        className={isFullscreen
          ? 'fixed inset-0 z-50 bg-background'
          : 'relative border rounded-md overflow-hidden'
        }
      >
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded bg-background/80 hover:bg-background border shadow-sm"
            title={isFullscreen ? 'Réduire' : 'Plein écran'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleClose}
          >
            Fermer
          </Button>
        </div>
        <iframe
          ref={iframeRef}
          src={DRAWIO_URL}
          className="w-full border-0"
          style={{ height: isFullscreen ? '100vh' : '600px' }}
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
          onClick={() => editable && setIsEditing(true)}
          title={editable ? 'Cliquer pour modifier' : undefined}
        >
          <img src={previewUrl} alt="Diagramme" className="max-w-full h-auto" />
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
