/* Aide utilisateur de la vue « Liste » (list), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris
   par le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. `elements` est exporté : À faire, qui
   affiche ListView, reprend les mêmes en-têtes (Bugs retirée le 2026-11-11). */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const elements = {
  entetes: {
    title: 'Colonnes triables',
    short: 'Cliquez sur un en-tête pour trier.',
    text: 'Les informations clés de chaque élément. Cliquez sur un en-tête pour trier ; un second clic inverse l\'ordre.',
    target: '[data-tour="list-headers"]',
    side: 'bottom',
  },
  ligne: {
    title: 'Un élément',
    short: 'Cliquez pour ouvrir sa fiche, glissez pour le déplacer.',
    text: 'Sa miniature (première image ou premier schéma, sinon l\'icône du type), son titre et des pastilles qui comptent ses autres contenus, comme dans les autres vues. Cliquez pour ouvrir sa fiche. Glissez-le pour le réordonner ou le ranger sous un autre élément du même espace ; pour changer d\'espace, utilisez « Déplacer vers un espace » du menu ⋮. Le nom de la personne assignée s\'affiche à côté du titre, avec une icône.',
    target: '[data-tour="list-row"]',
    side: 'bottom',
  },
} satisfies HelpElements;

export const help: HelpEntry = {
  title: 'Liste',
  summary: 'Tous les éléments de l\'espace en tableau : titre, type, statut, priorité, dates, parent.',
  short: 'Tableau avec colonnes triables',
  empty: 'L\'espace ne contient encore aucun élément. Créez le premier avec « Nouveau ».',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Vue Liste',
        description: 'Tous vos éléments en tableau. Triez, filtrez et agissez rapidement sur chaque ligne.',
      },
    },
    ...elementTourSteps('list', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};
