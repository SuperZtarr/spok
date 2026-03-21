import { useMemo, useState, useCallback, useEffect } from 'react';
import { ImageIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Item } from '@spok/shared';

interface ImageItem {
  id: string;
  title: string;
  url: string;
  description: string | null;
}

function Lightbox({ images, index, onClose, onNavigate }: {
  images: ImageItem[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1);
      if (e.key === 'ArrowRight' && index < images.length - 1) onNavigate(index + 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, images.length, onClose, onNavigate]);

  const img = images[index];

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white z-10">
        <X className="w-8 h-8" />
      </button>

      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(index - 1); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white z-10"
        >
          <ChevronLeft className="w-10 h-10" />
        </button>
      )}

      {index < images.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(index + 1); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white z-10"
        >
          <ChevronRight className="w-10 h-10" />
        </button>
      )}

      <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img
          src={img.url}
          alt={img.title}
          className="max-w-full max-h-[80vh] object-contain rounded"
        />
        <div className="mt-3 text-center">
          <p className="text-white font-medium">{img.title}</p>
          <p className="text-white/50 text-sm">{index + 1}/{images.length}</p>
        </div>
      </div>
    </div>
  );
}

interface ImagesViewProps {
  items: Item[] | undefined;
  onEdit?: (id: string) => void;
}

export function ImagesView({ items, onEdit }: ImagesViewProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const images = useMemo<ImageItem[]>(() => {
    if (!items) return [];
    return items
      .filter(item => item.url && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.url))
      .map(item => ({
        id: item.id,
        title: item.title,
        url: item.url!,
        description: item.description || null,
      }));
  }, [items]);

  const openLightbox = useCallback((index: number) => setLightboxIndex(index), []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  if (images.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
          <p className="text-lg font-medium">Aucune image</p>
          <p className="text-sm text-muted-foreground">Cet espace ne contient aucun item avec une image.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {images.map((img, i) => (
          <button
            key={img.id}
            onClick={() => openLightbox(i)}
            onDoubleClick={() => onEdit?.(img.id)}
            className="group flex flex-col rounded-lg overflow-hidden border bg-card hover:shadow-md hover:border-primary/30 transition-all"
          >
            <div className="aspect-square overflow-hidden bg-muted">
              <img
                src={img.url}
                alt={img.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
              />
            </div>
            <div className="px-2 py-1.5 min-h-[2.5rem]">
              <p className="text-xs font-medium truncate">{img.title}</p>
            </div>
          </button>
        ))}
      </div>

      {lightboxIndex !== null && images.length > 0 && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onClose={closeLightbox}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}
