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
    'Glissez un item du panneau « Non placés » sur le canevas pour le poser ; le panneau suit l\'arborescence des items',
    '« Réorganiser en processus » range les items de gauche à droite selon les liens « Bloque » et « Permet »',
    '« Définir comme couloir » (menu ⋯ d\'un item, ou bouton du panneau) crée une bande nommée par cet item ; glissez-y des items pour les ranger — c\'est purement visuel',
    'Le menu du titre d\'un couloir permet de le monter, le descendre ou le retirer (ses items restent en place)',
    'Le chevron du titre replie un couloir en petite boîte : ses items sont masqués et leurs liens arrivent sur le couloir (réglage propre à votre navigateur)',
    'Attrapez un couloir par son titre pour l\'écarter des autres : ses items le suivent ; « Réorganiser » le remet dans la pile',
    'Un lien vers l\'item d\'un couloir est conservé : il arrive sur le couloir, comme vers un sous-processus',
    'Tirez une relation vers l\'entrée d\'un couloir (poignée gauche) ou depuis sa sortie (poignée droite) : elle est créée avec l\'item du couloir',
    'Déplacer des items vers un autre espace emporte leur place dans le process : positions et couloirs les suivent (un item parti sans son couloir y arrive libre)',
    'Double-cliquez sur le vide pour créer une note à cet endroit',
    'Tirez d\'un bord d\'un item vers un autre pour créer une relation',
    'Cliquez sur une flèche pour modifier ou supprimer la relation',
    'Une bulle sur une flèche signale un commentaire : survolez-la pour le lire',
    '« Retirer du process » renvoie l\'item dans le panneau sans le supprimer',
    'Les positions sont partagées avec tous les membres de l\'espace',
  ],
  hints: {
    reorganize: 'Ranger les items placés en colonnes, de gauche à droite, selon leurs liens « Bloque » et « Permet » ; chaque item reste dans son couloir (remplace la disposition actuelle pour tous les membres)',
    makeLane: 'Définir comme couloir : cet item devient une bande où ranger d\'autres items',
  },
  zones: {
    canevas: { title: 'Canevas', text: 'Les items posés à la main et leurs relations. Rien n\'est rangé automatiquement : la place choisie reste.' },
    noeud: { title: 'Un item', text: 'Déplacez-le à la souris ; tirez depuis son bord pour le relier ; double-cliquez pour ouvrir sa fiche.' },
    couloir: { title: 'Un couloir', text: 'Une bande nommée par un item, où l\'on range visuellement d\'autres items. Glissez un item dedans ou dehors ; le titre ouvre la fiche de l\'item.' },
    panneau: { title: 'Non placés', text: 'Les items de l\'espace qui ne sont pas encore sur le canevas, rangés par parent. Glissez-les pour les poser.' },
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
        description: 'Les items pas encore sur le canevas, rangés par parent (chevrons pour replier). Glissez-en un pour le poser ; la recherche aide à le retrouver.',
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
    {
      element: '[data-tour="process-lane"]',
      popover: {
        title: 'Couloirs',
        description: 'Une bande nommée par un item (« Définir comme couloir » dans le menu ⋯). Glissez-y des items pour ranger un flux ; déplacez-la par son titre ; le chevron la replie, le menu du titre la monte, la descend ou la retire.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="process-reorganize"]',
      popover: {
        title: 'Réorganiser en processus',
        description: 'Range les items placés en colonnes, de gauche à droite, selon leurs liens « Bloque » et « Permet », chacun dans son couloir. La nouvelle disposition est partagée avec tous les membres.',
        side: 'bottom',
      },
    },
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};
