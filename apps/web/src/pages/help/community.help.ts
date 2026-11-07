/* Aide utilisateur de la page « Communauté » (/communities/:id), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris
   par le « ? » (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts.
   Ses `fields` servent aussi aux modales d'espace partagées : CreateSpaceModal (newSpaceParent), MoveSpaceModal (moveSpace). */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  espaces: {
    title: 'Espaces',
    short: 'Cliquez sur un espace pour l\'ouvrir.',
    text: 'Les espaces de la communauté ; cliquez pour en ouvrir un. Dans la barre latérale, survolez un espace : « + » crée un sous-espace, « ⋯ » ouvre ses paramètres, le déplace, le monte ou le descend, ou le supprime.',
    target: '[data-tour="community-spaces"]',
    side: 'right',
  },
  nouveau: {
    title: 'Nouvel espace',
    short: 'Crée un espace dans cette communauté.',
    text: 'Crée un espace dans cette communauté, ou un sous-espace si vous choisissez un espace parent.',
    target: '[data-tour="community-new-space"]',
    noZone: true,
    side: 'bottom',
  },
  membres: {
    title: 'Membres',
    short: 'Les membres et leur rôle.',
    text: 'Les membres et leur rôle.',
    target: '[data-tour="community-members"]',
    side: 'left',
  },
  parametres: {
    title: 'Paramètres',
    short: 'Paramètres de la communauté (propriétaire).',
    text: 'La roue dentée ouvre les informations, le contexte, les référentiels, les membres… (propriétaire).',
    target: '[data-tour="community-settings-link"]',
    noZone: true,
    side: 'left',
  },
};

export const help: HelpEntry = {
  title: 'Communauté',
  summary: 'La page d\'une communauté : ses espaces et ses membres.',
  ...helpFromElements(elements),
  fields: {
    newSpaceParent: 'Laissez vide pour un espace de premier niveau ; sinon il sera rangé sous l\'espace choisi.',
    moveSpace: 'Ses sous-espaces le suivent. Un espace ne peut pas être rangé dans un de ses propres sous-espaces.',
  },
  tour: [
    {
      popover: {
        title: 'La communauté',
        description: 'Ses espaces à gauche, ses membres à droite.',
      },
    },
    ...elementTourSteps('community', elements),
  ],
};
