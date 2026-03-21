import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FolderTree, Users, Eye, CalendarRange, GitBranch, Palette, Globe, FolderOpen,
  List, Columns3, GanttChart, Network, Share2, CircleDot, Waypoints, Circle,
  FileText, LayoutGrid, CalendarCheck, Calendar, Orbit, SquareStack, Disc,
  TrendingDown, Layers, Table2, Grid3x3, Focus, Flame,
} from 'lucide-react';
import { communitiesApi } from '../lib/api';
import { useMenuItems } from '../hooks/useMenuItems';

const VIEW_ICONS: Record<string, typeof List> = {
  List, GitBranch, Columns3, FileText, CalendarCheck, GanttChart, Calendar, LayoutGrid,
  Share2, Network, CircleDot, Waypoints, Circle, Orbit, SquareStack, Disc,
  TrendingDown, Layers, Users, Flame, Table2, Grid3x3, Focus,
};

const VIEW_DESCRIPTIONS: Record<string, string> = {
  list: 'Vue tabulaire avec tri, filtres et recherche',
  tree: 'Hiérarchie parent-enfant avec drag & drop',
  kanban: 'Colonnes par statut, glisser-déposer',
  text: 'Affichage éditorial des contenus',
  planning: 'Vue par périodes et jalons',
  timeline: 'Diagramme de Gantt avec dépendances',
  calendar: 'Vue mensuelle des échéances',
  types: 'Grille groupée par type d\'item',
  mindmap: 'Carte mentale interactive avec zones projet',
  graph: 'Réseau force-directed interactif',
  sunburst: 'Diagramme solaire hiérarchique',
  relations: 'Carte des relations entre items',
  bubble: 'Cercles imbriqués proportionnels',
  radialTree: 'Arbre radial concentrique',
  treemap: 'Rectangles proportionnels à la taille',
  chord: 'Diagramme de flux entre catégories',
  burndown: 'Courbe d\'avancement du sprint',
  cfd: 'Flux cumulatif d\'avancement',
  members: 'Kanban groupé par membre assigné',
  priority: 'Kanban groupé par niveau de priorité',
  crossTable: 'Tableau croisé dynamique',
  heatmap: 'Carte de chaleur de l\'activité temporelle',
  ego: 'Réseau égocentrique autour d\'un item',
};

const features = [
  {
    icon: FolderTree,
    title: 'Centralisez tout',
    description: 'Projets, notes, reunions, documents, bugs, liens, images — regroupez toutes vos informations au meme endroit. Un seul outil pour tout retrouver.',
  },
  {
    icon: Palette,
    title: 'Organisez a votre facon',
    description: 'Espaces, sous-espaces, statuts, types, tags, priorites : chaque equipe adapte SPOK a sa maniere de travailler. 8 templates pour demarrer vite.',
  },
  {
    icon: Eye,
    title: 'Visualisez a votre maniere',
    description: '23 vues differentes parce que chacun apprehende les donnees a sa facon : kanban, gantt, graphe, carte mentale, sunburst, heatmap, tableau croise... Changez de perspective en un clic.',
  },
  {
    icon: Users,
    title: 'Collaborez et partagez',
    description: 'Creez des communautes, invitez vos collaborateurs, contribuez ensemble. Ouvrez au public ou gardez prive — trois niveaux de visibilite pour controler qui voit quoi.',
  },
  {
    icon: CalendarRange,
    title: 'Planifiez et suivez l\'avancement',
    description: 'Timeline, calendrier, tableau de bord, echeances, priorites. Suivez l\'avancement des travaux en temps reel pour garder le cap.',
  },
  {
    icon: GitBranch,
    title: 'Reliez vos idees',
    description: 'Connectez vos elements entre eux pour construire un reseau de connaissances. Visualisez les dependances et les liens.',
  },
];

const btnBase = 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
const btnDefault = `${btnBase} bg-primary text-primary-foreground shadow hover:bg-primary/90`;
const btnOutline = `${btnBase} border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground`;

