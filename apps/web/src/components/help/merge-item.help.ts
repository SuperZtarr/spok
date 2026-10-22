/* Aide utilisateur de la modale « Fusionner avec… » (MergeItemModal).
   Lue par son point d'interrogation (PageHelpButton), son tour et ses rappels (pageHint) — registre help/pageHelp.ts.
   Rappels écrits d'après apps/api/src/routes/item-merge.ts : à revoir si la route change. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Fusionner deux éléments',
  summary: 'Regroupe deux éléments en un seul : la cible est conservée avec les champs choisis, la source est supprimée.',
  tips: [
    'Choisissez la cible : seuls les éléments du même espace que vous pouvez modifier sont proposés',
    'Pour chaque champ qui diffère, gardez la valeur de la source (A) ou de la cible (B)',
    'La description peut être gardée d\'un côté ou réunie (A+B)',
    'Enfants, contributions, tags et relations de la source passent à la cible',
  ],
  tour: [
    {
      popover: {
        title: 'Fusionner deux éléments',
        description: 'La source disparaît au profit de la cible, qui reçoit les champs que vous choisissez.',
      },
    },
    {
      element: '[data-tour="merge-source"]',
      popover: {
        title: 'Source',
        description: 'L\'élément de départ : il sera supprimé après la fusion.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="merge-targets"]',
      popover: {
        title: 'Cible',
        description: 'Choisissez l\'élément conservé. Seuls les éléments du même espace que vous pouvez modifier sont proposés.',
        side: 'top',
      },
    },
  ],
  hints: {
    pickTarget: 'Sont proposés les éléments du même espace que vous pouvez modifier (ceux que vous avez créés ou qui vous sont assignés, ou tous si vous êtes propriétaire de l\'espace), hors source et ses sous-éléments, hors copies de séance verrouillées.',
    noTarget: 'Aucun élément ne peut servir de cible : il faut un autre élément du même espace que vous pouvez modifier.',
    transfer: 'Les enfants, contributions, tags et relations de la source seront transférés à la cible (relations en double et liens entre les deux éléments supprimés).',
    sourceDeleted: 'La source sera supprimée après la fusion.',
    confirm: 'Met à jour la cible avec les champs choisis, lui transfère enfants, contributions, tags et relations, puis supprime la source. Pas d\'annulation depuis cette fenêtre.',
  },
};
