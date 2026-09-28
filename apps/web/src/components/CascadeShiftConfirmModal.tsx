/* Modale de confirmation avant d'appliquer un décalage en cascade aux éléments liés à un item
 * ancre : dépendants via la relation 'drives' ("Entraîne", toujours proposés d'un bloc avec
 * "Oui, déplacer") et/ou enfants via la hiérarchie parent/enfant (proposés séparément, case à
 * cocher décochée par défaut — la hiérarchie reste structurelle, ce n'est jamais automatique).
 * Appelée depuis ItemEditModal (sauvegarde) et TimelineView (drag du corps de barre) avec les
 * listes déjà calculées par computeCascadeDependents / computeCascadeDescendants.
 * anchorWithoutDates (TimelineView, glisser d'une barre pointillée = parent sans dates propres) :
 * seul le groupe bouge — enfants cochés par défaut, « Non, seul » devient « Annuler » (rien n'est
 * modifié), l'ancre n'est jamais datée.
 * Focus : action principale (« Oui, déplacer » / « Décaler », non destructive), Tab piégé (useDialogFocus). */
import { useRef, useState } from 'react';
import type { CascadeDependent } from '../lib/cascadeShift';
import { Button } from './ui/Button';
import { DevModalBadge } from './ui/DevModalBadge';
import { useDialogFocus } from '../hooks/useDialogFocus';

interface CascadeShiftConfirmModalProps {
  anchorTitle: string;
  deltaDays: number;
  dependents: CascadeDependent[];
  descendants: CascadeDependent[];
  onConfirm: (includeDescendants: boolean) => void;
  onCancel: () => void;
  /** Ancre sans dates propres : on ne décale que ses liés/enfants (voir en-tête). */
  anchorWithoutDates?: boolean;
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

export function CascadeShiftConfirmModal({ anchorTitle, deltaDays, dependents, descendants, onConfirm, onCancel, anchorWithoutDates = false }: CascadeShiftConfirmModalProps) {
  const [includeDescendants, setIncludeDescendants] = useState(anchorWithoutDates);
  const nothingToShift = anchorWithoutDates && dependents.length === 0 && !includeDescendants;
  const sign = deltaDays > 0 ? '+' : '';
  const plural = dependents.length > 1;
  const descendantsPlural = descendants.length > 1;
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(panelRef, true);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div ref={panelRef} className="bg-card border rounded-lg shadow-xl p-6 max-w-sm mx-4 outline-none" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-2">
          <DevModalBadge name="CascadeShiftConfirmModal" />
          <h3 className="text-lg font-semibold">{anchorWithoutDates ? 'Décaler le groupe ?' : 'Déplacer aussi les éléments liés ?'}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          {anchorWithoutDates
            ? `«${anchorTitle}» n'a pas de dates propres : décaler ses éléments de ${sign}${deltaDays} jour${Math.abs(deltaDays) > 1 ? 's' : ''}.`
            : `«${anchorTitle}» passe de ${sign}${deltaDays} jour${Math.abs(deltaDays) > 1 ? 's' : ''}.`}
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
            <Button variant="bordered" size="sm" onClick={onCancel} className="w-full justify-center">{anchorWithoutDates ? 'Annuler' : 'Non, seul'}</Button>
            <p className="text-xs text-muted-foreground text-right">
              {anchorWithoutDates
                ? 'Rien ne sera modifié.'
                : `Seul «${anchorTitle}» sera déplacé. Les liens restent actifs pour la prochaine fois.`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button size="sm" onClick={() => onConfirm(includeDescendants)} disabled={nothingToShift} className="w-full justify-center" data-autofocus>{anchorWithoutDates ? 'Décaler' : 'Oui, déplacer'}</Button>
            {anchorWithoutDates ? (
              <p className="text-xs text-muted-foreground text-right">
                {nothingToShift
                  ? 'Cochez les enfants pour décaler le groupe.'
                  : `${[
                      includeDescendants && descendants.length > 0 ? `Les ${descendants.length} enfant${descendantsPlural ? 's' : ''} daté${descendantsPlural ? 's' : ''}` : null,
                      dependents.length > 0 ? `${plural ? `les ${dependents.length} éléments entraînés` : "l'élément entraîné"} (directement ou en chaîne)` : null,
                    ].filter(Boolean).join(' et ').replace(/^l/, 'L')} seront décalés du même nombre de jours. «${anchorTitle}» reste sans dates.`}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground text-right">
                «{anchorTitle}»{dependents.length > 0 ? ` et ${plural ? `les ${dependents.length} éléments entraînés` : "l'élément entraîné"} (directement ou en chaîne)` : ''}
                {includeDescendants && descendants.length > 0 ? `${dependents.length > 0 ? ' ainsi que' : ' et'} les ${descendants.length} enfant${descendantsPlural ? 's' : ''} coché${descendantsPlural ? 's' : ''}` : ''}
                {' '}seront décalés du même nombre de jours.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
