/* Aide utilisateur de la page « Communautés » (/communities).
   Lue par le point d'interrogation de la page (PageHelpButton) et son tour — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Communautés',
  summary: 'Vos communautés, les communautés publiques à rejoindre et vos invitations en attente.',
  tips: [
    'Cliquez sur une carte pour entrer dans la communauté',
    'La pastille indique la visibilité (ouverte, lecture seule, privée)',
    '« Nouvelle communauté » en crée une dont vous serez propriétaire',
  ],
  tour: [
    {
      element: '[data-tour="communities-grid"]',
      popover: {
        title: 'Communautés',
        description: 'Les groupes de personnes et d\'espaces auxquels vous appartenez ou pouvez participer.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="community-card"]',
      popover: {
        title: 'Une communauté',
        description: 'Cliquez pour y entrer. La pastille indique sa visibilité ; les raccourcis mènent à ses paramètres si vous en êtes propriétaire.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="communities-new"]',
      popover: {
        title: 'Créer',
        description: 'Créez une communauté : elle démarre privée, son passage en public est validé par un administrateur.',
        side: 'left',
      },
    },
  ],
  fields: {
    description: 'Affichée sur la carte de la communauté : elle aide les autres à décider de la rejoindre.',
  },
};
