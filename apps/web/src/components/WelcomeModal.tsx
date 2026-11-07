/* Modale de bienvenue : propose le tutoriel d'accueil une seule fois au nouvel arrivant (useOnboarding), sans case « afficher au
   prochain démarrage ». Le fermer sans suivre le tutoriel revient à le passer ; il reste relançable par « Guide de démarrage ».
   Textes : éléments d'aide partagés avec le tutoriel (help/onboarding.elements.ts) ; ici, seulement l'icône et la couleur de chaque notion.
   Props : isOpen, onClose (proposition traitée), onStartTour (lance le tutoriel après fermeture). */
import { useRef } from 'react';
import { ONBOARDING_ELEMENTS, ONBOARDING_FEATURES } from '../help/onboarding.elements';
import { useDialogFocus } from '../hooks/useDialogFocus';
import logoUrl from '../assets/logo.png';
import { Users, FolderKanban, LayoutGrid, GitBranch, BarChart3, Search, Bell, ArrowRight } from 'lucide-react';
import { DevModalBadge } from './ui/DevModalBadge';

const FEATURE_STYLES: Record<(typeof ONBOARDING_FEATURES)[number], { icon: typeof Users; color: string } | undefined> = {
  communautes: { icon: Users, color: 'text-red-500 bg-red-50 dark:bg-red-950/30' },
  espaces: { icon: FolderKanban, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30' },
  elements: { icon: LayoutGrid, color: 'text-green-500 bg-green-50 dark:bg-green-950/30' },
  relations: { icon: GitBranch, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30' },
  vues: { icon: BarChart3, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30' },
  recherche: { icon: Search, color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/30' },
  notifications: { icon: Bell, color: 'text-orange-500 bg-orange-50 dark:bg-orange-950/30' },
  bienvenue: undefined,
  favoris: undefined,
  aide: undefined,
};

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour: () => void;
}

export function WelcomeModal({ isOpen, onClose, onStartTour }: WelcomeModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, isOpen);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div ref={dialogRef}
        className="outline-none bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-4 text-center">
          <img src={logoUrl} alt="SPOK" className="h-12 mx-auto mb-3" />
          <h2 className="text-xl font-bold flex items-center justify-center gap-2">Bienvenue sur SPOK ! <DevModalBadge name="WelcomeModal" /></h2>
          <p className="text-sm text-muted-foreground mt-1">
            Single Point Of Knowledge — Structurez, reliez, évaluez et planifiez.
          </p>
        </div>

        {/* Features grid */}
        <div className="px-8 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ONBOARDING_FEATURES.map((key) => {
              const element = ONBOARDING_ELEMENTS[key];
              const style = FEATURE_STYLES[key];
              if (!style) return null;
              const Icon = style.icon;
              return (
                <div key={key} className="flex gap-3 p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${style.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{element.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{element.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="px-8 pb-8 pt-2">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Commencer directement
            </button>
            <button
              onClick={() => { onClose(); setTimeout(onStartTour, 300); }}
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
