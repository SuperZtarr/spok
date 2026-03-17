import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FolderTree,
  Users,
  Eye,
  CalendarRange,
  GitBranch,
  Palette,
  History,
  Globe,
  List,
  Columns3,
  GanttChart,
  Network,
  Share2,
  CircleDot,
  Waypoints,
  PenTool,
  Circle,
  FileText,
  ArrowDownUp,
  LayoutGrid,
  CalendarCheck,
  Calendar,
} from 'lucide-react';
import { communitiesApi } from '../lib/api';

const features = [
  {
    icon: FolderTree,
    title: 'Structurer',
    description: '10 types d\'items (projets, tâches, notes, réunions, périodes, liens, documents…) organisés dans des espaces hiérarchiques.',
  },
  {
    icon: Users,
    title: 'Collaborer',
    description: 'Communautés, contributions sur chaque item, notifications en temps réel, assignation et rôles granulaires.',
  },
  {
    icon: Eye,
    title: 'Visualiser',
    description: '15 vues pour explorer vos données sous tous les angles : liste, kanban, gantt, graphe, carte mentale, bulles…',
  },
  {
    icon: CalendarRange,
    title: 'Planifier',
    description: 'Timeline Gantt, calendrier, planning, séquences. Statuts personnalisables et suivi de la progression.',
  },
  {
    icon: GitBranch,
    title: 'Lier',
    description: 'Relations typées entre items pour construire un graphe de connaissances. Carte des relations et schéma interactif.',
  },
  {
    icon: Palette,
    title: 'Personnaliser',
    description: 'Référentiels de statuts et de types par espace, tags colorés, templates d\'espaces prédéfinis.',
  },
  {
    icon: History,
    title: 'Tracer',
    description: 'Historique complet des modifications avec audit détaillé. Restauration en un clic vers un état précédent.',
  },
  {
    icon: Globe,
    title: 'Ouvrir',
    description: 'Communautés publiques accessibles sans inscription. Accès en lecture seule pour les visiteurs anonymes.',
  },
];

const viewCategories = [
  {
    title: 'Basique',
    views: [
      { icon: List, name: 'Liste', description: 'Vue tabulaire avec tri, filtres et recherche' },
      { icon: GitBranch, name: 'Arborescence', description: 'Hiérarchie parent-enfant avec drag & drop' },
      { icon: Columns3, name: 'Kanban', description: 'Colonnes par statut, glisser-déposer' },
      { icon: FileText, name: 'Texte', description: 'Affichage éditorial des contenus' },
    ],
  },
  {
    title: 'Planification',
    views: [
      { icon: CalendarCheck, name: 'Planning', description: 'Vue par périodes et jalons' },
      { icon: GanttChart, name: 'Gantt', description: 'Diagramme de Gantt avec dépendances' },
      { icon: Calendar, name: 'Calendrier', description: 'Vue mensuelle des échéances' },
      { icon: ArrowDownUp, name: 'Séquence', description: 'Ordre séquentiel avec relations' },
      { icon: LayoutGrid, name: 'Types', description: 'Grille groupée par type d\'item' },
    ],
  },
  {
    title: 'Exploration',
    views: [
      { icon: Share2, name: 'Carte mentale', description: 'Mind map avec zones projet' },
      { icon: Network, name: 'Graphe', description: 'Réseau force-directed interactif' },
      { icon: CircleDot, name: 'Sunburst', description: 'Diagramme solaire hiérarchique' },
      { icon: Waypoints, name: 'Relations', description: 'Carte des relations entre items' },
      { icon: PenTool, name: 'Schéma', description: 'Schéma libre avec groupes et liens' },
      { icon: Circle, name: 'Bulles', description: 'Cercles imbriqués proportionnels' },
    ],
  },
];

const btnBase = 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
const btnDefault = `${btnBase} bg-primary text-primary-foreground shadow hover:bg-primary/90`;
const btnOutline = `${btnBase} border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground`;
const btnGhost = `${btnBase} hover:bg-accent hover:text-accent-foreground`;

export function LandingPage() {
  const { data: publicCommunities } = useQuery({
    queryKey: ['communities', 'public'],
    queryFn: () => communitiesApi.listPublic(),
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="text-xl font-bold tracking-tight">
            SPOK
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login" className={`${btnGhost} h-8 rounded-md px-3 text-xs`}>
              Connexion
            </Link>
            <Link to="/register" className={`${btnDefault} h-8 rounded-md px-3 text-xs`}>
              S'inscrire
            </Link>
          </div>
        </div>
      </header>

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
          et les explorer sous 15 vues différentes.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/register" className={`${btnDefault} h-10 rounded-md px-8`}>
            Commencer gratuitement
          </Link>
          <Link to="/login" className={`${btnOutline} h-10 rounded-md px-8`}>
            Se connecter
          </Link>
        </div>
      </section>

      {/* Public communities */}
      {publicCommunities && publicCommunities.length > 0 && (
        <section className="border-t py-16">
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
                  className="flex items-start gap-3 rounded-lg border bg-card p-5 shadow-sm hover:border-primary/50 hover:shadow-md transition-all"
                >
                  {c.avatarUrl ? (
                    <img src={c.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Globe className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{c.name}</p>
                    {c.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{c.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{c.memberCount} membre{c.memberCount !== 1 ? 's' : ''}</span>
                      <span>{c.spaceCount} espace{c.spaceCount !== 1 ? 's' : ''}</span>
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

          {/* Views by category */}
          <div className="space-y-8">
            {viewCategories.map((cat) => (
              <div key={cat.title}>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{cat.title}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {cat.views.map((v) => (
                    <div
                      key={v.name}
                      className="flex items-start gap-3 rounded-lg border bg-card p-4"
                    >
                      <v.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div>
                        <p className="font-medium">{v.name}</p>
                        <p className="text-sm text-muted-foreground">{v.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-5xl px-4 text-center text-sm text-muted-foreground">
          <p>
            SPOK &mdash;{' '}
            <Link to="/login" className="underline hover:text-foreground">
              Connexion
            </Link>
            {' '}&middot;{' '}
            <Link to="/register" className="underline hover:text-foreground">
              Inscription
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
