/* Aide utilisateur de la fenêtre « en direct » d'une séance (LiveWindow), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le
   « ? » (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts.
   hints : infobulles du panneau Préparation (AgendaPanel), texte de la fenêtre d'ajout groupé (AddAgendaItemsDialog)
   et aide du champ « Date de la séance » (SessionDateField : Préparer la séance, Créer la suite). */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  barre: {
    title: 'Barre de la fenêtre',
    short: 'Déplacez la fenêtre et pilotez son affichage.',
    text: 'Glissez-la pour déplacer la fenêtre ; le coin bas-droit la redimensionne. Ses boutons : aller à la séance (ouvre son espace), réduire, plein écran, quitter le direct.',
    target: '[data-tour="live-header"]',
    side: 'bottom',
  },
  onglets: {
    title: 'Onglets',
    short: 'Direct, Préparation et Rechercher.',
    text: 'Direct (ce qui est affiché), Préparation (la liste à présenter), Rechercher (afficher n\'importe quel élément). Réservé à l\'animateur et aux présentateurs, qui peuvent aussi cocher d\'un coup des éléments de l\'espace parent. « Ajouter des éléments » de la Préparation cherche dans l\'espace, la communauté ou tous vos espaces, et reste ouvert à tous les participants.',
    target: '[data-tour="live-tabs"]',
    side: 'bottom',
  },
  contenu: {
    title: 'L\'élément présenté',
    short: 'Cliquez pour ouvrir sa fiche.',
    text: 'Son titre, qui le présente, sa description et ses sous-éléments révélés. Cliquez pour ouvrir sa fiche.',
    target: '[data-tour="live-content"]',
    side: 'top',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Séance en direct',
  summary: 'La fenêtre de la séance en cours : l\'élément présenté et la préparation, à laquelle chacun peut ajouter ; pour l\'animateur et les présentateurs, la recherche pour afficher.',
  ...derived,
  // Panneau Préparation (AgendaPanel, bandeau et fenêtre en direct) et fenêtre d'ajout groupé (AddAgendaItemsDialog)
  hints: {
    ...derived.hints,
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
    ...elementTourSteps('live-window', elements),
  ],
};
