/*
 * RelationCreateDialog — modale « Type de relation » ouverte quand on relie deux items dans une vue graphique.
 * Copie partagée de la modale de MindMapView (même contenu : commentaire optionnel + 4 types officiels de
 * constants/relationTypes.ts). Utilisée par ProcessView ; MindMap / PERT / Gantt ont encore leur copie inline
 * (migration à faire séparément, zones fragiles).
 * Props : sourceTitle/targetTitle (affichage « A → B »), onSelect(type, label?) crée la relation, onCancel ferme.
 * Rendue seulement quand une connexion est en attente (le parent la monte/démonte).
 */
import { useRef, useState } from 'react';
import { RELATION_TYPE_LIST } from '../../constants/relationTypes';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { DevModalBadge } from '../ui/DevModalBadge';

interface RelationCreateDialogProps {
  sourceTitle: string;
  targetTitle: string;
  onSelect: (type: string, label?: string) => void;
  onCancel: () => void;
}

export function RelationCreateDialog({ sourceTitle, targetTitle, onSelect, onCancel }: RelationCreateDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState('');
  useDialogFocus(panelRef, true);
  useEscapeKey(onCancel, true);

  const select = (type: string) => onSelect(type, label.trim() || undefined);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div ref={panelRef} tabIndex={-1} className="outline-none bg-white dark:bg-gray-900 rounded-lg shadow-xl p-4 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">Type de relation <DevModalBadge name="RelationCreateDialog" /></h3>
        <p className="text-sm text-muted-foreground mb-3">
          <span className="font-medium">{sourceTitle}</span>
          {' → '}
          <span className="font-medium">{targetTitle}</span>
        </p>
        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1 block">Commentaire (optionnel)</label>
          <textarea
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Décrivez cette relation…"
            rows={2}
            className="w-full text-sm border rounded-md px-2 py-1.5 resize-none bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {RELATION_TYPE_LIST.map((type) => (
            <button
              key={type.id}
              onClick={() => select(type.id)}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-left ${type.hoverClass}`}
              title={type.description}
            >
              <type.Icon className={`w-4 h-4 ${type.textClass}`} />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{type.label}</span>
                <span className="text-[10px] text-muted-foreground">{type.description}</span>
              </div>
            </button>
          ))}
        </div>
        {label && (
          <button
            onClick={() => select('relates')}
            className="mt-2 w-full px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Créer avec type par défaut
          </button>
        )}
        <button
          onClick={onCancel}
          className="mt-4 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-accent rounded-lg transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
