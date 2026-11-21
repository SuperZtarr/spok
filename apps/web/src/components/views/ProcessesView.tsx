/*
 * Vue « Process » d'un espace, sans process ouvert (2026-11-21) : les éléments de type PROCESS de l'espace en cartes
 * (titre, chapeau = description), comme la vue Articles. Un clic ouvre le canevas du process (onOpenProcess → SpacePage
 * passe ?process=<id> dans l'adresse, ProcessView s'affiche) ; le menu ⋮ donne la fiche et ses actions habituelles.
 * Bouton « Nouveau process » (canEdit) : onCreateProcess crée l'élément Process et ouvre sa fiche (titre, chapeau).
 * Props : items (déjà filtrés par SpacePage : type, statut, texte), callbacks du menu ⋮ comme les autres vues.
 * Seuls les process de l'espace courant (pas ceux des sous-espaces inclus) : un process s'ouvre dans son espace.
 * Aide : components/views/help/process.help.ts (éléments liste, nouveau ; hints listEmpty).
 */
import { useMemo } from 'react';
import { Plus, Workflow } from 'lucide-react';
import type { Item } from '@spok/shared';
import { ViewHelpButton } from '../ViewHelpButton';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { HelpHint } from '../../help/HelpHint';
import { buildItemMenuGroups, hasChildItems, hasHeadings, type ItemMenuCallbacks } from '../../lib/itemMenuGroups';
import { htmlToText } from '../../lib/sanitizeHtml';
import { help as processHelp } from './help/process.help';

const PH = processHelp.hints!;

interface ProcessesViewProps extends ItemMenuCallbacks {
  items: Item[] | undefined;
  currentSpaceId: string;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  onOpenProcess: (item: Item) => void;
  onCreateProcess?: () => void;
  onStartTour?: () => void;
  pulseHelp?: boolean;
}

export function ProcessesView({ items, currentSpaceId, canEdit = true, canEditItem, onOpenProcess, onCreateProcess, onStartTour, pulseHelp, ...callbacks }: ProcessesViewProps) {
  const processes = useMemo(
    () => (items ?? []).filter((i) => i.type === 'PROCESS' && i.spaceId === currentSpaceId),
    [items, currentSpaceId],
  );

  const header = (
    <div id="view-header" data-devzone="contenu-barre-vue" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
      {canEdit && onCreateProcess && (
        <HelpHint text={PH.newProcess}>
          <button
            type="button"
            onClick={onCreateProcess}
            data-tour="process-new"
            className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="w-3.5 h-3.5" /> Nouveau process
          </button>
        </HelpHint>
      )}
      <div className="flex-1" />
      <ViewHelpButton viewMode="process" onStartTour={onStartTour} pulse={pulseHelp} />
    </div>
  );

  if (processes.length === 0) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {header}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center" data-help-zone="process:liste">
          <Workflow className="w-10 h-10 text-muted-foreground/50" />
          <p className="font-medium">Aucun process</p>
          <p className="max-w-md text-sm text-muted-foreground">{PH.listEmpty}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {header}
      <div className="flex-1 overflow-auto p-4" data-help-zone="process:liste">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {processes.map((p) => {
            const chapeau = htmlToText(p.description);
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                data-tour="process-card"
                onClick={() => onOpenProcess(p)}
                onKeyDown={(e) => { if (e.key === 'Enter') onOpenProcess(p); }}
                className="group flex items-start gap-3 p-4 rounded-lg border bg-card hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Workflow className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.title || 'Sans titre'}</p>
                  {chapeau && <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{chapeau}</p>}
                </div>
                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <ItemActionMenu
                    groups={buildItemMenuGroups(p.id, {
                      ...callbacks,
                      onAbsorbChildren: hasChildItems(p) ? callbacks.onAbsorbChildren : undefined,
                      onSplitDescription: hasHeadings(p.description) ? callbacks.onSplitDescription : undefined,
                    }, { item: p, canEdit: canEditItem ? canEditItem(p) : canEdit })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
