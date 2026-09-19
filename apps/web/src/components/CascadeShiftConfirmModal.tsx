/* Modale de confirmation avant d'appliquer un décalage en cascade aux éléments liés à un item
 * ancre : dépendants via la relation 'drives' ("Entraîne", toujours proposés d'un bloc avec
 * "Oui, déplacer") et/ou enfants via la hiérarchie parent/enfant (proposés séparément, case à
 * cocher décochée par défaut — la hiérarchie reste structurelle, ce n'est jamais automatique).
 * Appelée depuis ItemEditModal (sauvegarde) et TimelineView (drag du corps de barre) avec les
 * listes déjà calculées par computeCascadeDependents / computeCascadeDescendants. */
import { useState } from 'react';
import type { CascadeDependent } from '../lib/cascadeShift';
import { Button } from './ui/Button';
import { DevModalBadge } from './ui/DevModalBadge';

interface CascadeShiftConfirmModalProps {
  anchorTitle: string;
  deltaDays: number;
  dependents: CascadeDependent[];
  descendants: CascadeDependent[];
  onConfirm: (includeDescendants: boolean) => void;
  onCancel: () => void;
}

function CascadeList({ items }: { items: CascadeDependent[] }) {
  return (
    <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
      {items.map((d) => (
        <li key={d.id} className="flex justify-between gap-2">
          <span className="truncate">{d.title}</span>
          <span className="text-muted-foreground whitespace-nowrap">{d.beforeLabel} → {d.afterLabel}</span>
        </li>
      ))}
    </ul>
  );
}

export function CascadeShiftConfirmModal({ anchorTitle, deltaDays, dependents, descendants, onConfirm, onCancel }: CascadeShiftConfirmModalProps) {
  const [includeDescendants, setIncludeDescendants] = useState(false);
  const sign = deltaDays > 0 ? '+' : '';
  const plural = dependents.length > 1;
  const descendantsPlural = descendants.length > 1;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="bg-card border rounded-lg shadow-xl p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-2">
          <DevModalBadge name="CascadeShiftConfirmModal" />
          <h3 className="text-lg font-semibold">Déplacer aussi les éléments liés ?</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          «{anchorTitle}» passe de {sign}{deltaDays} jour{Math.abs(deltaDays) > 1 ? 's' : ''}.
        </p>

        {dependents.length > 0 && (
          <div className="mb-3">
            <p className="text-sm text-muted-foreground mb-1">
              {dependents.length} élément{plural ? 's' : ''} entraîné{plural ? 's' : ''} (relation "Entraîne") :
            </p>
            <CascadeList items={dependents} />
          </div>
        )}

        {descendants.length > 0 && (
          <div className="mb-3 border-t pt-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer mb-1">
              <input
                type="checkbox"
                checked={includeDescendants}
                onChange={(e) => setIncludeDescendants(e.target.checked)}
              />
              Décaler aussi les {descendants.length} enfant{descendantsPlural ? 's' : ''}
            </label>
            {includeDescendants && <CascadeList items={descendants} />}
          </div>
        )}

        <div className="flex flex-col gap-3 mt-1">
          <div className="flex flex-col items-end gap-1">
            <Button variant="bordered" size="sm" onClick={onCancel} className="w-full justify-center">Non, seul</Button>
            <p className="text-xs text-muted-foreground text-right">
              Seul «{anchorTitle}» sera déplacé. Les liens restent actifs pour la prochaine fois.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button size="sm" onClick={() => onConfirm(includeDescendants)} className="w-full justify-center">Oui, déplacer</Button>
            <p className="text-xs text-muted-foreground text-right">
              «{anchorTitle}»{dependents.length > 0 ? ` et ${plural ? `les ${dependents.length} éléments entraînés` : "l'élément entraîné"} (directement ou en chaîne)` : ''}
              {includeDescendants && descendants.length > 0 ? `${dependents.length > 0 ? ' ainsi que' : ' et'} les ${descendants.length} enfant${descendantsPlural ? 's' : ''} coché${descendantsPlural ? 's' : ''}` : ''}
              {' '}seront décalés du même nombre de jours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
