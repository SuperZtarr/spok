/* Badge de tag coloré (nom + couleur du tag). */
import { X } from 'lucide-react';
import type { Tag } from '@spok/shared';

function getContrastColor(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#1f2937' : '#ffffff';
}

interface TagBadgeProps {
  tag: Tag;
  onRemove?: () => void;
  size?: 'sm' | 'md';
}

export function TagBadge({ tag, onRemove, size = 'md' }: TagBadgeProps) {
  const hasColor = !!tag.color;
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap ${sizeClasses} ${
        hasColor ? '' : 'bg-muted text-muted-foreground'
      }`}
      style={
        hasColor
          ? { backgroundColor: tag.color!, color: getContrastColor(tag.color!) }
          : undefined
      }
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-0 hover:opacity-70 transition-opacity flex-shrink-0"
          title="Retirer le tag"
        >
          <X className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
        </button>
      )}
    </span>
  );
}
