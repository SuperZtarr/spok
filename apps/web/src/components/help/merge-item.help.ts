/* Aide utilisateur de la modale « Fusionner avec… » (MergeItemModal), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? »
   (PageHelpButton), le tour et le mode Aide. Rappels (`hints`, via pageHint) écrits d'après apps/api/src/routes/item-merge.ts : à revoir si la route change.
   Contenus (lot 5) : élément « contenus » (ligne Contenus de la comparaison, cumul sans doublon, plafond).
   Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  source: {
    title: 'Source',
    short: 'L\'élément de départ, supprimé après la fusion.',
    text: 'L\'élément de départ : il sera supprimé après la fusion. Ses enfants, contributions, tags, relations et contenus (images, fichiers, liens, schémas) passent à la cible.',
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
  contenus: {
    title: 'Contenus',
    short: 'Les contenus des deux éléments sont cumulés sur la cible.',
    text: 'Pas de choix à faire : la cible garde ses images, fichiers, liens et schémas, et reçoit ceux de la source à la suite. Un contenu présent des deux côtés n\'est gardé qu\'une fois (même lien, même fichier ou même nom et même taille, même schéma). La ligne donne le résultat : « 3 + 2 → 4 (1 doublon retiré) ». Un élément porte au plus 30 contenus : au-delà, la fusion est refusée.',
    side: 'top',
    changes: [{
      id: 'merge-contents-cumulated',
      kind: 'evolution',
      text: 'Fusionner deux éléments cumule désormais leurs contenus sur la cible, sans doublon ; la ligne « Contenus » annonce le résultat avant de valider.',
      date: '2026-11-11',
    }],
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
    transfer: 'Les enfants, contributions, tags, relations et contenus de la source seront transférés à la cible (relations et contenus en double retirés, liens entre les deux éléments supprimés).',
    contents: 'Source + cible → total sur la cible après fusion. Un doublon (même lien, même fichier ou même nom et même taille, même schéma) n\'est gardé qu\'une fois, dans sa version de la cible.',
    contentsTooMany: 'La cible porterait plus de {max} contenus : retirez-en d\'abord de la source ou de la cible.',
    sourceDeleted: 'La source sera supprimée après la fusion.',
    confirm: 'Met à jour la cible avec les champs choisis, lui transfère enfants, contributions, tags, relations et contenus (sans doublon), puis supprime la source. Pas d\'annulation depuis cette fenêtre.',
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
