/*
 * RelationEditDialog — modale « Modifier la relation » ouverte au clic sur une flèche (MindMap, PERT, Gantt, Process) et au clic sur une relation de la fiche d'élément (ItemEditModal).
 * Type parmi les 4 officiels, chacun lu comme une phrase (RelationSentenceRow), commentaire, Enregistrer / Supprimer /
 * Annuler — suppression directe, comme partout. Enregistrer/Supprimer masqués si l'action n'est pas fournie.
 * Props : source/target ({ title, status }), statusOptions (défaut DEFAULT_REFERENTIELS), type/label initiaux,
 * onSave(type, label) (label vide → l'appelant envoie null), onDelete, onCancel.
 */
import { useRef, useState } from 'react';
import type { StatusConfig } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { RELATION_TYPE_LIST } from '../../constants/relationTypes';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { DevModalBadge } from '../ui/DevModalBadge';
import { RelationSentenceRow, type RelationEnd } from './RelationSentenceRow';

interface RelationEditDialogProps {
  source: RelationEnd;
  target: RelationEnd;
  statusOptions?: StatusConfig[];
  type: string;
  label: string;
  onSave?: (type: string, label: string) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export function RelationEditDialog({ source, target, statusOptions = DEFAULT_REFERENTIELS.statuses, type, label, onSave, onDelete, onCancel }: RelationEditDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [editType, setEditType] = useState(type);
  const [editLabel, setEditLabel] = useState(label);
  useDialogFocus(panelRef, true);
  useEscapeKey(onCancel, true);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div ref={panelRef} tabIndex={-1} className="outline-none bg-white dark:bg-gray-900 rounded-lg shadow-xl p-4 max-w-xl w-full mx-4">
        <h3 className="text-base font-semibold mb-1 flex items-center gap-2">Modifier la relation <DevModalBadge name="RelationEditDialog" /></h3>
        <p className="text-sm text-muted-foreground mb-3">
          <span className="font-medium">{source.title}</span>
          {' → '}
          <span className="font-medium">{target.title}</span>
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {RELATION_TYPE_LIST.map((t) => (
            <button
              key={t.id}
              onClick={() => setEditType(t.id)}
              className={`flex items-center gap-3 px-3 py-2 border rounded-lg transition-colors w-full ${editType === t.id ? t.selectedClass : `border-border ${t.hoverClass}`}`}
            >
              <t.Icon className={`w-4 h-4 flex-shrink-0 ${t.textClass}`} />
              <RelationSentenceRow typeId={t.id} source={source} target={target} statusOptions={statusOptions} />
            </button>
          ))}
        </div>
        <label className="text-xs text-muted-foreground mb-1 block">Commentaire (optionnel)</label>
        <textarea
          value={editLabel}
          onChange={(e) => setEditLabel(e.target.value)}
          placeholder="Décrivez cette relation…"
          rows={2}
          className="w-full text-sm px-3 py-1.5 rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring mb-3"
        />
        <div className="flex gap-2">
          {onSave && (
            <button
              onClick={() => onSave(editType, editLabel.trim())}
              className="flex-1 px-3 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:opacity-90 transition-opacity"
            >
              Enregistrer
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-3 py-2 bg-destructive text-destructive-foreground text-sm rounded-lg hover:opacity-90 transition-opacity"
            >
              Supprimer
            </button>
          )}
          <button onClick={onCancel} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
