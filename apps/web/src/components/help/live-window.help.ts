/* Aide utilisateur de la fenêtre « en direct » d'une séance (LiveWindow).
   Lue par son point d'interrogation (PageHelpButton) et son tour — registre help/pageHelp.ts.
   hints : infobulles du panneau Préparation (AgendaPanel) et texte de la fenêtre d'ajout groupé (AddAgendaItemsDialog). */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Séance en direct',
  summary: 'La fenêtre de la séance en cours : l\'élément présenté, et pour l\'animateur et les présentateurs, la préparation et la recherche.',
  tips: [
    'Déplacez la fenêtre par sa barre de titre, redimensionnez-la par le coin bas-droit',
    'Réduisez-la ou passez en plein écran',
    '« Aller à la séance » ouvre l\'espace de la séance',
    'Animateur et présentateurs : onglets Préparation et Rechercher pour afficher un élément',
    'Préparation → « Ajouter des éléments » : ajoute d\'un coup les éléments de l\'espace parent choisis (les nouveaux sont cochés)',
  ],
  // Panneau Préparation (AgendaPanel, bandeau et fenêtre en direct) et fenêtre d'ajout groupé (AddAgendaItemsDialog)
  hints: {
    addAgendaItems: 'Ajouter des éléments : choisissez des éléments de l\'espace parent, ajoutés à la fin de la préparation, dans l\'ordre de la liste, avec vous comme présentateur. Rien n\'est copié avant l\'affichage ; chaque ligne se retire ensuite avec ×.',
    addAgendaIntro: 'Éléments de premier niveau de l\'espace parent. Ceux qui ne sont pas encore dans la préparation sont cochés ; ceux qui y sont déjà sont décochés (les recocher les ajoute une seconde fois). Les éléments cochés sont ajoutés à la fin de la préparation, vous en êtes le présentateur.',
  },
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
