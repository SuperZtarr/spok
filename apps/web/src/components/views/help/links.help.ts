/* Aide utilisateur de la vue « Liens » (links), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris
   par le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide.
   Contenus multiples (lot 3a, 2026-11-08) : une étiquette par lien porté, quel que soit le type de l'élément ;
   annonce contents-view-links (sans date, datée à la MEP). */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  groupe: {
    title: 'Groupe',
    short: 'Les liens des éléments rangés sous un même parent.',
    text: 'Les liens des éléments rangés sous un même élément parent ; cliquez sur l\'en-tête pour ouvrir ce parent.',
    side: 'bottom',
  },
  tag: {
    title: 'Un lien',
    short: 'Cliquez pour ouvrir le site.',
    text: 'Une étiquette par lien porté par un élément, quel que soit son type : un élément qui porte deux liens apparaît deux fois, avec le nom de chaque lien après son titre. Un clic ouvre le site dans un nouvel onglet ; un double-clic ouvre la fiche de l\'élément. Glisser une étiquette range tout l\'élément sous un autre parent, avec ses autres liens. L\'icône du site est récupérée automatiquement ; survolez l\'étiquette pour voir son adresse.',
    target: '[data-tour="links-tag"]',
    side: 'bottom',
    changes: [{ id: 'contents-view-links', kind: 'evolution', text: 'La vue Liens montre les liens de tous les éléments, quel que soit leur type, une étiquette par lien.', date: '2026-11-11' }],
  },
};

export const help: HelpEntry = {
  title: 'Liens',
  summary: 'Tous les liens portés par les éléments de l\'espace, une étiquette par lien, avec l\'icône du site, regroupés par élément parent.',
  short: 'Liens avec favicon',
  empty: 'Aucun lien. Ajoutez un lien à n\'importe quel élément (zone Contenus de sa fiche) pour le retrouver ici.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Vue Liens',
        description: 'Tous les liens web de l\'espace en un coup d\'œil, regroupés sous leur élément parent.',
      },
    },
    ...elementTourSteps('links', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};
