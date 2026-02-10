import { Link } from 'react-router-dom';
import {
  FolderTree,
  Users,
  LayoutGrid,
  CalendarRange,
  GitBranch,
  Star,
  List,
  Columns3,
  GanttChart,
  Network,
  Brain,
  ListOrdered,
} from 'lucide-react';

const features = [
  {
    icon: FolderTree,
    title: 'Structurer',
    description: 'Organisez vos items, projets, tâches et notes dans des espaces dédiés avec une hiérarchie flexible.',
  },
  {
    icon: Users,
    title: 'Collaborer',
    description: 'Partagez des espaces, contribuez ensemble et fédérez vos communautés autour de projets communs.',
  },
  {
    icon: LayoutGrid,
    title: 'Visualiser',
    description: 'Explorez vos données sous 6 vues différentes : liste, kanban, timeline, graphe, mind map et séquence.',
  },
  {
    icon: CalendarRange,
    title: 'Planifier',
    description: "Suivez l'avancement avec des statuts, des périodes et une vision claire de la progression.",
  },
  {
    icon: GitBranch,
    title: 'Lier',
    description: 'Créez des relations entre items pour construire un véritable graphe de connaissances.',
  },
  {
    icon: Star,
    title: 'Évaluer',
    description: 'Définissez des référentiels personnalisables et catégorisez avec des tags sur mesure.',
  },
];

const views = [
  { icon: List, name: 'Liste', description: 'Vue tabulaire avec tri et filtres' },
  { icon: Columns3, name: 'Kanban', description: 'Colonnes par statut, glisser-déposer' },
  { icon: GanttChart, name: 'Timeline', description: 'Diagramme de Gantt avec dépendances' },
  { icon: Network, name: 'Graphe', description: 'Réseau force-directed interactif' },
  { icon: Brain, name: 'Mind Map', description: 'Carte mentale avec zones projet' },
  { icon: ListOrdered, name: 'Séquence', description: 'Ordre séquentiel avec relations' },
];

const btnBase = 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
const btnDefault = `${btnBase} bg-primary text-primary-foreground shadow hover:bg-primary/90`;
const btnOutline = `${btnBase} border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground`;
const btnGhost = `${btnBase} hover:bg-accent hover:text-accent-foreground`;

export function LandingPage() {
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
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Structurez, liez, planifiez
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          SPOK est l'outil collaboratif pour organiser vos projets, relier vos idées
          et visualiser l'ensemble sous plusieurs angles.
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

      {/* Features */}
      <section className="border-t bg-muted/50 py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="mb-10 text-center text-2xl font-bold">
            Tout ce qu'il faut pour avancer
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-lg border bg-card p-6 shadow-sm"
              >
                <f.icon className="mb-3 h-8 w-8 text-primary" />
                <h3 className="mb-1 text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Views */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="mb-10 text-center text-2xl font-bold">
            6 vues pour explorer vos données
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {views.map((v) => (
              <div
                key={v.name}
                className="flex items-start gap-3 rounded-lg border p-4"
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
