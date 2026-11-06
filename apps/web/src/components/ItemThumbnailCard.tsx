/* ItemThumbnailCard — carte dessinée hors écran puis convertie en PNG par « Copier la vignette » (lib/itemThumbnail.ts).
 * Prop : thumb (données déjà préparées, image en data URL).
 * Styles en ligne et couleurs fixes, jamais Tailwind ni variables de thème : l'image doit rester claire et lisible
 * où qu'elle soit collée, même si SPOK est en sombre. Largeur fixe 600 px. Pas d'usage à l'écran. */
import { TYPE_ICONS } from '../constants/ui';
import type { ItemThumbnail } from '../lib/itemThumbnail';

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const INK = '#111827';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';
const CHIP = '#f3f4f6';

const clamp = (lines: number) => ({
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical' as const,
  WebkitLineClamp: lines,
  overflow: 'hidden',
});

function Chip({ children }: { children: string }) {
  return (
    <span style={{ padding: '2px 10px', borderRadius: 999, background: CHIP, color: INK, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

export function ItemThumbnailCard({ thumb }: { thumb: ItemThumbnail }) {
  const Icon = TYPE_ICONS[thumb.type];
  return (
    <div style={{ width: 600, boxSizing: 'border-box', padding: 24, background: '#ffffff', border: `1px solid ${LINE}`, borderRadius: 12, fontFamily: FONT, color: INK }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: MUTED, fontSize: 14 }}>
        {Icon && <Icon style={{ width: 18, height: 18, flexShrink: 0 }} />}
        <span style={{ flex: 1 }}>{thumb.typeLabel}</span>
        {thumb.status && <Chip>{thumb.status}</Chip>}
        {thumb.priority && <Chip>{thumb.priority}</Chip>}
      </div>

      <div style={{ ...clamp(2), fontSize: 24, fontWeight: 700, lineHeight: 1.25, marginBottom: 14 }}>{thumb.title}</div>

      {thumb.imageUrl ? (
        <img src={thumb.imageUrl} alt="" style={{ display: 'block', width: '100%', maxHeight: 300, objectFit: 'contain', background: '#f9fafb', borderRadius: 8, marginBottom: 14 }} />
      ) : thumb.excerpt ? (
        <div style={{ ...clamp(5), fontSize: 15, lineHeight: 1.5, color: '#374151', marginBottom: 14 }}>{thumb.excerpt}</div>
      ) : null}

      {thumb.attachment && <div style={{ fontSize: 14, color: '#2563eb', marginBottom: 14, wordBreak: 'break-all' }}>{thumb.attachment}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 12, borderTop: `1px solid ${LINE}`, color: MUTED, fontSize: 13 }}>
        <span style={{ flex: 1, minWidth: 0 }}>{thumb.meta.join(' · ')}</span>
        <span style={{ fontWeight: 700, letterSpacing: 1 }}>SPOK</span>
      </div>
    </div>
  );
}
