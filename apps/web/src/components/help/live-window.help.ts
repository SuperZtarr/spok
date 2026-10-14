/* Aide utilisateur de la fenêtre « en direct » d'une séance (LiveWindow).
   Lue par son point d'interrogation (PageHelpButton) et son tour — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Séance en direct',
  summary: 'La fenêtre de la séance en cours : l\'élément présenté, et pour l\'animateur et les présentateurs, la préparation et la recherche.',
  tips: [
    'Déplacez la fenêtre par sa barre de titre, redimensionnez-la par le coin bas-droit',
    'Réduisez-la ou passez en plein écran',
    '« Aller à la séance » ouvre l\'espace de la séance',
    'Animateur et présentateurs : onglets Préparation et Rechercher pour afficher un élément',
  ],
  tour: [
    {
      popover: {
        title: 'Séance en direct',
        description: 'Ce qui est présenté en ce moment, sur toutes les pages tant que la séance est en direct.',
      },
    },
    {
      element: '[data-tour="live-header"]',
      popover: {
        title: 'Barre de la fenêtre',
        description: 'Glissez-la pour déplacer la fenêtre. Ses boutons : aller à la séance, réduire, plein écran, quitter le direct.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="live-tabs"]',
      popover: {
        title: 'Onglets',
        description: 'Direct (ce qui est affiché), Préparation (la liste à présenter), Rechercher (afficher n\'importe quel élément). Réservé à l\'animateur et aux présentateurs.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="live-content"]',
      popover: {
        title: 'L\'élément présenté',
        description: 'Son titre, qui le présente, sa description et ses sous-éléments révélés. Cliquez pour ouvrir sa fiche.',
        side: 'top',
      },
    },
  ],
};
