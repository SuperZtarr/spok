/* Aide utilisateur de la vue « Arborescence » (tree), écrite en éléments d'aide (help/elements.ts) : un texte par fonction,
   repris par le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  contenu: {
    title: 'Arborescence',
    short: 'La hiérarchie de l\'espace.',
    text: 'La hiérarchie de l\'espace : projets, sous-projets, tâches et sous-tâches, chacun sous son parent.',
    side: 'top',
  },
  ligne: {
    title: 'Un élément',
    short: 'Cliquez pour ouvrir sa fiche.',
    text: 'Cliquez pour ouvrir sa fiche. Sa flèche et sa poignée servent à le déplier et à le déplacer.',
    side: 'bottom',
  },
  deplier: {
    title: 'Déplier / Replier',
    short: 'Montre ou masque les enfants.',
    text: 'Le chevron montre ou masque les enfants d\'un élément.',
    target: '[data-tour="tree-expand"]',
    noZone: true,
    side: 'right',
  },
  deplacer: {
    title: 'Déplacer dans l\'arbre',
    short: 'Glissez la poignée pour déplacer.',
    text: 'Glissez la poignée : déposé entre deux lignes, l\'élément change de place ; déposé sur un élément, il passe dessous.',
    target: '[data-tour="tree-drag"]',
    noZone: true,
    side: 'right',
  },
  tout: {
    title: 'Tout réduire / étendre',
    short: 'Replie ou déplie toutes les branches.',
    text: 'Replie ou déplie toutes les branches d\'un coup.',
    target: '[data-tour="collapse-toggle"]',
    noZone: true,
    side: 'bottom',
  },
};

export const help: HelpEntry = {
  title: 'Arborescence',
  summary: 'Les éléments en arbre : chaque élément sous son parent, avec indentation.',
  short: 'Hiérarchie parent-enfant',
  empty: 'L\'espace ne contient encore aucun élément. Créez-en un avec « Nouveau », puis ajoutez-lui des enfants depuis son menu pour construire l\'arbre.',
  ...helpFromElements(elements),
  tour: [
    ...elementTourSteps('tree', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};
