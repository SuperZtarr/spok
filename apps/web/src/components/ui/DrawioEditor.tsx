/* Éditeur de diagrammes draw.io embarqué (iframe) : lit/écrit le XML dans item.content.
 * compact : aperçu seul qui remplit son cadre (vignette de la zone Contenus, 2026-11-11) — clic = éditeur plein écran. */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Workflow, Loader2 } from 'lucide-react';
import { Button } from './Button';

interface DrawioEditorProps {
  xml: string;
  onChange: (xml: string) => void;
  onSaveAndClose?: (xml: string, pngBlob: Blob) => Promise<void>;
  previewUrl?: string;
  editable?: boolean;
  /** Aperçu seul, remplissant son cadre (vignette de la zone Contenus) : clic = ouvrir l'éditeur plein écran */
  compact?: boolean;
}

const DRAWIO_URL = 'https://embed.diagrams.net/?embed=1&proto=json&spin=1&ui=kennedy&saveAndExit=1';

export function DrawioEditor({ xml, onChange, onSaveAndClose, previewUrl, editable = true, compact = false }: DrawioEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingExitRef = useRef(false);
  const savedXmlRef = useRef('');
  const initialXmlRef = useRef('');

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
        if (msg.exit && onSaveAndClose) {
          // "Save & Exit": request PNG export, then save everything
          pendingExitRef.current = true;
          savedXmlRef.current = msg.xml;
          setIsSaving(true);
          iframeRef.current.contentWindow?.postMessage(
            JSON.stringify({ action: 'export', format: 'png', scale: 2 }),
            '*'
          );
        } else if (msg.exit) {
          setIsEditing(false);
        }
        // Simple "Save" (no exit): just onChange, nothing else
      } else if (msg.event === 'export' && pendingExitRef.current) {
        pendingExitRef.current = false;
        const xmlToSave = savedXmlRef.current;
        if (onSaveAndClose && msg.data) {
          fetch(msg.data)
            .then(r => r.blob())
            .then(blob => onSaveAndClose(xmlToSave, blob))
            .then(() => {
              setIsSaving(false);
              setIsEditing(false);
            })
            .catch(() => {
              setIsSaving(false);
              setIsEditing(false);
            });
        } else {
          setIsSaving(false);
          setIsEditing(false);
        }
      } else if (msg.event === 'exit') {
        // Exit without save: restore original XML (autosave may have changed it)
        onChange(initialXmlRef.current);
        setIsEditing(false);
      }
    } catch {
      /* ignore non-JSON messages */
    }
  }, [xml, onChange, onSaveAndClose]);

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
        {isSaving && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
            <div className="flex items-center gap-3 rounded-lg bg-background px-6 py-4 shadow-lg">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">Sauvegarde en cours…</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  const startEditing = () => { if (editable) { initialXmlRef.current = xml; setIsEditing(true); } };

  // Aperçu compact (vignette de la zone Contenus) : remplit son cadre, clic = modifier, pas de bouton
  if (compact) {
    return (
      <button type="button" onClick={startEditing} disabled={!editable}
        className="flex h-full w-full items-center justify-center bg-white p-1 text-muted-foreground enabled:cursor-pointer enabled:hover:opacity-90 dark:bg-gray-900"
        title={editable ? (xml ? 'Cliquer pour modifier' : 'Cliquer pour dessiner') : undefined}>
        {previewUrl
          ? <img src={previewUrl} alt="Diagramme" className="h-full w-full object-contain" />
          : <span className="flex flex-col items-center gap-1 text-xs"><Workflow className="h-8 w-8 opacity-50" />{xml ? 'Sans aperçu' : 'Schéma vide'}</span>}
      </button>
    );
  }

  // Preview mode — show PNG from url, or placeholder
  return (
    <div className="space-y-2">
      {previewUrl ? (
        <div
          className="border rounded-md p-4 bg-white dark:bg-gray-900 overflow-auto cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
          style={{ maxHeight: '300px' }}
          onClick={() => { if (editable) { initialXmlRef.current = xml; setIsEditing(true); } }}
          title={editable ? 'Cliquer pour modifier' : undefined}
        >
          <img src={previewUrl} alt="Diagramme" className="max-w-full h-auto max-h-[260px] object-contain mx-auto" />
        </div>
      ) : xml ? (
        <div
          className="border rounded-md p-8 text-center text-muted-foreground cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
          onClick={() => { if (editable) { initialXmlRef.current = xml; setIsEditing(true); } }}
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
          variant="bordered"
          size="sm"
          onClick={() => { initialXmlRef.current = xml; setIsEditing(true); }}
        >
          <Workflow className="w-4 h-4 mr-1" />
          {xml ? 'Modifier le diagramme' : 'Créer un diagramme'}
        </Button>
      )}
    </div>
  );
}
