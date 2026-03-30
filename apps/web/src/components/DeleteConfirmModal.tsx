import { useState, useEffect } from 'react';
import { AlertTriangle, Calendar, Link as LinkIcon, User, Tag as TagIcon, Flag } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { TYPE_ICONS, TYPE_LABELS } from '../constants/ui';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: { deleteChildren: boolean }) => void;
  itemTitle: string;
  itemType: string;
  childCount: number;
  contributionCount: number;
  description?: string | null;
  status?: string | null;
  priority?: number | null;
  dueDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  url?: string | null;
  assignedToName?: string | null;
  tags?: Array<{ name: string; color?: string | null }>;
}

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Critique',
  2: 'Haute',
  3: 'Moyenne',
  4: 'Basse',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  itemTitle,
  itemType,
  childCount,
  contributionCount,
  description,
  status,
  priority,
  dueDate,
  startDate,
  endDate,
  url,
  assignedToName,
  tags,
}: DeleteConfirmModalProps) {
  const Icon = TYPE_ICONS[itemType];
  const hasWarnings = childCount > 0 || contributionCount > 0;
  const [deleteChildren, setDeleteChildren] = useState(false);

  // Reset checkbox when modal opens
  useEffect(() => {
    if (isOpen) setDeleteChildren(false);
  }, [isOpen]);

  // Build list of filled fields
  const filledFields: Array<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = [];

  if (description) {
    const plain = stripHtml(description).trim();
    if (plain) {
      filledFields.push({
        icon: null,
        label: 'Description',
        value: plain.length > 80 ? plain.slice(0, 80) + '...' : plain,
      });
    }
  }

  if (status) {
    filledFields.push({
      icon: null,
      label: 'Statut',
      value: status,
    });
  }

  if (priority != null) {
    filledFields.push({
      icon: <Flag className="w-3 h-3" />,
      label: 'Priorite',
      value: PRIORITY_LABELS[priority] || `P${priority}`,
    });
  }

  if (assignedToName) {
    filledFields.push({
      icon: <User className="w-3 h-3" />,
      label: 'Assigne',
      value: assignedToName,
    });
  }

  if (dueDate) {
    filledFields.push({
      icon: <Calendar className="w-3 h-3" />,
      label: 'Echeance',
      value: formatDate(dueDate),
    });
  }

  if (startDate || endDate) {
    const parts = [];
    if (startDate) parts.push(formatDate(startDate));
    if (endDate) parts.push(formatDate(endDate));
    filledFields.push({
      icon: <Calendar className="w-3 h-3" />,
      label: 'Periode',
      value: parts.join(' → '),
    });
  }

  if (url) {
    filledFields.push({
      icon: <LinkIcon className="w-3 h-3" />,
      label: 'URL',
      value: url.length > 50 ? url.slice(0, 50) + '...' : url,
    });
  }

  if (tags && tags.length > 0) {
    filledFields.push({
      icon: <TagIcon className="w-3 h-3" />,
      label: 'Tags',
      value: (
        <span className="flex flex-wrap gap-1">
          {tags.map((t, i) => (
            <span
              key={i}
              className="inline-block text-xs px-1.5 py-0.5 rounded-full"
              style={t.color ? { backgroundColor: t.color + '20', color: t.color } : undefined}
            >
              {t.name}
            </span>
          ))}
        </span>
      ),
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Supprimer cet element ?" size="small">
      <div className="space-y-4">
        {/* Item info */}
        <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
          {Icon && <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
          <span className="text-sm text-muted-foreground">{TYPE_LABELS[itemType] || itemType}</span>
          <span className="font-semibold truncate">{itemTitle}</span>
        </div>

        {/* Filled fields summary */}
        {filledFields.length > 0 && (
          <div className="border rounded-md p-3 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Donnees qui seront perdues
            </p>
            {filledFields.map((field, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-muted-foreground flex items-center gap-1 shrink-0 min-w-[80px]">
                  {field.icon}
                  {field.label}
                </span>
                <span className="text-foreground truncate">{field.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Warnings */}
        {hasWarnings && (
          <div className="space-y-2">
            {childCount > 0 && (
              <div className={`flex items-start gap-2 p-3 rounded-md text-sm border ${
                deleteChildren
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-yellow-50 border-yellow-200 text-yellow-800'
              }`}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>{childCount}</strong> descendant{childCount > 1 ? 's' : ''}{' '}
                  {deleteChildren
                    ? (childCount > 1 ? 'seront aussi supprimes' : 'sera aussi supprime')
                    : (childCount > 1 ? 'seront deplaces' : 'sera deplace') + ' a la racine'
                  }
                </span>
              </div>
            )}
            {contributionCount > 0 && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>{contributionCount}</strong> contribution{contributionCount > 1 ? 's' : ''}{' '}
                  {contributionCount > 1 ? 'seront' : 'sera'} definitivement supprimee{contributionCount > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Delete children option */}
        {childCount > 0 && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={deleteChildren}
              onChange={(e) => setDeleteChildren(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm">
              Supprimer aussi les {childCount} descendant{childCount > 1 ? 's' : ''}
            </span>
          </label>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={() => onConfirm({ deleteChildren })}>
            Supprimer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
