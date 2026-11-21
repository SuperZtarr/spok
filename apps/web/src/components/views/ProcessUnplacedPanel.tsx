/*
 * ProcessUnplacedPanel — panneau gauche de la vue Process : éléments de l'espace du process pas encore posés sur le
 * canevas (unplacedItems, filtrés par ProcessView : ni placés, ni titres de couloir). Enveloppe du panneau partagé
 * ElementTray (arbre, recherche à plat, repli, lignes glissables — même modèle que le Composer d'un article,
 * 2026-11-21). Glisser un parent ne pose que lui. Type MIME PROCESS_DRAG_TYPE = id de l'élément ; le dépôt est géré
 * par ProcessView. Non glissable si !canEdit.
 * Spécifique au Process : bouton au survol « Définir comme couloir » (onMakeLane) ; « Ajouter d'un autre espace »
 * (onSearchElsewhere) ouvre la recherche de ProcessView — la pose d'un élément venu d'ailleurs ne repose pas sur un
 * geste caché. Textes : help/process.help.ts (hints).
 */
import { Rows3 } from 'lucide-react';
import type { Item } from '@spok/shared';
import { HelpHint } from '../../help/HelpHint';
import { ElementTray, TrayElsewhereButton } from '../ElementTray';
import { help as processHelp } from './help/process.help';

/** Infobulles — textes dans la fiche d'aide (process.help.ts, hints). */
const PH = processHelp.hints!;

export const PROCESS_DRAG_TYPE = 'application/spok-item-id';

interface ProcessUnplacedPanelProps {
  items: Item[];
  canEdit: boolean;
  /** « Définir comme couloir » (bouton au survol d'une ligne) : l'item devient un couloir du process */
  onMakeLane?: (itemId: string) => void;
  /** « Ajouter d'un autre espace » : ouvre la recherche d'éléments de tous les espaces lisibles */
  onSearchElsewhere?: () => void;
}

export function ProcessUnplacedPanel({ items, canEdit, onMakeLane, onSearchElsewhere }: ProcessUnplacedPanelProps) {
  return (
    <div className="flex flex-shrink-0" data-tour="process-unplaced" data-help-zone="process:panneau">
    <ElementTray
      items={items}
      canEdit={canEdit}
      dragType={PROCESS_DRAG_TYPE}
      labels={{ title: 'Non placés', empty: 'Tous les éléments de l\'espace sont placés' }}
      headerExtra={onSearchElsewhere ? (
        <div data-tour="process-elsewhere"><TrayElsewhereButton onClick={onSearchElsewhere} hint={PH.searchElsewhere} /></div>
      ) : undefined}
      rowAction={onMakeLane ? (item) => (
        <HelpHint text={PH.makeLane} className="inline-flex flex-shrink-0">
          <button
            type="button"
            onClick={() => onMakeLane(item.id)}
            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-background hover:text-foreground"
            aria-label="Définir comme couloir"
          >
            <Rows3 className="w-3.5 h-3.5" />
          </button>
        </HelpHint>
      ) : undefined}
    />
    </div>
  );
}
