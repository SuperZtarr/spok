/* Aide utilisateur de la vue « Bulles » (bubble) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Bulles',
  summary: 'Les éléments en bulles imbriquées : un parent contient ses enfants, la taille suit le critère choisi.',
  short: 'Bulles proportionnelles',
  empty: 'Aucun élément à mettre en bulles. Créez des éléments, puis des enfants sous eux, pour voir les bulles s\'imbriquer.',
  tips: [
    'Cliquez sur une bulle qui contient d\'autres bulles pour zoomer dessus, cliquez à nouveau pour revenir',
    'Cliquez sur une bulle sans enfant (ou double-cliquez sur n\'importe laquelle) pour ouvrir sa fiche',
    'Choisissez la taille : égale, par contributions ou par relations',
  ],
  zones: {
    noeud: { title: 'Une bulle', text: 'Une bulle qui en contient d\'autres zoome au clic ; une bulle simple (ou un double-clic) ouvre sa fiche.' },
    taille: { title: 'Taille des bulles', text: 'Égale, ou proportionnelle aux contributions ou aux relations : pour repérer ce qui est le plus discuté ou le plus relié.' },
  },
  tour: [
    {
      popover: {
        title: 'Vue Bulles',
        description: 'Chaque élément est une bulle ; ses enfants sont dedans.',
      },
    },
    {
      element: '[data-tour="bubble-node"]',
      popover: {
        title: 'Une bulle',
        description: 'Clic sur une bulle qui en contient d\'autres : zoom dessus (clic à nouveau ou sur le fond pour revenir). Clic sur une bulle simple ou double-clic : ouvre sa fiche.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="bubble-size"]',
      popover: {
        title: 'Taille des bulles',
        description: 'Égale, proportionnelle aux contributions ou aux relations : pour repérer ce qui est le plus discuté ou le plus relié.',
        side: 'top',
      },
    },
    ...SPACE_TOOLBAR_STEPS,
  ],
};
