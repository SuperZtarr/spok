/*
 * Éléments d'aide du tutoriel d'accueil (« Guide de démarrage ») : un texte par notion, partagé par la fenêtre de bienvenue
 * (WelcomeModal) et par les étapes du tutoriel (useOnboarding), pour que les deux disent la même chose.
 * Sans `target`, l'étape s'affiche centrée : c'est le cas de ce qui se fait dans un espace (créer, relier, changer de vue),
 * car le tutoriel démarre depuis n'importe quelle page. Une cible absente de l'écran est sautée (runTour).
 * ONBOARDING_FEATURES : notions présentées dans la fenêtre de bienvenue, dans leur ordre.
 * Repères contrôlés par help/coverage.test.ts : une cible renommée fait échouer le test, au lieu de sauter une étape sans le dire.
 */
import type { HelpElement, TourStep } from './types';

type OnboardingElement = Omit<HelpElement, 'target'> & { target?: string };

export const ONBOARDING_ELEMENTS = {
  bienvenue: {
    title: 'Bienvenue sur SPOK !',
    short: 'Structurer, relier, évaluer et planifier.',
    text: 'SPOK est votre outil pour structurer, relier, évaluer et planifier. Ce guide rapide vous montre les bases.',
    target: '#sidebar-logo',
    side: 'right',
  },
  communautes: {
    title: 'Communautés',
    short: 'Des personnes autour d\'un sujet commun.',
    text: 'Regroupez des personnes autour de sujets communs. Chaque communauté a ses propres espaces et membres.',
    target: '#sidebar-communities',
    side: 'right',
  },
  espaces: {
    title: 'Espaces',
    short: 'Vos projets, équipes et thématiques.',
    text: 'Organisez votre travail en espaces : projets, équipes, thématiques. Chaque espace contient vos éléments ; cliquez sur un espace pour l\'ouvrir.',
    target: '#sidebar-first-space',
    side: 'right',
  },
  favoris: {
    title: 'Favoris et récents',
    short: 'Vos accès rapides.',
    text: 'Vos espaces favoris (étoile) et récemment visités apparaissent ici pour un accès rapide. Cliquez l\'étoile sur n\'importe quel espace pour l\'ajouter aux favoris.',
    target: '#sidebar-favorites',
    side: 'right',
  },
  elements: {
    title: 'Éléments',
    short: 'Notes, tâches, projets, réunions…',
    text: 'Notes, tâches, projets, réunions, documents, diagrammes… Dans un espace, le bouton « Nouveau » crée un élément ; sa fiche s\'ouvre pour le compléter. Ajoutez-lui des enfants depuis son menu pour construire une hiérarchie.',
  },
  relations: {
    title: 'Relations',
    short: 'Dépendances, blocages et liens.',
    text: 'Reliez vos éléments entre eux depuis leur fiche : dépendances, blocages, liens. Visualisez les connexions dans les vues Graphe et Relations.',
  },
  vues: {
    title: 'Plus de 25 vues',
    short: 'Le même contenu, autrement.',
    text: 'Liste, Kanban, Carte mentale, Gantt, Calendrier, Graphe, Burndown, Heatmap… Le contenu reste le même : changez de perspective en un clic dans la barre de l\'espace. Chaque vue a son « ? » et son tutoriel.',
  },
  recherche: {
    title: 'Recherche et filtres',
    short: 'Tous vos espaces d\'un coup.',
    text: 'Recherchez un élément, un espace ou un membre dans tous vos espaces d\'un coup. Dans un espace, filtrez par type, statut ou texte.',
    target: '[data-tour="nav-search"]',
    side: 'bottom',
  },
  notifications: {
    title: 'Notifications et emails',
    short: 'Restez informé de l\'activité.',
    text: 'Mentions @utilisateur, notifications dans l\'application, emails de communauté : restez informé de l\'activité de vos espaces.',
  },
  aide: {
    title: 'Besoin d\'aide ?',
    short: 'Relancez ce guide à tout moment.',
    text: 'Relancez ce guide à tout moment avec ce bouton. Sur chaque écran, le « ? » explique ce qu\'on y trouve, et les nouveautés de SPOK s\'annoncent sur l\'accueil.',
    target: '#sidebar-help-button-top',
    side: 'right',
  },
} satisfies Record<string, OnboardingElement>;

/** Notions de la fenêtre de bienvenue, dans leur ordre d'affichage. */
export const ONBOARDING_FEATURES: (keyof typeof ONBOARDING_ELEMENTS)[] = ['communautes', 'espaces', 'elements', 'relations', 'vues', 'recherche', 'notifications'];

export const ONBOARDING_STEPS: TourStep[] = Object.values(ONBOARDING_ELEMENTS as Record<string, OnboardingElement>).map((element) => ({
  element: element.target,
  popover: { title: element.title, description: element.text, side: element.side },
}));
