import { useState } from 'react';
import { Users, FolderKanban, LayoutGrid, GitBranch, BarChart3, Search, Bell, ArrowRight } from 'lucide-react';

const FEATURES = [
  {
    icon: Users,
    title: 'Communautés',
    description: 'Regroupez des personnes autour de sujets communs. Chaque communauté a ses propres espaces et membres.',
    color: 'text-red-500 bg-red-50 dark:bg-red-950/30',
  },
  {
    icon: FolderKanban,
    title: 'Espaces',
    description: 'Organisez votre travail en espaces : projets, équipes, thématiques. Chaque espace contient des items structurés.',
    color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30',
  },
  {
    icon: LayoutGrid,
    title: 'Items',
    description: 'Notes, tâches, projets, réunions, documents, diagrammes... Créez, liez et hiérarchisez tous vos contenus.',
    color: 'text-green-500 bg-green-50 dark:bg-green-950/30',
  },
  {
    icon: GitBranch,
    title: 'Relations',
    description: 'Reliez vos items entre eux : dépendances, blocages, liens. Visualisez les connexions dans les vues graphe et relations.',
    color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30',
  },
  {
    icon: BarChart3,
    title: '25+ vues',
    description: 'Liste, Kanban, MindMap, Timeline, Calendrier, Graphe, Schéma, Burndown, Heatmap... Changez de perspective en un clic.',
    color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30',
  },
  {
    icon: Search,
    title: 'Recherche & filtres',
    description: 'Recherche globale cross-espaces. Filtrez par type, statut, priorité. Mode lumière pour mettre en évidence.',
    color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/30',
  },
  {
    icon: Bell,
    title: 'Notifications & emails',
    description: 'Mentions @utilisateur, notifications in-app, emails communauté. Restez informé de l\'activité de vos espaces.',
    color: 'text-orange-500 bg-orange-50 dark:bg-orange-950/30',
  },
];

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour: () => void;
}

const STORAGE_KEY = 'spok-hide-welcome';

export function WelcomeModal({ isOpen, onClose, onStartTour }: WelcomeModalProps) {
  const [hideNextTime, setHideNextTime] = useState(localStorage.getItem(STORAGE_KEY) === 'true');

  if (!isOpen) return null;

  const handleClose = () => {
    if (hideNextTime) {
      localStorage.setItem(STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div
        className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-4 text-center">
          <img src="/logo.png" alt="SPOK" className="h-12 mx-auto mb-3" />
          <h2 className="text-xl font-bold">Bienvenue sur SPOK !</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Single Point Of Knowledge — Structurez, reliez, évaluez et planifiez.
          </p>
        </div>

        {/* Features grid */}
        <div className="px-8 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="flex gap-3 p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${feature.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{feature.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="px-8 pb-8 pt-2 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!hideNextTime}
              onChange={(e) => setHideNextTime(!e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-xs text-muted-foreground">Afficher cette page au prochain demarrage</span>
          </label>
          <div className="flex items-center justify-between">
            <button
              onClick={handleClose}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Commencer directement
            </button>
            <button
              onClick={() => { handleClose(); setTimeout(onStartTour, 300); }}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Faire le tour
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
