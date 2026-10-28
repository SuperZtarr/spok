/*
 * Bouton « Modèle » (insérer un modèle) de la barre d'espace, juste à droite de « Nouveau » (SpaceToolbar,
 * toolbar-actions) — même bleu que « Nouveau » (PRIMARY_ACTION_CLASS, décision Thomas 2026-10-28).
 * Props : onClick (ouvre InsertTemplateModal). La condition d'affichage (canEdit) reste à l'appelant.
 * Aide : infobulle HelpHint (SPACE_TOOLBAR_HINTS.insertTemplate) et repère data-tour="toolbar-template" (étape commune
 * des tours, help/commonTourSteps.ts). Libellé masqué sur écran étroit, comme « Nouveau ».
 */
import { LayoutTemplate } from 'lucide-react';
import { HelpHint } from '../../help/HelpHint';
import { SPACE_TOOLBAR_HINTS } from '../../help/spaceToolbar.hints';
import { PRIMARY_ACTION_CLASS } from './NewItemButton';

export function InsertTemplateButton({ onClick }: { onClick: () => void }) {
  return (
    <HelpHint text={SPACE_TOOLBAR_HINTS.insertTemplate} className="inline-flex flex-shrink-0">
      <button type="button" onClick={onClick} aria-label="Insérer un modèle" data-tour="toolbar-template" className={PRIMARY_ACTION_CLASS}>
        <LayoutTemplate className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Modèle</span>
      </button>
    </HelpHint>
  );
}
