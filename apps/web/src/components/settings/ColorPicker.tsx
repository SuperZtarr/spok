/* Sélecteur de couleur (palette + hex) pour statuts et tags. */
import { BADGE_COLOR_OPTIONS, BORDER_COLOR_OPTIONS } from '@spok/shared';

interface ColorPickerProps {
  type: 'badge' | 'border';
  selectedId: string;
  onChange: (colorId: string, color: string, borderColor: string) => void;
}

export function ColorPicker({ type, selectedId, onChange }: ColorPickerProps) {
  const options = type === 'badge' ? BADGE_COLOR_OPTIONS : BORDER_COLOR_OPTIONS;

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selectedId === option.id;
        const displayClass = type === 'badge' ? option.color : `${option.color} border-2`;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              if (type === 'badge') {
                const badgeOption = option as (typeof BADGE_COLOR_OPTIONS)[number];
                onChange(option.id, badgeOption.color, badgeOption.borderColor);
              } else {
                const borderOption = option as (typeof BORDER_COLOR_OPTIONS)[number];
                onChange(option.id, borderOption.color, borderOption.bgHover);
              }
            }}
            className={`
              w-8 h-8 rounded-md transition-all
              ${displayClass}
              ${isSelected ? 'ring-2 ring-primary ring-offset-2' : 'hover:scale-110'}
            `}
            title={option.label}
          />
        );
      })}
    </div>
  );
}

interface BadgeColorPickerProps {
  color: string;
  borderColor: string;
  onChange: (color: string, borderColor: string) => void;
}

export function BadgeColorPicker({ color, onChange }: BadgeColorPickerProps) {
  // Find the current color ID from the class
  const currentId = BADGE_COLOR_OPTIONS.find((opt) => opt.color === color)?.id || 'gray';

  return (
    <ColorPicker
      type="badge"
      selectedId={currentId}
      onChange={(_, newColor, newBorderColor) => onChange(newColor, newBorderColor)}
    />
  );
}

interface BorderColorPickerProps {
  color: string;
  bgHover: string;
  onChange: (color: string, bgHover: string) => void;
}

export function BorderColorPicker({ color, onChange }: BorderColorPickerProps) {
  // Find the current color ID from the class
  const currentId = BORDER_COLOR_OPTIONS.find((opt) => opt.color === color)?.id || 'gray';

  return (
    <ColorPicker
      type="border"
      selectedId={currentId}
      onChange={(_, newColor, newBgHover) => onChange(newColor, newBgHover)}
    />
  );
}
