/*
 * Sélecteur de vues d'un espace (ligne 1 de SpaceToolbar) — ergonomie décidée par Thomas le 2026-11-13 :
 * - « Présentation » en tête : lien vers la page de présentation de l'espace (/spaces/:id/overview).
 * - Favoris du mode d'interface (lib/viewFavorites, MODE_FAVORITE_VIEWS) en boutons directs, précédés du nom du mode ;
 *   l'infobulle dit qu'on change de mode dans l'en-tête.
 * - Vue affichée hors favoris : bouton temporaire en fin de ligne (bord pointillé), pour toujours voir où l'on est.
 * - « Toutes les vues » : un seul panneau (portail fixed, sinon rogné par le défilement de la barre), les 5 catégories
 *   en colonnes (une colonne sur mobile), chaque vue avec son icône, son nom, sa description (VIEW_HELP.short), étoile
 *   si favori, repère « ouverture » si vue d'ouverture de l'espace. Champ de recherche (focus à l'ouverture, Entrée
 *   ouvre la première vue trouvée, Échap ferme). Vue réservée aux écrans larges (MOBILE_HIDDEN_VIEWS) : grisée sous
 *   640 px avec « Écran plus large nécessaire », jamais retirée (CSS sm:, pas de mesure de largeur).
 * Props : viewMode / onSetMode (vue active), spaceViews (vues accessibles, useMenuItems), defaultView (vue
 * d'ouverture), spaceId (lien Présentation). Le rôle ne retire aucune vue (décision 2026-11-06).
 * Textes d'aide : help/spaceToolbar.elements.ts (vues, toutesVues, presentation) et SPACE_TOOLBAR_HINTS — jamais en dur.
 * Bouton Process en violet (demande Thomas 2026-10-29), conservé.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ChevronDown, Info, LayoutGrid, Search, Star } from 'lucide-react';
import { MOBILE_HIDDEN_VIEWS, type MenuItemConfig } from '@spok/shared';
import { getViewIcon } from '../constants/viewIcons';
import type { ViewMode } from '../stores/viewMode';
import { useInterfaceModeStore, INTERFACE_MODE_LABELS, type InterfaceMode } from '../stores/interfaceMode';
import { HelpHint } from '../help/HelpHint';
import { SPACE_TOOLBAR_HINTS as H } from '../help/spaceToolbar.hints';
import { VIEW_HELP } from '../components/views/help';
import { favoriteViews, matchesViewQuery, viewsByCategory } from '../lib/viewFavorites';

const PROCESS_VIEW_IDLE = 'bg-violet-100 text-violet-800 hover:bg-violet-200';
const PROCESS_VIEW_ACTIVE = 'bg-violet-600 text-white shadow-sm';
const PANEL_MAX_WIDTH = 980;

const viewShort = (viewMode: string | null | undefined): string | undefined =>
  VIEW_HELP[viewMode as ViewMode]?.short;

export interface SpaceViewSelectorProps {
  viewMode: ViewMode;
  onSetMode: (mode: ViewMode) => void;
  spaceViews: MenuItemConfig[];
  defaultView?: ViewMode;
  spaceId?: string;
}

export function SpaceViewSelector({ viewMode, onSetMode, spaceViews, defaultView, spaceId }: SpaceViewSelectorProps) {
  const interfaceMode = useInterfaceModeStore((s) => s.mode) as InterfaceMode;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const views = useMemo(() => spaceViews.filter((v) => v.viewMode), [spaceViews]);
  const favorites = useMemo(() => favoriteViews(views, interfaceMode), [views, interfaceMode]);
  const favoriteIds = useMemo(() => new Set(favorites.map((v) => v.viewMode)), [favorites]);
  const activeOutside = views.find((v) => v.viewMode === viewMode && !favoriteIds.has(v.viewMode));
  const categories = useMemo(() => viewsByCategory(views), [views]);
  const filtered = useMemo(
    () => categories
      .map((c) => ({ ...c, views: c.views.filter((v) => matchesViewQuery(v.label, viewShort(v.viewMode), query)) }))
      .filter((c) => c.views.length > 0),
    [categories, query],
  );

  const close = (refocus = false) => {
    setOpen(false);
    setQuery('');
    if (refocus) buttonRef.current?.focus();
  };

  const toggle = () => {
    if (open) { close(); return; }
    const r = buttonRef.current?.getBoundingClientRect();
    if (r) {
      const vw = window.innerWidth;
      const width = Math.min(PANEL_MAX_WIDTH, vw - 16);
      const left = Math.max(8, Math.min(r.left, vw - width - 8));
      setPos({ top: r.bottom + 4, left, width });
    }
    setOpen(true);
  };

  const choose = (mode: string | null | undefined) => {
    if (!mode) return;
    onSetMode(mode as ViewMode);
    close();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(true); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const renderViewButton = (v: MenuItemConfig, outside = false) => {
    const Icon = getViewIcon(v.icon);
    const isActive = viewMode === v.viewMode;
    const isDefault = !!defaultView && v.viewMode === defaultView;
    const short = viewShort(v.viewMode);
    const mobileHidden = !!v.viewMode && MOBILE_HIDDEN_VIEWS.has(v.viewMode);
    const tone = v.viewMode === 'process'
      ? (isActive ? PROCESS_VIEW_ACTIVE : PROCESS_VIEW_IDLE)
      : isActive
      ? 'bg-primary text-primary-foreground shadow-sm'
      : 'text-muted-foreground hover:text-foreground hover:bg-accent';
    const hint = `${v.label}${isDefault ? ` (${H.defaultView})` : ''}${short ? ` : ${short}` : ''}${outside ? ` — ${H.outsideFavorites}` : ''}`;
    return (
      <HelpHint key={v.key} text={hint} className={`inline-flex flex-shrink-0 ${mobileHidden ? 'hidden sm:inline-flex' : ''}`}>
        <button
          onClick={() => choose(v.viewMode)}
          aria-label={v.label}
          aria-pressed={isActive}
          className={`relative inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${tone} ${outside ? 'border border-dashed border-primary/60' : ''}`}
        >
          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="hidden sm:inline">{v.label}</span>
          {isDefault && !isActive && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </button>
      </HelpHint>
    );
  };

  return (
    <>
      <div data-tour="toolbar-views" data-devzone="toolbar-vues" className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
        {spaceId && (
          <HelpHint text={H.presentation} className="inline-flex flex-shrink-0">
            <Link
              to={`/spaces/${spaceId}/overview`}
              aria-label="Présentation de l'espace"
              data-tour="toolbar-presentation"
              className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors whitespace-nowrap"
            >
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">Présentation</span>
            </Link>
          </HelpHint>
        )}
        {spaceId && <div className="h-4 w-px bg-border mx-1 flex-shrink-0" />}

        {favorites.length > 0 && (
          <HelpHint text={H.modeFavorites} className="hidden sm:inline-flex flex-shrink-0">
            <span className="text-[11px] font-medium text-muted-foreground px-1 whitespace-nowrap">
              {INTERFACE_MODE_LABELS[interfaceMode] ?? INTERFACE_MODE_LABELS.tous} ·
            </span>
          </HelpHint>
        )}
        {favorites.map((v) => renderViewButton(v))}
        {activeOutside && renderViewButton(activeOutside, true)}

        <div className="h-4 w-px bg-border mx-1 flex-shrink-0" />
        <HelpHint text={H.allViews} className="inline-flex flex-shrink-0">
          <button
            ref={buttonRef}
            onClick={toggle}
            aria-expanded={open}
            aria-haspopup="dialog"
            data-tour="toolbar-all-views"
            className={`inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium transition-colors whitespace-nowrap border border-input ${
              open ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Toutes les vues</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </HelpHint>
      </div>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Toutes les vues"
          className="fixed bg-card border border-border rounded-md shadow-xl p-2 max-h-[70vh] overflow-y-auto"
          style={{ top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
        >
          <div className="flex items-center gap-2 px-2 h-8 mb-2 rounded border border-input bg-background">
            <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') choose(filtered[0]?.views[0]?.viewMode); }}
              placeholder="Rechercher une vue…"
              aria-label="Rechercher une vue"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">{H.allViewsEmpty}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-x-3 gap-y-2">
              {filtered.map((cat) => (
                <div key={cat.id} className="min-w-0">
                  <div className="px-2 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{cat.label}</div>
                  {cat.views.map((v) => {
                    const Icon = getViewIcon(v.icon);
                    const isActive = viewMode === v.viewMode;
                    const isFavorite = favoriteIds.has(v.viewMode);
                    const isDefault = !!defaultView && v.viewMode === defaultView;
                    const mobileHidden = !!v.viewMode && MOBILE_HIDDEN_VIEWS.has(v.viewMode);
                    const body = (
                      <>
                        <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${v.viewMode === 'process' ? 'text-violet-600' : ''}`} />
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-1">
                            <span className="truncate">{v.label}</span>
                            {isFavorite && <Star className="w-3 h-3 flex-shrink-0 fill-amber-400 text-amber-400" aria-label="Favori du mode" />}
                            {isDefault && <span className="text-[9px] uppercase tracking-wide text-primary flex-shrink-0">ouverture</span>}
                            {isActive && <span className="ml-auto text-primary text-xs flex-shrink-0">✓</span>}
                          </span>
                          <span className="block text-[11px] leading-snug text-muted-foreground">{viewShort(v.viewMode)}</span>
                        </span>
                      </>
                    );
                    return (
                      <div key={v.key}>
                        <button
                          onClick={() => choose(v.viewMode)}
                          className={`w-full items-start gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors ${mobileHidden ? 'hidden sm:flex' : 'flex'} ${
                            isActive ? 'bg-accent text-foreground font-medium' : 'text-foreground/90 hover:bg-accent hover:text-foreground'
                          }`}
                        >
                          {body}
                        </button>
                        {mobileHidden && (
                          <div className="flex sm:hidden w-full items-start gap-2 px-2 py-1.5 text-sm text-muted-foreground opacity-60" aria-disabled="true">
                            <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                            <span className="flex-1 min-w-0">
                              <span className="block">{v.label}</span>
                              <span className="block text-[11px]">{H.wideScreenOnly}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
