/* Vue Bugs : éléments qui portent le tag suivi (« bug » par défaut), en liste avec statuts — depuis le lot 4 « contenus
 * multiples » (2026-11-11), une anomalie est une Tâche taguée, plus un type. Tag suivi : referentiels.bugsViewTag de la
 * communauté (DEFAULT_BUGS_VIEW_TAG sinon), comparé sans casse. onChangeBugsTag : fourni par SpacePage au seul
 * propriétaire de la communauté (ou admin en mode admin) → sélecteur dans l'en-tête ; les autres voient le tag en
 * lecture. Choix proposés : tags présents sur les éléments de l'espace, plus le tag suivi. Règle : bugs-view-tag. */
import { useMemo } from 'react';
import { Bug } from 'lucide-react';
import { ListView } from './ListView';
import { SpaceExportButton } from '../SpaceExportButton';
import { ViewHelpButton } from '../ViewHelpButton';
import type { Item, SpaceReferentiels } from '@spok/shared';
import { DEFAULT_BUGS_VIEW_TAG } from '@spok/shared';
import { EmptyHelp } from '../../help/EmptyHelp';

interface PortalGroup {
  spaceId: string;
  spaceName: string;
  items: Item[];
}

interface BugsViewProps {
  items: Item[] | undefined;
  currentSpaceId?: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  onOpen?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
  portalGroups?: PortalGroup[];
  spaceName?: string;
  viewContainerRef?: React.RefObject<HTMLDivElement>;
  onStartTour?: () => void;
  pulseHelp?: boolean;
  /** Change le tag suivi (référentiels de la communauté) ; absent = lecture seule */
  onChangeBugsTag?: (name: string) => void;
}

const hasTag = (item: Item, tag: string) => (item.tags ?? []).some((t) => t.name.toLowerCase() === tag.toLowerCase());

export function BugsView({ items, portalGroups, spaceName, viewContainerRef, onStartTour, pulseHelp, canEdit = true, onChangeBugsTag, ...rest }: BugsViewProps) {
  const tag = rest.referentiels?.bugsViewTag || DEFAULT_BUGS_VIEW_TAG;
  const bugs = useMemo(() => {
    if (!items) return [];
    return items.filter(item => hasTag(item, tag));
  }, [items, tag]);

  // Tags proposés : ceux des éléments de l'espace, plus le tag suivi (même s'il n'est encore posé nulle part)
  const tagChoices = useMemo(() => {
    const names = new Map<string, string>([[tag.toLowerCase(), tag]]);
    for (const item of items ?? []) for (const t of item.tags ?? []) if (!names.has(t.name.toLowerCase())) names.set(t.name.toLowerCase(), t.name);
    return [...names.values()].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [items, tag]);

  const bugPortalGroups = useMemo(() => {
    if (!portalGroups?.length) return undefined;
    return portalGroups
      .map(g => ({ ...g, items: g.items.filter(item => hasTag(item, tag)) }))
      .filter(g => g.items.length > 0);
  }, [portalGroups, tag]);

  const header = (
    <div id="view-header" data-devzone="contenu-barre-vue" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground" data-help-zone="bugs:tag" data-tour="bugs-tag">
        <span>Tag suivi</span>
        {onChangeBugsTag ? (
          <select
            value={tag}
            onChange={(e) => onChangeBugsTag(e.target.value)}
            className="h-7 rounded border border-border bg-background px-1.5 text-xs text-foreground"
            aria-label="Tag suivi par la vue Bugs"
          >
            {tagChoices.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        ) : (
          <span className="rounded border border-border px-1.5 py-0.5 text-foreground">{tag}</span>
        )}
      </label>
      <div className="flex-1" />
      <ViewHelpButton viewMode="bugs" onStartTour={onStartTour} pulse={pulseHelp} />
      {spaceName && viewContainerRef && (
        <SpaceExportButton items={items ?? []} spaceName={spaceName} viewMode="bugs" viewContainerRef={viewContainerRef} />
      )}
    </div>
  );

  if (bugs.length === 0 && (!bugPortalGroups || bugPortalGroups.length === 0)) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {header}
        <EmptyHelp mode="bugs" title={`Aucun élément tagué « ${tag} »`} icon={Bug} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" data-help-zone="bugs:contenu">
      {header}
      <ListView items={bugs} portalGroups={bugPortalGroups} hideToolbar canEdit={canEdit} {...rest} />
    </div>
  );
}
