import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { TypeLabelConfig } from '@spok/shared';
import { Input } from '../ui/Input';
import { BorderColorPicker } from './ColorPicker';
import { ITEM_TYPES } from '@spok/shared';

interface TypeLabelsManagerProps {
  typeLabels: Record<string, TypeLabelConfig>;
  onChange: (typeLabels: Record<string, TypeLabelConfig>) => void;
}

export function TypeLabelsManager({ typeLabels, onChange }: TypeLabelsManagerProps) {
  const [expandedType, setExpandedType] = useState<string | null>(null);

  const handleUpdate = (typeId: string, updates: Partial<TypeLabelConfig>) => {
    onChange({
      ...typeLabels,
      [typeId]: { ...typeLabels[typeId], ...updates },
    });
  };

  const moveUp = (typeId: string) => {
    const sorted = getSortedTypes();
    const index = sorted.findIndex((t) => t === typeId);
    if (index <= 0) return;

    const prevType = sorted[index - 1];
    const currentOrder = typeLabels[typeId].order;
    const prevOrder = typeLabels[prevType].order;

    onChange({
      ...typeLabels,
      [typeId]: { ...typeLabels[typeId], order: prevOrder },
      [prevType]: { ...typeLabels[prevType], order: currentOrder },
    });
  };

  const moveDown = (typeId: string) => {
    const sorted = getSortedTypes();
    const index = sorted.findIndex((t) => t === typeId);
    if (index < 0 || index >= sorted.length - 1) return;

    const nextType = sorted[index + 1];
    const currentOrder = typeLabels[typeId].order;
    const nextOrder = typeLabels[nextType].order;

    onChange({
      ...typeLabels,
      [typeId]: { ...typeLabels[typeId], order: nextOrder },
      [nextType]: { ...typeLabels[nextType], order: currentOrder },
    });
  };

  const getSortedTypes = () => {
    return ITEM_TYPES.filter((type) => typeLabels[type]).sort(
      (a, b) => typeLabels[a].order - typeLabels[b].order
    );
  };

  const sortedTypes = getSortedTypes();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Types d'éléments</h3>
      </div>

      <div className="space-y-2">
        {sortedTypes.map((typeId, index) => {
          const config = typeLabels[typeId];
          if (!config) return null;

          const isExpanded = expandedType === typeId;

          return (
            <div key={typeId} className="bg-card border rounded-lg overflow-hidden">
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
                onClick={() => setExpandedType(isExpanded ? null : typeId)}
              >
                <div className="flex flex-col" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => moveUp(typeId)}
                    disabled={index === 0}
                    className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveDown(typeId)}
                    disabled={index === sortedTypes.length - 1}
                    className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                <div className={`w-1 h-8 rounded ${config.color}`} />

                <div className="flex-1">
                  <span className="font-medium">{config.label}</span>
                  <span className="text-muted-foreground ml-2">({config.labelShort})</span>
                </div>

                <div className={`px-2 py-1 rounded border-l-4 ${config.color} ${config.bgHover}`}>
                  Aperçu
                </div>

                <label
                  className="flex items-center gap-2 text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={config.visible}
                    onChange={(e) => handleUpdate(typeId, { visible: e.target.checked })}
                    className="rounded"
                  />
                  Visible
                </label>

                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </div>

              {isExpanded && (
                <div className="border-t p-4 space-y-4 bg-muted/30">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium block mb-1">Label complet</label>
                      <Input
                        value={config.label}
                        onChange={(e) => handleUpdate(typeId, { label: e.target.value })}
                        placeholder="Ex: Notes"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1">Label court</label>
                      <Input
                        value={config.labelShort}
                        onChange={(e) => handleUpdate(typeId, { labelShort: e.target.value })}
                        placeholder="Ex: Note"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-2">Couleur</label>
                    <BorderColorPicker
                      color={config.color}
                      bgHover={config.bgHover}
                      onChange={(color, bgHover) => handleUpdate(typeId, { color, bgHover })}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
