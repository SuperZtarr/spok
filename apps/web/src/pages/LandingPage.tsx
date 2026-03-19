import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FolderTree, Users, Eye, CalendarRange, GitBranch, Palette, History, Globe, FolderOpen,
  List, Columns3, GanttChart, Network, Share2, CircleDot, Waypoints, Circle,
  FileText, LayoutGrid, CalendarCheck, Calendar, Orbit, SquareStack, Disc,
  TrendingDown, Layers, Table2, Grid3x3, Focus, Flame,
} from 'lucide-react';
import { communitiesApi } from '../lib/api';
import { useViewConfig } from '../hooks/useViewConfig';
import { PublicHeader } from '../components/PublicHeader';
import { PublicFooter } from '../components/PublicFooter';
import { HelpBubble } from '../components/PublicPageLayout';
import type { ViewConfigItem } from '@spok/shared';

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
    title: 'Structurer',
    description: '11 types d\'items (projets, taches, notes, reunions, periodes, liens, documents, images, bugs, diagrammes) dans des espaces hierarchiques avec sous-espaces.',
  },
  {
    icon: Users,
    title: 'Collaborer',
    description: 'Communautes avec roles (owner/membre), contributions sur chaque item, invitations par email, notifications en temps reel, assignation de taches.',
  },
  {
    icon: Eye,
    title: 'Visualiser',
    description: 'Plus de 20 vues : liste, kanban, gantt, graphe, carte mentale, sunburst, bulles, heatmap, burndown, tableau croise, treemap, diagramme chord...',
  },
  {
    icon: CalendarRange,
    title: 'Planifier',
    description: 'Timeline Gantt avec dependances, calendrier semaine/mois, tableau de bord avec KPIs, taches prioritaires, echeances et progression par espace.',
  },
  {
    icon: GitBranch,
    title: 'Lier',
    description: 'Relations typees entre items (depends de, lie a, parent de...). Graphe interactif, reseau egocentrique, diagramme chord des flux entre categories.',
  },
  {
    icon: Palette,
    title: 'Personnaliser',
    description: 'Statuts et types personnalisables par espace, tags colores, 8 templates d\'espaces prets a l\'emploi, themes clair/sombre, avatars et covers.',
  },
  {
    icon: History,
    title: 'Tracer',
    description: 'Journal d\'audit complet avec historique de chaque modification. Restauration selective ou par lot vers un etat precedent.',
  },
  {
    icon: Globe,
    title: 'Ouvrir',
    description: 'Communautes publiques visitables sans inscription. Trois niveaux de visibilite (ouvert, lecture seule, prive) pour chaque espace et communaute.',
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

  const { allViews, categories } = useViewConfig();
  // Show all views on landing (not just public-access ones)
  const views = allViews.filter(v => v.visible).sort((a, b) => a.order - b.order);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 py-20 text-center">
        <img src="/logo.png" alt="SPOK" className="mx-auto mb-6 h-40 w-auto sm:h-56" />
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          SPOK
        </h1>
        <p className="mt-2 text-xl font-medium tracking-wide text-muted-foreground sm:text-2xl">
          Single Point Of Knowledge
        </p>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          L'outil collaboratif pour structurer vos projets, relier vos idées
          et les explorer sous {views.length} vues différentes.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <a href="#public-communities" className={`${btnDefault} h-10 rounded-md px-8`}>
            Découvrez sans connexion
          </a>
          <Link to="/login" className={`${btnOutline} h-10 rounded-md px-8`}>
            Se connecter
          </Link>
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
                      <div className="aspect-[3/1] bg-cover bg-center" style={{ backgroundImage: `url(${c.coverUrl})` }} />
                    ) : (
                      <div className="aspect-[3/1] bg-gradient-to-r from-primary/10 to-primary/5" />
                    )}
                    <div className="absolute -bottom-4 left-4">
                      {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt="" className="w-12 h-12 rounded-xl border-4 border-background object-cover shadow" />
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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-12">
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
            {categories.map((cat) => {
              const catViews = views.filter(v => v.category === cat.id);
              if (catViews.length === 0) return null;
              return (
                <div key={cat.id}>
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{cat.label}</h4>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {catViews.map((v: ViewConfigItem) => {
                      const Icon = VIEW_ICONS[v.icon] || List;
                      return (
                        <div
                          key={v.id}
                          className="flex items-start gap-3 rounded-lg border bg-card p-4"
                        >
                          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                          <div>
                            <p className="font-medium">{v.label}</p>
                            <p className="text-sm text-muted-foreground">{VIEW_DESCRIPTIONS[v.id] || ''}</p>
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

      <HelpBubble />
      <PublicFooter />
    </div>
  );
}
