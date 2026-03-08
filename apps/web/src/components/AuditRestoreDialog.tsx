import { useState, useMemo } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { History } from 'lucide-react';

interface AuditRestoreDialogProps {
  isOpen: boolean;
  onClose: () => void;
  changes: { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;
  entity: string;
  action: string;
  date: string;
  userName: string;
  onRestore: (fieldsToRestore: string[]) => void;
  isPending?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  type: 'Type',
  title: 'Titre',
  description: 'Description',
  content: 'Contenu',
  url: 'URL',
  status: 'Statut',
  priority: 'Priorité',
  position: 'Position',
  dueDate: "Date d'échéance",
  startDate: 'Date de début',
  endDate: 'Date de fin',
  parentId: 'Parent',
  spaceId: 'Espace',
  assignedToId: 'Assigné à',
  name: 'Nom',
  isPublic: 'Public',
  communityId: 'Communauté',
  avatarUrl: 'Avatar',
  coverUrl: 'Couverture',
  defaultRole: 'Rôle par défaut',
  label: 'Label',
};

// Fields to skip in the UI (internal/non-meaningful)
const SKIP_FIELDS = new Set(['id', 'createdById', 'createdAt', 'updatedAt']);

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      try {
        return new Date(value).toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return value;
      }
    }
    if (value.length > 120) return value.slice(0, 120) + '…';
    return value;
  }
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 120) + '…';
  return String(value);
}

export function AuditRestoreDialog({
  isOpen,
  onClose,
  changes,
  entity,
  action,
  date,
  userName,
  onRestore,
  isPending,
}: AuditRestoreDialogProps) {
  // Compute diff fields from before/after
  const fields = useMemo(() => {
    if (!changes?.before) return [];
    const before = changes.before;
    const after = changes.after || {};
    const result: Array<{ field: string; label: string; beforeValue: unknown; afterValue: unknown }> = [];

    for (const field of Object.keys(before)) {
      if (SKIP_FIELDS.has(field)) continue;
      const bv = before[field];
      const av = after[field];
      // Only show fields that actually changed
      if (JSON.stringify(bv) !== JSON.stringify(av)) {
        result.push({
          field,
          label: FIELD_LABELS[field] || field,
          beforeValue: bv,
          afterValue: av,
        });
      }
    }
    return result;
  }, [changes]);

  // Track which fields are selected for restore (default: all checked)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(fields.map((f) => f.field)));

  // Reset selection when fields change
  useMemo(() => {
    setSelected(new Set(fields.map((f) => f.field)));
  }, [fields]);

  const toggleField = (field: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(fields.map((f) => f.field)));
  const selectNone = () => setSelected(new Set());

  const handleRestore = () => {
    const fieldsToRestore = Array.from(selected);
    if (fieldsToRestore.length > 0) {
      onRestore(fieldsToRestore);
    }
  };

  const formattedDate = new Date(date).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Restaurer une modification">
      <div className="space-y-4">
        {/* Context banner */}
        <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <History className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p>
              <strong>{action === 'MOVE' ? 'Déplacement' : 'Modification'}</strong> d'un <strong>{entity}</strong> par <strong>{userName}</strong> le {formattedDate}.
            </p>
            <p className="mt-1">Cochez les champs que vous souhaitez restaurer à leur valeur précédente.</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Tout sélectionner
          </Button>
          <Button variant="outline" size="sm" onClick={selectNone}>
            Tout désélectionner
          </Button>
        </div>

        {/* Field-by-field comparison */}
        {fields.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            Aucun champ modifié à restaurer
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {fields.map((f) => (
              <label
                key={f.field}
                className={`block border rounded-lg p-3 cursor-pointer transition-all ${
                  selected.has(f.field)
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={selected.has(f.field)}
                    onChange={() => toggleField(f.field)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium">{f.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 ml-6">
                  <div className="p-2 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50">
                    <div className="text-[10px] uppercase font-medium text-red-600 dark:text-red-400 mb-0.5">
                      Valeur actuelle
                    </div>
                    <div className="text-sm break-words">{formatValue(f.afterValue)}</div>
                  </div>
                  <div className="p-2 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50">
                    <div className="text-[10px] uppercase font-medium text-green-600 dark:text-green-400 mb-0.5">
                      Valeur à restaurer
                    </div>
                    <div className="text-sm break-words">{formatValue(f.beforeValue)}</div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-2 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleRestore}
            disabled={selected.size === 0 || isPending}
          >
            {isPending ? 'Restauration...' : `Restaurer ${selected.size} champ${selected.size > 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
