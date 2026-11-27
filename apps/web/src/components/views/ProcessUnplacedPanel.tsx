/*
 * ProcessUnplacedPanel — panneau gauche du canevas d'un process : éléments de l'espace du process pas encore posés
 * (unplacedItems, filtrés par ProcessView : ni placés, ni titres de couloir). Enveloppe du panneau partagé ElementTray,
 * uniformisé avec celui d'un article (demande Thomas 2026-11-26) : même titre « À ajouter », même forme (TRAY_CLASS),
 * mêmes boutons sous la recherche (Ajouter d'un autre espace, Texte) et de ligne (« + » puis « Définir comme couloir »).
 * Glisser une ligne la pose à l'endroit lâché (type MIME PROCESS_DRAG_TYPE = id ; dépôt géré par ProcessView) ;
 * « + » la pose au centre de la vue (onAdd) — le glisser n'est jamais le seul accès. « Texte » crée un élément dans
 * l'espace du process, posé au centre (onAddText). Non glissable si !canEdit. Textes : help/process.help.ts (hints).
 */
import { Plus, Rows3, Type } from 'lucide-react';
import type { Item } from '@spok/shared';
import { ElementTray, TRAY_CLASS, TrayActionButton, TrayElsewhereButton, TrayRowButton } from '../ElementTray';
import { help as processHelp } from './help/process.help';

/** Infobulles — textes dans la fiche d'aide (process.help.ts, hints). */
const PH = processHelp.hints!;

export const PROCESS_DRAG_TYPE = 'application/spok-item-id';

interface ProcessUnplacedPanelProps {
  items: Item[];
  canEdit: boolean;
  /** « + » d'une ligne : pose l'élément au centre de la vue */
  onAdd?: (itemId: string) => void;
  /** « Texte » : crée un élément dans l'espace du process et le pose au centre */
  onAddText?: () => void;
  /** « Définir comme couloir » (bouton d'une ligne) : l'élément devient un couloir du process */
  onMakeLane?: (itemId: string) => void;
  /** « Ajouter d'un autre espace » : ouvre la recherche d'éléments de tous les espaces lisibles */
  onSearchElsewhere?: () => void;
}

export function ProcessUnplacedPanel({ items, canEdit, onAdd, onAddText, onMakeLane, onSearchElsewhere }: ProcessUnplacedPanelProps) {
  return (
    <div className="flex flex-shrink-0" data-tour="process-unplaced" data-help-zone="process:panneau">
    <ElementTray
      items={items}
      canEdit={canEdit}
      dragType={PROCESS_DRAG_TYPE}
      labels={{ title: 'À ajouter', empty: PH.trayEmpty ?? 'Tous les éléments de l\'espace sont posés', dragHint: PH.trayDrag }}
      headerExtra={(<>
        {onSearchElsewhere && <div data-tour="process-elsewhere"><TrayElsewhereButton onClick={onSearchElsewhere} hint={PH.searchElsewhere} /></div>}
        {onAddText && <TrayActionButton onClick={onAddText} hint={PH.addText ?? ''} icon={Type} label="Texte" />}
      </>)}
      rowAction={(item) => (<>
        {onAdd && <TrayRowButton onClick={() => onAdd(item.id)} hint={PH.trayAdd ?? ''} icon={Plus} label={`Poser « ${item.title || 'Sans titre'} » au centre`} />}
        {onMakeLane && <TrayRowButton onClick={() => onMakeLane(item.id)} hint={PH.makeLane} icon={Rows3} label="Définir comme couloir" />}
      </>)}
      className={TRAY_CLASS}
    />
    </div>
  );
}
