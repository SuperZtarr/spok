/* Bouton d'aide d'une vue : relais vers HelpButton (help/HelpButton.tsx) avec la fiche VIEW_HELP de la vue
   (components/views/help/<vue>.help.ts). Garde l'API historique (viewMode, onStartTour, pulse) des 21 vues. */
import { HelpButton } from '../help/HelpButton';
import { VIEW_HELP } from './views/help';
import type { ViewMode } from '../stores/viewMode';

interface ViewHelpButtonProps {
  viewMode: ViewMode;
  onStartTour?: () => void;
  pulse?: boolean;
}

export function ViewHelpButton({ viewMode, onStartTour, pulse }: ViewHelpButtonProps) {
  return <HelpButton help={VIEW_HELP[viewMode]} onStartTour={onStartTour} pulse={pulse} />;
}
