import { useState, useRef, useCallback } from 'react';
import { GripVertical, ZoomIn } from 'lucide-react';

interface CoverPositionEditorProps {
  coverUrl: string;
  position: number; // 0-100
  zoom: number; // 100-300
  onSave: (position: number, zoom: number) => void;
}

export function CoverPositionEditor({ coverUrl, position, zoom, onSave }: CoverPositionEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localPosition, setLocalPosition] = useState(position);
  const [localZoom, setLocalZoom] = useState(zoom);

  const currentPos = dragging ? localPosition : position;
  const currentZoom = localZoom;
  const hasChanges = currentPos !== position || currentZoom !== zoom;

  const handleMove = useCallback((clientY: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const y = clientY - rect.top;
    const pct = Math.max(0, Math.min(100, (y / rect.height) * 100));
    setLocalPosition(Math.round(pct));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    handleMove(e.clientY);

    const onMouseMove = (ev: MouseEvent) => handleMove(ev.clientY);
    const onMouseUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [handleMove]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setDragging(true);
    handleMove(e.touches[0].clientY);

    const onTouchMove = (ev: TouchEvent) => {
      ev.preventDefault();
      handleMove(ev.touches[0].clientY);
    };
    const onTouchEnd = () => {
      setDragging(false);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
  }, [handleMove]);

  const handleSave = () => {
    onSave(localPosition, localZoom);
  };

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="relative aspect-[5/1] rounded-lg overflow-hidden border cursor-ns-resize select-none"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <img
          src={coverUrl}
          alt="Cover"
          className="w-full h-full object-cover pointer-events-none"
          style={{
            objectPosition: `center ${currentPos}%`,
            transform: `scale(${currentZoom / 100})`,
            transformOrigin: `center ${currentPos}%`,
          }}
          draggable={false}
        />
        <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <div className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <GripVertical className="w-3.5 h-3.5" />
            Glissez pour repositionner
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ZoomIn className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <input
          type="range"
          min={100}
          max={300}
          value={localZoom}
          onChange={(e) => setLocalZoom(Number(e.target.value))}
          className="flex-1 h-1.5 accent-primary"
        />
        <span className="text-xs text-muted-foreground w-10 text-right">{localZoom}%</span>
      </div>

      {hasChanges && (
        <button
          onClick={handleSave}
          className="w-full py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Enregistrer le cadrage
        </button>
      )}
    </div>
  );
}
