/* Aide utilisateur de la vue « Process » (process) : canevas libre pour poser les items de l'espace et les relier
   (brainstorm → enchaînement de tâches). Lue par le point d'interrogation (ViewHelpButton), le tour (useViewOnboarding),
   l'état vide (EmptyHelp mode="process") et le mode Aide (zones data-help-zone="process:*" de ProcessView). */
import type { HelpEntry } from '../../../help/types';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Process',
  summary: 'Un canevas libre pour poser les items de l\'espace et les relier en enchaînement.',
  short: 'Poser et relier librement',
  empty: 'Le process est vide. Glissez un item depuis le panneau de gauche, ou double-cliquez sur le canevas pour noter une idée.',
  tips: [
    'Glissez un item du panneau « Non placés » sur le canevas pour le poser',
    'Double-cliquez sur le vide pour créer une note à cet endroit',
    'Tirez d\'un bord d\'un item vers un autre pour créer une relation',
    'Cliquez sur une flèche pour modifier ou supprimer la relation',
    '« Retirer du process » renvoie l\'item dans le panneau sans le supprimer',
    'Les positions sont partagées avec tous les membres de l\'espace',
  ],
  zones: {
    canevas: { title: 'Canevas', text: 'Les items posés à la main et leurs relations. Rien n\'est rangé automatiquement : la place choisie reste.' },
    noeud: { title: 'Un item', text: 'Déplacez-le à la souris ; tirez depuis son bord pour le relier ; double-cliquez pour ouvrir sa fiche.' },
    panneau: { title: 'Non placés', text: 'Les items de l\'espace qui ne sont pas encore sur le canevas. Glissez-les pour les poser.' },
  },
  tour: [
    {
      popover: {
        title: 'Vue Process',
        description: 'Posez librement les items de l\'espace, puis reliez-les au fil de la réflexion pour construire un enchaînement.',
      },
    },
    {
      element: '[data-tour="process-unplaced"]',
      popover: {
        title: 'Items non placés',
        description: 'Les items pas encore sur le canevas. Glissez-en un pour le poser ; la recherche aide à le retrouver.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="process-canvas"]',
      popover: {
        title: 'Le canevas',
        description: 'Double-cliquez sur le vide pour noter une idée. Les positions sont conservées et partagées.',
        side: 'left',
      },
    },
    {
      element: '[data-tour="process-node"]',
      popover: {
        title: 'Relier deux items',
        description: 'Tirez depuis le bord droit d\'un item vers un autre : vous choisissez le type de relation. Cliquez sur une flèche pour la modifier.',
        side: 'right',
      },
    },
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};
