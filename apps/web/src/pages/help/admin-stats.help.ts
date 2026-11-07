/* Aide utilisateur de la page d'administration « Statistiques » (/admin/stats, StatsPage), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le
   « ? » (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  periode: {
    title: 'Période',
    short: 'La période des tendances et des courbes.',
    text: 'La période couverte par les tendances et les courbes.',
    target: '[data-tour="admin-stats-period"]',
    side: 'left',
  },
  indicateurs: {
    title: 'Indicateurs',
    short: 'Compteurs, tendances et courbes d\'activité.',
    text: 'Les compteurs donnent les totaux ; les tendances et les courbes, l\'activité sur la période choisie.',
    target: '[data-tour="admin-stats-content"]',
    side: 'top',
  },
};

export const help: HelpEntry = {
  title: 'Statistiques',
  summary: 'L\'activité de l\'instance : utilisateurs, espaces, communautés et éléments, avec leur évolution.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Statistiques',
        description: 'Comment SPOK est utilisé.',
      },
    },
    ...elementTourSteps('admin-stats', elements),
  ],
};
