import { useState } from 'react';
import { Plus, Trash2, GripVertical, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import type { StatusConfig } from '@spok/shared';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { BadgeColorPicker } from './ColorPicker';
import { BADGE_COLOR_OPTIONS } from '@spok/shared';

interface StatusManagerProps {
  statuses: StatusConfig[];
  onChange: (statuses: StatusConfig[]) => void;
  onCheckUsage: (statusId: string) => Promise<{ isUsed: boolean; itemCount: number }>;
}

export function StatusManager({ statuses, onChange, onCheckUsage }: StatusManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteWarning, setDeleteWarning] = useState<{ id: string; count: number } | null>(null);

  const handleAdd = () => {
    if (!newStatusLabel.trim()) return;

    const id = newStatusLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    if (statuses.some((s) => s.id === id)) {
      alert('Un statut avec cet identifiant existe déjà');
      return;
    }

    const defaultColor = BADGE_COLOR_OPTIONS[0];
    const newStatus: StatusConfig = {
      id,
      label: newStatusLabel,
      color: defaultColor.color,
      borderColor: defaultColor.borderColor,
      order: statuses.length,
      visible: true,
    };

    onChange([...statuses, newStatus]);
    setNewStatusLabel('');
    setShowAddForm(false);
  };

  const handleUpdate = (id: string, updates: Partial<StatusConfig>) => {
    onChange(
      statuses.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const handleDelete = async (id: string) => {
    // Check if status is used
    const usage = await onCheckUsage(id);
    if (usage.isUsed) {
      setDeleteWarning({ id, count: usage.itemCount });
      return;
    }

    onChange(statuses.filter((s) => s.id !== id));
  };

  const confirmDelete = (id: string) => {
    onChange(statuses.filter((s) => s.id !== id));
    setDeleteWarning(null);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newStatuses = [...statuses];
    [newStatuses[index - 1], newStatuses[index]] = [newStatuses[index], newStatuses[index - 1]];
    // Update order values
    newStatuses.forEach((s, i) => (s.order = i));
    onChange(newStatuses);
  };

  const moveDown = (index: number) => {
    if (index === statuses.length - 1) return;
    const newStatuses = [...statuses];
    [newStatuses[index], newStatuses[index + 1]] = [newStatuses[index + 1], newStatuses[index]];
    // Update order values
    newStatuses.forEach((s, i) => (s.order = i));
    onChange(newStatuses);
  };

  const sortedStatuses = [...statuses].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Statuts</h3>
        <Button size="sm" onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Ajouter
        </Button>
      </div>

      {/* Delete warning modal */}
      {deleteWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-lg max-w-md">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0" />
              <div>
                <h4 className="font-medium">Statut en cours d'utilisation</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Ce statut est utilisé par {deleteWarning.count} élément(s).
                  La suppression ne changera pas les éléments existants, mais le statut ne sera plus
                  disponible pour de nouveaux éléments.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="bordered" onClick={() => setDeleteWarning(null)}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={() => confirmDelete(deleteWarning.id)}>
                Supprimer quand même
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="bg-muted/50 p-4 rounded-lg space-y-3">
          <Input
            value={newStatusLabel}
            onChange={(e) => setNewStatusLabel(e.target.value)}
            placeholder="Nom du statut (ex: En attente)"
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={!newStatusLabel.trim()}>
              Ajouter
            </Button>
            <Button
              size="sm"
              variant="bordered"
              onClick={() => {
                setShowAddForm(false);
                setNewStatusLabel('');
              }}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}

      {/* Status list */}
      <div className="space-y-2">
        {sortedStatuses.map((status, index) => (
          <div
            key={status.id}
            className="bg-card border rounded-lg p-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <button
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                  title="Déplacer vers le haut"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveDown(index)}
                  disabled={index === sortedStatuses.length - 1}
                  className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                  title="Déplacer vers le bas"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              <GripVertical className="w-4 h-4 text-muted-foreground" />

              {editingId === status.id ? (
                <Input
                  value={status.label}
                  onChange={(e) => handleUpdate(status.id, { label: e.target.value })}
                  onBlur={() => setEditingId(null)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                  className="flex-1"
                  autoFocus
                />
              ) : (
                <span
                  className="flex-1 cursor-pointer hover:text-primary"
                  onClick={() => setEditingId(status.id)}
                  title="Cliquer pour renommer"
                >
                  {status.label}
                </span>
              )}

              <span className={`px-2 py-1 rounded text-xs ${status.color}`}>
                Aperçu
              </span>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={status.visible}
                  onChange={(e) => handleUpdate(status.id, { visible: e.target.checked })}
                  className="rounded"
                />
                Visible
              </label>

              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => handleDelete(status.id)}
                disabled={status.id === 'undefined'}
                title={status.id === 'undefined' ? 'Le statut "Non défini" ne peut pas être supprimé' : 'Supprimer'}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {/* Color picker (expanded on click) */}
            <div className="mt-3 pl-12">
              <p className="text-sm text-muted-foreground mb-2">Couleur :</p>
              <BadgeColorPicker
                color={status.color}
                borderColor={status.borderColor}
                onChange={(color, borderColor) => handleUpdate(status.id, { color, borderColor })}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
