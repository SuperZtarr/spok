/* Aide utilisateur de la vue « Process » (process) : canevas libre pour poser les items de l'espace et les relier
   (brainstorm → enchaînement de tâches). Écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? »
   (ViewHelpButton), le tour (useViewOnboarding), le mode Aide (zones data-help-zone="process:*" de ProcessView), l'état vide
   (EmptyHelp mode="process") et les infobulles (reorganize, makeLane : clés lues par ProcessView et ProcessUnplacedPanel). */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  panneau: {
    title: 'Items non placés',
    short: 'Les items pas encore sur le canevas.',
    text: 'Les items pas encore sur le canevas, rangés par parent comme dans l\'arborescence (chevrons pour replier). Glissez-en un pour le poser ; la recherche aide à le retrouver.',
    target: '[data-tour="process-unplaced"]',
    side: 'right',
  },
  canevas: {
    title: 'Le canevas',
    short: 'Les items posés à la main et leurs relations.',
    text: 'Les items posés à la main et leurs relations : rien n\'est rangé automatiquement, la place choisie reste, partagée avec tous les membres de l\'espace. Double-cliquez sur le vide pour noter une idée à cet endroit. Cliquez sur une flèche pour modifier ou supprimer la relation ; une bulle sur une flèche signale un commentaire, survolez-la pour le lire.',
    target: '[data-tour="process-canvas"]',
    side: 'left',
  },
  noeud: {
    title: 'Un item',
    short: 'Déplacez-le, reliez-le, double-cliquez pour sa fiche.',
    text: 'Déplacez-le à la souris ; double-cliquez pour ouvrir sa fiche. Tirez depuis son bord vers un autre item pour créer une relation et choisir son type. « Retirer du process » le renvoie dans le panneau sans le supprimer. Déplacé vers un autre espace, il emporte sa place dans le process, et y arrive libre s\'il part sans son couloir.',
    target: '[data-tour="process-node"]',
    side: 'right',
  },
  couloir: {
    title: 'Un couloir',
    short: 'Une bande où ranger visuellement des items.',
    text: 'Une bande nommée par un item (« Définir comme couloir » dans son menu ⋯ ou le panneau), purement visuelle. Glissez-y des items ou sortez-les ; le titre ouvre la fiche de l\'item, et l\'attraper écarte le couloir avec ses items. Le chevron le replie en petite boîte : ses items sont masqués, leurs liens arrivent sur le couloir (réglage propre à votre navigateur). Le menu du titre le monte, le descend ou le retire, ses items restant en place. Tirez une relation vers son entrée (poignée gauche) ou depuis sa sortie (poignée droite) : elle est créée avec l\'item du couloir ; un lien vers un item d\'un couloir est conservé et arrive sur le couloir, comme vers un sous-processus.',
    target: '[data-tour="process-lane"]',
    side: 'bottom',
  },
  reorganize: {
    title: 'Réorganiser en processus',
    short: 'Ranger les items placés en colonnes, de gauche à droite, selon leurs liens « Bloque » et « Permet » ; chaque item reste dans son couloir (remplace la disposition actuelle pour tous les membres)',
    text: 'Range les items placés en colonnes, de gauche à droite, selon leurs liens « Bloque » et « Permet », chacun dans son couloir ; un couloir écarté est remis dans la pile. La nouvelle disposition est partagée avec tous les membres.',
    target: '[data-tour="process-reorganize"]',
    noZone: true,
    side: 'bottom',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Process',
  summary: 'Un canevas libre pour poser les items de l\'espace et les relier en enchaînement.',
  short: 'Poser et relier librement',
  empty: 'Le process est vide. Glissez un item depuis le panneau de gauche, ou double-cliquez sur le canevas pour noter une idée.',
  ...derived,
  hints: {
    ...derived.hints,
    makeLane: 'Définir comme couloir : cet item devient une bande où ranger d\'autres items',
  },
  tour: [
    {
      popover: {
        title: 'Vue Process',
        description: 'Posez librement les items de l\'espace, puis reliez-les au fil de la réflexion pour construire un enchaînement.',
      },
    },
    ...elementTourSteps('process', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};
