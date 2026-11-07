/* Aide utilisateur de la page « Communautés » (/communities), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris
   par le « ? » (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  grille: {
    title: 'Communautés',
    short: 'Vos communautés et celles à rejoindre.',
    text: 'Les groupes de personnes et d\'espaces auxquels vous appartenez ou pouvez participer.',
    target: '[data-tour="communities-grid"]',
    side: 'top',
  },
  carte: {
    title: 'Une communauté',
    short: 'Cliquez pour y entrer.',
    text: 'Cliquez pour y entrer. La pastille indique sa visibilité (ouverte, lecture seule, privée) ; les raccourcis mènent à ses paramètres si vous en êtes propriétaire.',
    target: '[data-tour="community-card"]',
    side: 'right',
  },
  creer: {
    title: 'Créer',
    short: 'Créez une communauté dont vous serez propriétaire.',
    text: 'Créez une communauté dont vous serez propriétaire : elle démarre privée, son passage en public est validé par un administrateur.',
    target: '[data-tour="communities-new"]',
    noZone: true,
    side: 'left',
  },
};

export const help: HelpEntry = {
  title: 'Communautés',
  summary: 'Vos communautés, les communautés publiques à rejoindre et vos invitations en attente.',
  ...helpFromElements(elements),
  fields: {
    description: 'Affichée sur la carte de la communauté : elle aide les autres à décider de la rejoindre.',
  },
  tour: elementTourSteps('communities', elements),
};
