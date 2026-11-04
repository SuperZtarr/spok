/* Aide utilisateur de la fenêtre « en direct » d'une séance (LiveWindow).
   Lue par son point d'interrogation (PageHelpButton) et son tour — registre help/pageHelp.ts.
   hints : infobulles du panneau Préparation (AgendaPanel), texte de la fenêtre d'ajout groupé (AddAgendaItemsDialog)
   et aide du champ « Date de la séance » (SessionDateField : Préparer la séance, Créer la suite). */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Séance en direct',
  summary: 'La fenêtre de la séance en cours : l\'élément présenté et la préparation, à laquelle chacun peut ajouter ; pour l\'animateur et les présentateurs, la recherche pour afficher.',
  tips: [
    'Déplacez la fenêtre par sa barre de titre, redimensionnez-la par le coin bas-droit',
    'Réduisez-la ou passez en plein écran',
    '« Aller à la séance » ouvre l\'espace de la séance',
    'Animateur et présentateurs : onglets Préparation et Rechercher pour afficher un élément',
    'Préparation → « Ajouter des éléments » : recherche dans l\'espace, la communauté ou tous vos espaces, ouverte à tous les participants',
    'Animateur et présentateurs peuvent aussi cocher d\'un coup des éléments de l\'espace parent',
  ],
  // Panneau Préparation (AgendaPanel, bandeau et fenêtre en direct) et fenêtre d'ajout groupé (AddAgendaItemsDialog)
  hints: {
    suiteIntro: 'Nouvelle séance préparée, liée à celle-ci (« Suite de … ») : elle reprend les présentateurs et les invités toujours autorisés, les éléments non présentés de la préparation, et recopie les éléments déjà présentés. Le fil et les commentaires ne sont pas repris.',
    sessionDate:'Date prévue de la séance : elle donne son nom (« Séance AAAA-MM-JJ », suivi de (2) si ce nom existe déjà). Vous pourrez renommer l\'espace de séance ensuite.',
    addAgendaItems: 'Ajouter des éléments : cherchez dans cet espace, la communauté ou tous vos espaces. Ils s\'ajoutent à la fin de la préparation, avec vous comme présentateur. Rien n\'est copié avant l\'affichage ; vous retirez vos lignes avec ×.',
    addAgendaSearch: 'Cherchez un élément, en choisissant où chercher. « Ajouter » le place aussitôt à la fin de la préparation (sans ses sous-éléments) et vous en êtes le présentateur. Rien n\'est copié avant son affichage en séance.',
    addAgendaIntro: 'Ou cochez parmi les éléments de premier niveau de l\'espace parent. Ceux qui ne sont pas encore dans la préparation sont cochés ; ceux qui y sont déjà sont décochés (les recocher les ajoute une seconde fois).',
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
