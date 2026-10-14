/*
 * PageHelpButton — point d'interrogation d'une page ou d'une modale, branché sur sa fiche PAGE_HELP[pageKey]
 * (help/pageHelp.ts) : encart d'aide (HelpButton variante « page »), clignotement à la première visite et tour
 * guidé (usePageTourPulse, « déjà vu » mémorisé sous spok-page-tour-done-<pageKey>).
 * Usage : une ligne dans l'en-tête de la page, à droite du titre — `<PageHelpButton pageKey="search" />`.
 * Ne pas recréer de bouton d'aide maison dans une page : ajouter sa fiche au registre et utiliser ce composant.
 */
import { HelpButton } from './HelpButton';
import { PAGE_HELP, type PageHelpKey } from './pageHelp';
import { usePageTourPulse } from '../hooks/useOnboarding';

export function PageHelpButton({ pageKey }: { pageKey: PageHelpKey }) {
  const help = PAGE_HELP[pageKey];
  const { pulseHelp, startTour } = usePageTourPulse(pageKey, help.tour);
  return <HelpButton help={help} onStartTour={startTour} pulse={pulseHelp} variant="page" buttonTitle="Aide" />;
}
