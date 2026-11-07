/* Aide utilisateur de la page « Historique » (/spaces/:id/history), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris
   par le « ? » (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  filtres: {
    title: 'Filtres',
    short: 'Par action, type d\'objet et période.',
    text: 'Par action (création, modification, suppression, déplacement, relations), type d\'objet et période.',
    target: '[data-tour="history-filters"]',
    side: 'bottom',
  },
  entree: {
    title: 'Une entrée',
    short: 'Cliquez pour le détail avant / après.',
    text: 'Qui a fait quoi et quand. Cliquez pour le détail avant / après.',
    target: '[data-tour="history-entry"]',
    side: 'bottom',
  },
  restaurer: {
    title: 'Restaurer',
    short: 'Rétablit l\'état d\'avant la modification.',
    text: 'Rétablit l\'état d\'avant cette modification (une confirmation est demandée).',
    target: '[data-tour="history-restore"]',
    noZone: true,
    side: 'left',
  },
};

export const help: HelpEntry = {
  title: 'Historique',
  summary: 'Toutes les modifications de l\'espace — qui, quoi, quand — et la restauration d\'un état précédent. Page réservée au mode admin.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Historique',
        description: 'Le journal des modifications de l\'espace.',
      },
    },
    ...elementTourSteps('space-history', elements),
  ],
};
