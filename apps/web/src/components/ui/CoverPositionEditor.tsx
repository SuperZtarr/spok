import { useState, useRef, useCallback, useEffect } from 'react';
import { Move, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface CoverPositionEditorProps {
  coverUrl: string;
  position: number; // Y 0-100
  positionX: number; // X 0-100
  zoom: number; // 100-300
  onSave: (position: number, positionX: number, zoom: number) => void;
}

const COVER_RATIO = 5; // 5:1

export function CoverPositionEditor({ coverUrl, position, positionX, zoom, onSave }: CoverPositionEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [localY, setLocalY] = useState(position);
  const [localX, setLocalX] = useState(positionX);
  const [localZoom, setLocalZoom] = useState(zoom);
  const [dragging, setDragging] = useState(false);
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);

  useEffect(() => {
    setLocalY(position);
    setLocalX(positionX);
    setLocalZoom(zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, positionX, zoom]);

  const hasChanges = localY !== position || localX !== positionX || localZoom !== zoom;
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  // Wheel zoom (non-passive to preventDefault)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setLocalZoom(prev => clamp(prev + (e.deltaY > 0 ? 10 : -10), 100, 300));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleImgLoad = useCallback(() => {
    const img = imgRef.current;
    if (img) setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
  }, []);

  // Frame size as % of container
  // At zoom=100, the frame = full width. At zoom=200, frame = 50% width.
  const frameWPct = 100 / (localZoom / 100);
  // Frame height: maintain 5:1 ratio relative to frame width
  // frameH in px = (containerW * frameWPct/100) / 5
  // frameH as % of containerH = depends on actual dimensions
  // We'll compute in the render using aspect ratio of the image
  const imgRatio = imgNatural ? imgNatural.w / imgNatural.h : 16 / 9;
  const frameHPct = (frameWPct / COVER_RATIO) * imgRatio;

  // Frame position from center point, clamped
  const halfW = frameWPct / 2;
  const halfH = frameHPct / 2;
  const frameLeft = clamp(localX - halfW, 0, Math.max(0, 100 - frameWPct));
  const frameTop = clamp(localY - halfH, 0, Math.max(0, 100 - frameHPct));
  const clampedFrameW = Math.min(frameWPct, 100);
  const clampedFrameH = Math.min(frameHPct, 100);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, startX: localX, startY: localY };
  }, [localX, localY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !dragStart.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const pctX = (dx / rect.width) * 100;
    const pctY = (dy / rect.height) * 100;
    setLocalX(clamp(Math.round(dragStart.current.startX + pctX), 0, 100));
    setLocalY(clamp(Math.round(dragStart.current.startY + pctY), 0, 100));
  }, [dragging]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
    dragStart.current = null;
  }, []);

  return (
    <div className="space-y-3 max-w-sm">
      {/* Live preview */}
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Aperçu</span>
        <div className="aspect-[5/1] rounded-md overflow-hidden border border-border">
          <img
            src={coverUrl}
            alt="Aperçu"
            className="w-full h-full object-cover pointer-events-none"
            style={{
              objectPosition: `${localX}% ${localY}%`,
              transform: `scale(${localZoom / 100})`,
              transformOrigin: `${localX}% ${localY}%`,
            }}
            draggable={false}
          />
        </div>
      </div>

      {/* Zoom slider */}
      <div className="flex items-center gap-2">
        <ZoomOut className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <input
          type="range"
          min={100}
          max={300}
          step={5}
          value={localZoom}
          onChange={(e) => setLocalZoom(Number(e.target.value))}
          className="flex-1 h-1.5 accent-primary"
        />
        <ZoomIn className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground w-10 text-right">{localZoom}%</span>
        <button
          onClick={() => { setLocalX(50); setLocalY(50); setLocalZoom(100); }}
          className="p-1.5 rounded-md border border-border hover:bg-accent transition-colors"
          title="Réinitialiser"
        >
          <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Image with selection frame */}
      <div
        ref={containerRef}
        className="relative rounded-lg overflow-hidden border border-border select-none touch-none bg-black"
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          ref={imgRef}
          src={coverUrl}
          alt="Cover"
          className="w-full block pointer-events-none"
          style={{ aspectRatio: imgNatural ? `${imgNatural.w}/${imgNatural.h}` : undefined }}
          onLoad={handleImgLoad}
          draggable={false}
        />

        {/* Dark overlay with transparent cutout */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <mask id="cover-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={`${frameLeft}%`}
                y={`${frameTop}%`}
                width={`${clampedFrameW}%`}
                height={`${clampedFrameH}%`}
                fill="black"
                rx="2"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#cover-mask)" />
          <rect
            x={`${frameLeft}%`}
            y={`${frameTop}%`}
            width={`${clampedFrameW}%`}
            height={`${clampedFrameH}%`}
            fill="none"
            stroke="white"
            strokeWidth="2"
            rx="2"
          />
        </svg>

        {/* Drag hint */}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${dragging ? 'opacity-0' : 'opacity-0 hover:opacity-100'}`}>
          <div className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Move className="w-3.5 h-3.5" />
            Glissez le cadre &middot; Molette pour zoomer
          </div>
        </div>
      </div>

      {/* Save */}
      {hasChanges && (
        <button
          onClick={() => onSave(localY, localX, localZoom)}
          className="w-full py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Enregistrer le cadrage
        </button>
      )}
    </div>
  );
}