export function LandingPage() {
  const { data: publicCommunities } = useQuery({
    queryKey: ['communities', 'public'],
    queryFn: () => communitiesApi.listPublic(),
  });

  const { allItems } = useMenuItems();
  // Show all space views on landing
  const views = allItems.filter(v => v.viewMode && v.visible).sort((a, b) => a.order - b.order);

  return (
    <div className="flex-1 overflow-auto bg-background text-foreground">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 -mt-4 text-center">
        <img src="/logo.png" alt="SPOK" className="mx-auto -mb-16 h-72 w-auto sm:h-96" />
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl leading-none">
          SPOK
        </h1>
        <p className="-mt-1 text-xl font-medium tracking-wide text-muted-foreground sm:text-2xl">
          Single Point Of Knowledge
        </p>
        <p className="mx-auto mt-0.5 max-w-2xl text-lg text-muted-foreground">
          L'outil collaboratif pour structurer vos projets, relier vos idées
          et les explorer sous {views.length} vues différentes.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/login" className={`${btnDefault} h-10 rounded-md px-8`}>
            Se connecter
          </Link>
          {publicCommunities && publicCommunities.length > 0 && (
            <a href="#public-communities" className={`${btnOutline} h-10 rounded-md px-8`}>
              Découvrez sans connexion
            </a>
          )}
        </div>
      </section>

      {/* Public communities */}
      {publicCommunities && publicCommunities.length > 0 && (
        <section id="public-communities" className="border-t py-16 scroll-mt-24">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-2 text-center text-2xl font-bold">
              Communautés publiques
            </h2>
            <p className="mb-8 text-center text-muted-foreground">
              Explorez librement ces communautés ouvertes — aucune inscription requise
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {publicCommunities.map((c) => (
                <Link
                  key={c.id}
                  to={`/communities/${c.id}`}
                  className="border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-md transition-all bg-card"
                >
                  {/* Cover + Avatar */}
                  <div className="relative">
                    {c.coverUrl ? (
                      <div className="aspect-[3/1] overflow-hidden"><img src={c.coverUrl} alt="" className="w-full h-full object-cover" style={{ objectPosition: `center ${(c as any).coverPosition ?? 50}%`, transform: `scale(${((c as any).coverZoom ?? 100) / 100})`, transformOrigin: `center ${(c as any).coverPosition ?? 50}%` }} /></div>
                    ) : (
                      <div className="aspect-[3/1] bg-gradient-to-r from-primary/10 to-primary/5" />
                    )}
                    <div className="absolute -bottom-4 left-4">
                      {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt="" className="w-12 h-12 rounded-xl border-4 border-background object-cover shadow" />
                      ) : c.coverUrl ? (
                        <img src={c.coverUrl} alt="" className="w-12 h-12 rounded-xl border-4 border-background object-cover shadow" style={{ objectPosition: 'top right' }} />
                      ) : (
                        <div className="w-12 h-12 rounded-xl border-4 border-background bg-primary/10 flex items-center justify-center shadow">
                          <Globe className="w-5 h-5 text-primary" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="pt-8 px-4 pb-4">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{c.name}</p>
                      <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    </div>
                    {c.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {c.memberCount} membre{c.memberCount !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <FolderOpen className="w-3.5 h-3.5" />
                        {c.spaceCount} espace{c.spaceCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features + Views */}
      <section className="border-t bg-muted/50 py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="mb-2 text-center text-2xl font-bold">
            Tout ce qu'il faut pour avancer
          </h2>
          <p className="mb-10 text-center text-muted-foreground">
            Structurez, collaborez, visualisez — chaque vue offre une perspective unique
          </p>

          {/* Core features */}
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-12">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-lg border bg-card p-5 shadow-sm"
              >
                <f.icon className="mb-3 h-7 w-7 text-primary" />
                <h3 className="mb-1 text-base font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>

          {/* Views by category — from config */}
          <h3 className="mb-6 text-center text-lg font-semibold">
            {views.length} vues pour explorer vos données
          </h3>
          <div className="space-y-8">
            {['basic', 'planning', 'exploration'].map((sectionId) => {
              const sectionViews = views.filter(v => v.section === sectionId);
              if (sectionViews.length === 0) return null;
              const sectionLabel = sectionViews[0]?.sectionLabel || sectionId;
              return (
                <div key={sectionId}>
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{sectionLabel}</h4>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {sectionViews.map((v) => {
                      const Icon = VIEW_ICONS[v.icon] || List;
                      return (
                        <div
                          key={v.key}
                          className="flex items-start gap-3 rounded-lg border bg-card p-4"
                        >
                          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                          <div>
                            <p className="font-medium">{v.label}</p>
                            <p className="text-sm text-muted-foreground">{VIEW_DESCRIPTIONS[v.viewMode || ''] || ''}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

    </div>
  );
}
