/* Aide utilisateur de la page « Espaces » (/spaces), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? »
   (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts.
   hints unavailable* : textes de l'écran « espace inaccessible » (SpaceUnavailable, page d'un espace). */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  groupe: {
    title: 'Espaces de groupe',
    short: 'Les espaces partagés avec d\'autres.',
    text: 'Les espaces partagés avec d\'autres, dans vos communautés.',
    target: '[data-tour="spaces-group"]',
    side: 'top',
  },
  carte: {
    title: 'Une carte',
    short: 'Cliquez pour ouvrir l\'espace.',
    text: 'Cliquez pour ouvrir l\'espace. La pastille indique sa visibilité (héritée ou propre).',
    target: '[data-tour="space-card"]',
    side: 'right',
  },
  raccourcis: {
    title: 'Raccourcis',
    short: 'Ouvrir directement la vue par défaut.',
    text: 'L\'icône de vue ouvre directement la vue par défaut de l\'espace ; la roue dentée mène aux paramètres (propriétaire).',
    target: '[data-tour="space-card-open-view"]',
    noZone: true,
    side: 'left',
  },
  personnels: {
    title: 'Espaces personnels',
    short: 'Vos espaces privés, hors communauté.',
    text: 'Vos espaces privés, hors communauté.',
    target: '[data-tour="spaces-personal"]',
    side: 'top',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Espaces',
  summary: 'Tous les espaces auxquels vous avez accès : espaces de groupe et espaces personnels.',
  ...derived,
  // Écran « espace inaccessible » de la page d'un espace (components/SpaceUnavailable.tsx)
  hints: {
    ...derived.hints,
    unavailableAnonymous: 'Cet espace n\'est pas public. Connectez-vous pour y accéder : après connexion, « Retourner à » vous ramène ici.',
    unavailable: 'Espace introuvable ou accès refusé : il a peut-être été supprimé, ou vous n\'en êtes pas membre.',
  },
  tour: [
    {
      popover: {
        title: 'Espaces',
        description: 'Tous vos espaces, en cartes.',
      },
    },
    ...elementTourSteps('spaces', elements),
  ],
};
