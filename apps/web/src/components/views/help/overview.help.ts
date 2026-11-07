/* Aide utilisateur de la vue « Présentation » (overview), écrite en éléments d'aide (help/elements.ts) : un texte par fonction,
   repris par le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide.
   Cette vue n'a ni barre de vue ni barre d'espace : pas de SPACE_TOOLBAR_STEPS, le tour pointe ses sections. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';

const elements: HelpElements = {
  parametres: {
    title: 'Paramètres',
    short: 'Paramètres de l\'espace.',
    text: 'Nom, couverture, visibilité, membres, vue par défaut… Réservé aux propriétaires de l\'espace.',
    target: '[data-tour="overview-settings"]',
    noZone: true,
    side: 'left',
  },
  stats: {
    title: 'En chiffres',
    short: 'Le contenu de l\'espace en chiffres.',
    text: 'Nombre d\'éléments, de membres et de sous-espaces.',
    target: '[data-tour="overview-stats"]',
    side: 'bottom',
  },
  vues: {
    title: 'Vues disponibles',
    short: 'Chaque carte ouvre une vue.',
    text: 'Chaque carte ouvre une vue de l\'espace, avec son accroche : liste, kanban, carte mentale…',
    target: '[data-tour="overview-view-card"]',
    side: 'bottom',
  },
  sousespaces: {
    title: 'Sous-espaces',
    short: 'Les espaces rangés sous celui-ci.',
    text: 'Les espaces rangés sous celui-ci, avec leur couverture : cliquez sur une carte pour y entrer ; « Nouveau sous-espace » en crée un.',
    target: '[data-tour="overview-subspaces"]',
    side: 'top',
  },
  membres: {
    title: 'Membres',
    short: 'Les personnes qui ont accès à l\'espace.',
    text: 'Les personnes qui ont accès à l\'espace, avec leur rôle.',
    target: '[data-tour="overview-members"]',
    side: 'top',
  },
};

export const help: HelpEntry = {
  title: 'Présentation',
  summary: 'Vue d\'ensemble de l\'espace : couverture, chiffres, vues disponibles, sous-espaces et membres.',
  short: 'Carte d\'identité de l\'espace',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Présentation de l\'espace',
        description: 'La carte d\'identité de l\'espace : sa couverture, quelques chiffres, ses vues, ses sous-espaces et ses membres.',
      },
    },
    ...elementTourSteps('overview', elements),
  ],
};
