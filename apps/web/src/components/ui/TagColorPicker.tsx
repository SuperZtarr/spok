/* Sélecteur de couleur d'un tag par pastilles (demande Thomas 2026-11-11 : comme les référentiels, plus de sélecteur
 * natif « type=color » jugé trop compliqué). Les tags stockent une couleur hexadécimale (#rrggbb, validée par l'API) :
 * TAG_COLORS donne une palette fixe de teintes ; une couleur déjà enregistrée hors palette reste proposée (première
 * pastille) pour ne pas la perdre. « Aucune » = null (badge gris par défaut).
 * Props : value (hex ou null), onChange(hex | null), size ('sm' dans une ligne de liste, 'md' sinon).
 * Usage : partout où l'on choisit la couleur d'un tag ; ne pas réintroduire d'input type=color.
 */
import { Ban } from 'lucide-react';

/** Palette des tags (teintes 500 de Tailwind), dans l'ordre du cercle chromatique */
export const TAG_COLORS: Array<{ hex: string; label: string }> = [
  { hex: '#6b7280', label: 'Gris' },
  { hex: '#ef4444', label: 'Rouge' },
  { hex: '#f97316', label: 'Orange' },
  { hex: '#f59e0b', label: 'Ambre' },
  { hex: '#eab308', label: 'Jaune' },
  { hex: '#84cc16', label: 'Citron vert' },
  { hex: '#22c55e', label: 'Vert' },
  { hex: '#14b8a6', label: 'Sarcelle' },
  { hex: '#06b6d4', label: 'Cyan' },
  { hex: '#3b82f6', label: 'Bleu' },
  { hex: '#6366f1', label: 'Indigo' },
  { hex: '#8b5cf6', label: 'Violet' },
  { hex: '#ec4899', label: 'Rose' },
  { hex: '#78350f', label: 'Brun' },
];

interface TagColorPickerProps {
  value: string | null;
  onChange: (color: string | null) => void;
  size?: 'sm' | 'md';
}

export function TagColorPicker({ value, onChange, size = 'md' }: TagColorPickerProps) {
  const dim = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';
  const current = value?.toLowerCase() ?? null;
  const options = current && !TAG_COLORS.some((c) => c.hex === current)
    ? [{ hex: current, label: 'Couleur actuelle' }, ...TAG_COLORS]
    : TAG_COLORS;
  const ring = (selected: boolean) => (selected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : 'hover:scale-110');

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Couleur du tag">
      <button
        type="button"
        role="radio"
        aria-checked={current === null}
        aria-label="Aucune couleur"
        onClick={() => onChange(null)}
        className={`${dim} rounded-full border border-border bg-muted flex items-center justify-center transition-transform ${ring(current === null)}`}
      >
        <Ban className="w-3 h-3 text-muted-foreground" />
      </button>
      {options.map((c) => (
        <button
          key={c.hex}
          type="button"
          role="radio"
          aria-checked={current === c.hex}
          aria-label={c.label}
          onClick={() => onChange(c.hex)}
          className={`${dim} rounded-full transition-transform ${ring(current === c.hex)}`}
          style={{ backgroundColor: c.hex }}
        />
      ))}
    </div>
  );
}
