/*
 * RelationCreateDialog — modale « Type de relation » ouverte quand on relie deux items dans une vue graphique
 * (MindMap, PERT, Gantt, Process). Commentaire optionnel + un choix par type officiel (constants/relationTypes.ts),
 * chaque choix lu comme une phrase « A bloque B » (RelationSentenceRow, présentation du PERT retenue partout).
 * Props : source/target ({ title, status }), statusOptions (référentiel de l'espace, défaut DEFAULT_REFERENTIELS),
 * onSelect(type, label?) crée la relation, onCancel ferme. Le parent la monte seulement quand une connexion attend.
 */
import { useRef, useState } from 'react';
import type { StatusConfig } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { RELATION_TYPE_LIST } from '../../constants/relationTypes';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { DevModalBadge } from '../ui/DevModalBadge';
import { RelationSentenceRow, type RelationEnd } from './RelationSentenceRow';

interface RelationCreateDialogProps {
  source: RelationEnd;
  target: RelationEnd;
  statusOptions?: StatusConfig[];
  onSelect: (type: string, label?: string) => void;
  onCancel: () => void;
}

export function RelationCreateDialog({ source, target, statusOptions = DEFAULT_REFERENTIELS.statuses, onSelect, onCancel }: RelationCreateDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState('');
  useDialogFocus(panelRef, true);
  useEscapeKey(onCancel, true);

  const select = (type: string) => onSelect(type, label.trim() || undefined);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div ref={panelRef} tabIndex={-1} className="outline-none bg-white dark:bg-gray-900 rounded-lg shadow-xl p-4 max-w-xl w-full mx-4">
        <h3 className="text-base font-semibold mb-1 flex items-center gap-2">Type de relation <DevModalBadge name="RelationCreateDialog" /></h3>
        <p className="text-sm text-muted-foreground mb-4">
          <span className="font-medium">{source.title}</span>
          {' → '}
          <span className="font-medium">{target.title}</span>
        </p>
        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1 block">Commentaire (optionnel)</label>
          <textarea
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Décrivez cette relation…"
            rows={2}
            className="w-full text-sm border border-input rounded-md px-2 py-1.5 resize-none bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-2">
          {RELATION_TYPE_LIST.map((type) => (
            <button
              key={type.id}
              onClick={() => select(type.id)}
              className={`flex items-center gap-3 px-3 py-2 border border-border rounded-lg transition-colors w-full ${type.hoverClass}`}
            >
              <type.Icon className={`w-4 h-4 flex-shrink-0 ${type.textClass}`} />
              <RelationSentenceRow typeId={type.id} source={source} target={target} statusOptions={statusOptions} />
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
        <button onClick={onCancel} className="mt-3 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors">
          Annuler
        </button>
      </div>
    </div>
  );
}
