/* Modale de confirmation avant d'appliquer un décalage en cascade aux dépendants d'un item ancre
 * (relation 'drives' — "Entraîne"). Appelée depuis ItemEditModal (sauvegarde) et TimelineView
 * (drag du corps de barre) avec la liste déjà calculée par computeCascadeDependents. */
import type { CascadeDependent } from '../lib/cascadeShift';
import { Button } from './ui/Button';
import { DevModalBadge } from './ui/DevModalBadge';

interface CascadeShiftConfirmModalProps {
  anchorTitle: string;
  deltaDays: number;
  dependents: CascadeDependent[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function CascadeShiftConfirmModal({ anchorTitle, deltaDays, dependents, onConfirm, onCancel }: CascadeShiftConfirmModalProps) {
  const sign = deltaDays > 0 ? '+' : '';
  const plural = dependents.length > 1;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="bg-card border rounded-lg shadow-xl p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-2">
          <DevModalBadge name="CascadeShiftConfirmModal" />
          <h3 className="text-lg font-semibold">Déplacer aussi les éléments liés ?</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          «{anchorTitle}» passe de {sign}{deltaDays} jour{Math.abs(deltaDays) > 1 ? 's' : ''}.
          {' '}{dependents.length} élément{plural ? 's' : ''} lié{plural ? 's' : ''} {plural ? 'seront' : 'sera'} décalé{plural ? 's' : ''} :
        </p>
        <ul className="text-sm mb-4 space-y-1 max-h-48 overflow-y-auto">
          {dependents.map((d) => (
            <li key={d.id} className="flex justify-between gap-2">
              <span className="truncate">{d.title}</span>
              <span className="text-muted-foreground whitespace-nowrap">{d.beforeLabel} → {d.afterLabel}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col items-end gap-1">
            <Button variant="bordered" size="sm" onClick={onCancel} className="w-full justify-center">Non, seul</Button>
            <p className="text-xs text-muted-foreground text-right">
              Seul «{anchorTitle}» sera déplacé. Le lien "Entraîne" reste actif pour la prochaine fois.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button size="sm" onClick={onConfirm} className="w-full justify-center">Oui, déplacer</Button>
            <p className="text-xs text-muted-foreground text-right">
              «{anchorTitle}» et {plural ? `les ${dependents.length} éléments entraînés` : "l'élément entraîné"} (directement ou en chaîne) seront décalés du même nombre de jours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
