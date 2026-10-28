/*
 * Bouton « Nouveau » de la barre d'espace (SpaceToolbar, zone toolbar-actions, à côté de « Modèle ») — source
 * unique de son style. Depuis le 2026-10-28 il n'est plus dans l'en-tête de chaque vue (#view-header) : une seule
 * place pour toutes les vues (décision Thomas). Hors barre d'espace (pages globales), il reste utilisable tel quel.
 * Bleu vif (décision Thomas 2026-09-28) pour qu'il ressorte sur la charte gris-bleu : ne pas le
 * repasser en bg-secondary ni recopier ses classes — PRIMARY_ACTION_CLASS est partagé avec « Modèle »
 * (InsertTemplateButton), même couleur (décision Thomas 2026-10-28).
 * Props : onClick (création d'item), className (ajustements de mise en page uniquement, ex. flex-shrink-0 — pas de couleur).
 * Usage : `{canEdit && onNewItem && <NewItemButton onClick={onNewItem} />}` — la condition d'affichage reste à l'appelant.
 * Aide : infobulle HelpHint (SPACE_TOOLBAR_HINTS.newItem) et repère data-tour="new-item" (étape commune des
 * tours de vues) — c'est pourquoi personne ne doit recopier ce bouton.
 */
import { Plus } from 'lucide-react';
import { HelpHint } from '../../help/HelpHint';
import { SPACE_TOOLBAR_HINTS } from '../../help/spaceToolbar.hints';

/** Style des actions principales bleues de la barre d'espace (« Nouveau », « Modèle ») — ne pas recopier ailleurs. */
export const PRIMARY_ACTION_CLASS = 'inline-flex items-center gap-1 h-7 px-2.5 rounded text-xs font-semibold bg-blue-600 text-white shadow-sm hover:bg-blue-700 transition-colors flex-shrink-0';

interface NewItemButtonProps {
  onClick: () => void;
  className?: string;
}

export function NewItemButton({ onClick, className }: NewItemButtonProps) {
  return (
    <HelpHint text={SPACE_TOOLBAR_HINTS.newItem} className="inline-flex flex-shrink-0">
      <button
        type="button"
        onClick={onClick}
        aria-label="Nouveau"
        data-tour="new-item"
        className={`${PRIMARY_ACTION_CLASS} ${className ?? ''}`}
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Nouveau</span>
      </button>
    </HelpHint>
  );
}
