/* État vide d'une vue (aide utilisateur, phase 3) : remplace le « Aucun élément » sec par ce qui manque et comment
   remplir la vue. Le texte vient du champ `empty` de la fiche de la vue (components/views/help/<vue>.help.ts) —
   ne pas écrire de texte d'état vide en dur dans une vue, l'ajouter à sa fiche.
   Props : mode (ViewMode, clé de la fiche), title (titre court, ex. « Aucun bug »), icon (optionnelle),
   className (taille/fond du conteneur, par défaut centré plein cadre), children (action éventuelle, ex. bouton Nouveau),
   banner (bandeau d'une ligne au-dessus d'un cadre qui reste utile vide : colonnes de Kanban, Types, Assignés, Priorité ;
   n'affiche que le texte de la fiche, le titre ne sert que de repli).
   Rappel des filtres affiché d'office : une vue vide l'est souvent parce que la barre filtre tout. */
import type { ComponentType, ReactNode } from 'react';
import { Info } from 'lucide-react';
import type { ViewMode } from '../stores/viewMode';
import { VIEW_HELP } from '../components/views/help';

interface EmptyHelpProps {
  mode: ViewMode;
  title: string;
  icon?: ComponentType<{ className?: string }>;
  className?: string;
  children?: ReactNode;
  banner?: boolean;
}

export function EmptyHelp({ mode, title, icon: Icon, className, children, banner }: EmptyHelpProps) {
  const text = VIEW_HELP[mode]?.empty;
  if (banner) {
    return (
      <div className={className ?? 'mx-2 mt-2 flex items-start gap-2 rounded border border-border bg-muted/40 px-3 py-2 text-sm'}>
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground">
          {text ?? title} Des filtres actifs peuvent aussi tout masquer.
        </p>
      </div>
    );
  }
  return (
    <div className={className ?? 'flex-1 h-full flex items-center justify-center p-8'}>
      <div className="text-center max-w-md">
        {Icon && <Icon className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />}
        <p className="text-lg font-medium">{title}</p>
        {text && <p className="text-sm text-muted-foreground mt-1">{text}</p>}
        <p className="text-xs text-muted-foreground/70 mt-3">
          Des filtres actifs dans la barre de l'espace peuvent aussi tout masquer.
        </p>
        {children && <div className="mt-4 flex justify-center">{children}</div>}
      </div>
    </div>
  );
}
