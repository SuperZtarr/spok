/* Aide utilisateur de la vue « Présentation » (overview) : à quoi elle sert, comment s'en servir, tour guidé.
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';

export const help: HelpEntry = {
  title: 'Présentation',
  summary: 'Vue d\'ensemble de l\'espace : couverture, statistiques, vues disponibles, sous-espaces et membres.',
  tips: [
    'Cliquez sur une vue pour y accéder directement',
    'Les sous-espaces sont affichés avec leur couverture',
    'Les chiffres résument le contenu de l\'espace',
  ],
  tour: [
    {
      popover: {
        title: 'Présentation de l\'espace',
        description: 'La carte d\'identité de l\'espace : sa couverture, quelques chiffres, ses vues, ses sous-espaces et ses membres.',
      },
    },
    {
      popover: {
        title: 'Accès rapides',
        description: 'Cliquez sur une vue pour l\'ouvrir, ou sur un sous-espace pour y entrer.',
      },
    },
  ],
};
