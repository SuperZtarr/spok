/* Aide utilisateur de la modale « Fusionner avec… » (MergeItemModal), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? »
   (PageHelpButton), le tour et le mode Aide. Rappels (`hints`, via pageHint) écrits d'après apps/api/src/routes/item-merge.ts : à revoir si la route change.
   Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  source: {
    title: 'Source',
    short: 'L\'élément de départ, supprimé après la fusion.',
    text: 'L\'élément de départ : il sera supprimé après la fusion. Ses enfants, contributions, tags et relations passent à la cible.',
    target: '[data-tour="merge-source"]',
    side: 'bottom',
  },
  cible: {
    title: 'Cible',
    short: 'L\'élément conservé.',
    text: 'Choisissez l\'élément conservé. Seuls les éléments du même espace que vous pouvez modifier sont proposés. Ensuite, pour chaque champ qui diffère, gardez la valeur de la source (A) ou de la cible (B) ; la description peut être gardée d\'un côté ou réunie (A+B).',
    target: '[data-tour="merge-targets"]',
    side: 'top',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Fusionner deux éléments',
  summary: 'Regroupe deux éléments en un seul : la cible est conservée avec les champs choisis, la source est supprimée.',
  ...derived,
  hints: {
    ...derived.hints,
    pickTarget: 'Sont proposés les éléments du même espace que vous pouvez modifier (ceux que vous avez créés ou qui vous sont assignés, ou tous si vous êtes propriétaire de l\'espace), hors source et ses sous-éléments, hors copies de séance verrouillées.',
    noTarget: 'Aucun élément ne peut servir de cible : il faut un autre élément du même espace que vous pouvez modifier.',
    transfer: 'Les enfants, contributions, tags et relations de la source seront transférés à la cible (relations en double et liens entre les deux éléments supprimés).',
    sourceDeleted: 'La source sera supprimée après la fusion.',
    confirm: 'Met à jour la cible avec les champs choisis, lui transfère enfants, contributions, tags et relations, puis supprime la source. Pas d\'annulation depuis cette fenêtre.',
  },
  tour: [
    {
      popover: {
        title: 'Fusionner deux éléments',
        description: 'La source disparaît au profit de la cible, qui reçoit les champs que vous choisissez.',
      },
    },
    ...elementTourSteps('merge-item', elements),
  ],
};
