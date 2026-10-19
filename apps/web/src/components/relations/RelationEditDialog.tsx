/*
 * RelationEditDialog — modale « Modifier la relation » ouverte au clic sur une flèche dans une vue graphique.
 * Copie partagée de la modale de MindMapView (type parmi les 4 officiels, commentaire, Enregistrer / Supprimer /
 * Annuler — suppression directe, comme dans les autres vues). Utilisée par ProcessView.
 * Props : sourceTitle/targetTitle, type/label initiaux, onSave(type, label) (label vide → null côté appelant),
 * onDelete supprime la relation, onCancel ferme.
 */
import { useRef, useState } from 'react';
import { RELATION_TYPE_LIST } from '../../constants/relationTypes';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { DevModalBadge } from '../ui/DevModalBadge';

interface RelationEditDialogProps {
  sourceTitle: string;
  targetTitle: string;
  type: string;
  label: string;
  onSave: (type: string, label: string) => void;
  onDelete: () => void;
  onCancel: () => void;
}

export function RelationEditDialog({ sourceTitle, targetTitle, type, label, onSave, onDelete, onCancel }: RelationEditDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [editType, setEditType] = useState(type);
  const [editLabel, setEditLabel] = useState(label);
  useDialogFocus(panelRef, true);
  useEscapeKey(onCancel, true);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div ref={panelRef} tabIndex={-1} className="outline-none bg-white dark:bg-gray-900 rounded-lg shadow-xl p-4 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">Modifier la relation <DevModalBadge name="RelationEditDialog" /></h3>
        <p className="text-sm text-muted-foreground mb-4">
          <span className="font-medium">{sourceTitle}</span>
          {' → '}
          <span className="font-medium">{targetTitle}</span>
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {RELATION_TYPE_LIST.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setEditType(t.id)}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-left ${editType === t.id ? t.selectedClass : t.hoverClass}`}
                >
                  <t.Icon className={`w-4 h-4 ${t.textClass}`} />
                  <span className="text-sm font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Commentaire</label>
            <input
              type="text"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              placeholder="Commentaire (optionnel)"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-transparent"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onSave(editType, editLabel.trim())}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            Enregistrer
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950 border border-red-200 rounded-lg transition-colors"
          >
            Supprimer
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-2 text-sm text-muted-foreground hover:bg-accent rounded-lg transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
