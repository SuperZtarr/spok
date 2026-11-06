/*
 * Vue Articles : les éléments de type ARTICLE de l'espace (et de ses espaces enfants liés) en cartes, titre et chapeau
 * (décision Thomas 2026-11-06 : un accès direct à la lecture). Un clic ouvre la page de lecture (ArticlePage), avec
 * retour à cette vue ; le menu ⋮ donne la fiche et ses actions. La composition se fait dans le mode Composer de la fiche.
 * Props : items (déjà filtrés par SpacePage : type, statut, texte), portalGroups, callbacks du menu ⋮ comme les autres vues.
 * Aide : components/views/help/articles.help.ts.
 */
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FolderKanban, Newspaper } from 'lucide-react';
import type { Item } from '@spok/shared';
import { SpaceExportButton } from '../SpaceExportButton';
import { ViewHelpButton } from '../ViewHelpButton';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { EmptyHelp } from '../../help/EmptyHelp';
import { buildItemMenuGroups, hasChildItems, hasHeadings, type ItemMenuCallbacks } from '../../lib/itemMenuGroups';
import { articlePageUrl, articleReturnState } from '../../lib/itemOpenMode';
import { htmlToText } from '../../lib/sanitizeHtml';

interface ArticlesViewProps extends ItemMenuCallbacks {
  items: Item[] | undefined;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  portalGroups?: Array<{ spaceId: string; spaceName: string; items: Item[] }>;
  currentSpaceId?: string;
  spaceName?: string;
  viewContainerRef?: React.RefObject<HTMLDivElement>;
  onStartTour?: () => void;
  pulseHelp?: boolean;
}

const isArticle = (item: Item) => item.type === 'ARTICLE';

export function ArticlesView({ items, canEdit = true, canEditItem, portalGroups, currentSpaceId, spaceName, viewContainerRef, onStartTour, pulseHelp, ...callbacks }: ArticlesViewProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const articles = useMemo(() => (items ?? []).filter(isArticle), [items]);
  const portals = useMemo(
    () => (portalGroups ?? []).map((g) => ({ ...g, items: g.items.filter(isArticle) })).filter((g) => g.items.length > 0),
    [portalGroups],
  );

  const open = (article: Item, spaceId: string) =>
    navigate(articlePageUrl(spaceId, article.id), { state: articleReturnState(location) });

  const card = (article: Item, spaceId: string, withMenu: boolean) => {
    const chapeau = htmlToText(article.description);
    return (
      <div
        key={article.id}
        role="button"
        tabIndex={0}
        data-tour="articles-card"
        data-help-zone="articles:carte"
        onClick={() => open(article, spaceId)}
        onKeyDown={(e) => { if (e.key === 'Enter') open(article, spaceId); }}
        className="group flex items-start gap-3 p-4 rounded-lg border bg-card hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
          <Newspaper className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{article.title}</p>
          {chapeau && <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{chapeau}</p>}
        </div>
        {withMenu && (
          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            <ItemActionMenu
              groups={buildItemMenuGroups(article.id, {
                ...callbacks,
                onAbsorbChildren: hasChildItems(article) ? callbacks.onAbsorbChildren : undefined,
                onSplitDescription: hasHeadings(article.description) ? callbacks.onSplitDescription : undefined,
              }, { item: article, canEdit: canEditItem ? canEditItem(article) : canEdit })}
            />
          </div>
        )}
      </div>
    );
  };

  const header = (
    <div id="view-header" data-devzone="contenu-barre-vue" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
      <div className="flex-1" />
      <ViewHelpButton viewMode="articles" onStartTour={onStartTour} pulse={pulseHelp} />
      {spaceName && viewContainerRef && (
        <SpaceExportButton items={articles} spaceName={spaceName} viewMode="articles" viewContainerRef={viewContainerRef} />
      )}
    </div>
  );

  if (articles.length === 0 && portals.length === 0) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {header}
        <EmptyHelp mode="articles" title="Aucun article" icon={Newspaper} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {header}
      <div className="flex-1 overflow-auto p-4 space-y-4" data-help-zone="articles:liste">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {articles.map((a) => card(a, a.spaceId ?? currentSpaceId!, true))}
        </div>
        {portals.map((group) => (
          <div key={`portal-${group.spaceId}`}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-accent/50 text-sm font-medium text-muted-foreground mb-2">
              <FolderKanban className="w-4 h-4 text-primary" />
              <span>{group.spaceName}</span>
              <span className="text-xs text-muted-foreground/60">({group.items.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {group.items.map((a) => card(a, group.spaceId, false))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
