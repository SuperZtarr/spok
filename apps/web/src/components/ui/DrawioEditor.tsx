import { useState, useRef, useCallback, useEffect } from 'react';
import { PenTool, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from './Button';

interface DrawioEditorProps {
  xml: string;
  onChange: (xml: string) => void;
  editable?: boolean;
}

const DRAWIO_URL = 'https://embed.diagrams.net/?embed=1&proto=json&spin=1&ui=dark&noSaveBtn=1&noExitBtn=1';

export function DrawioEditor({ xml, onChange, editable = true }: DrawioEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [svgPreview, setSvgPreview] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate SVG preview from XML
  useEffect(() => {
    if (!xml) {
      setSvgPreview('');
      return;
    }
    // Use a hidden iframe to export SVG
    const previewFrame = document.createElement('iframe');
    previewFrame.style.display = 'none';
    previewFrame.src = 'https://embed.diagrams.net/?embed=1&proto=json&spin=0&ui=min';

    const handlePreviewMessage = (evt: MessageEvent) => {
      if (evt.source !== previewFrame.contentWindow) return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.event === 'init') {
          previewFrame.contentWindow?.postMessage(
            JSON.stringify({ action: 'export', format: 'svg', xml }),
            '*'
          );
        } else if (msg.event === 'export') {
          setSvgPreview(msg.data);
          window.removeEventListener('message', handlePreviewMessage);
          previewFrame.remove();
        }
      } catch { /* ignore */ }
    };

    window.addEventListener('message', handlePreviewMessage);
    document.body.appendChild(previewFrame);

    return () => {
      window.removeEventListener('message', handlePreviewMessage);
      previewFrame.remove();
    };
  }, [xml]);

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
      } else if (msg.event === 'exit') {
        setIsEditing(false);
        setIsFullscreen(false);
      }
    } catch {
      /* ignore non-JSON messages */
    }
  }, [xml, onChange]);

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
            onClick={() => { setIsEditing(false); setIsFullscreen(false); }}
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

  // Preview mode
  return (
    <div className="space-y-2">
      {xml && svgPreview ? (
        <div
          className="border rounded-md p-4 bg-white dark:bg-gray-900 overflow-auto cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
          style={{ maxHeight: '400px' }}
          onClick={() => editable && setIsEditing(true)}
          title={editable ? 'Cliquer pour modifier' : undefined}
          dangerouslySetInnerHTML={{ __html: svgPreview }}
        />
      ) : xml ? (
        <div className="border rounded-md p-8 text-center text-muted-foreground">
          <PenTool className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Diagramme enregistré (aperçu en cours de chargement...)</p>
        </div>
      ) : (
        <div className="border rounded-md p-8 text-center text-muted-foreground border-dashed">
          <PenTool className="w-8 h-8 mx-auto mb-2 opacity-50" />
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
          <PenTool className="w-4 h-4 mr-1" />
          {xml ? 'Modifier le diagramme' : 'Créer un diagramme'}
        </Button>
      )}
    </div>
  );
}
