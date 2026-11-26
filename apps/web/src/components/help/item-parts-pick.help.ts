/* Aide utilisateur de la modale de choix avant « Éclater en sous-éléments » / « Absorber les enfants » (ItemPartsPickModal),
   écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? » (PageHelpButton), le tour et le
   mode Aide. Rappels (`hints`, via pageHint) écrits d'après apps/api/src/routes/items.ts (POST /:id/split) et
   apps/api/src/routes/item-merge.ts (POST /:id/absorb-children) : à revoir si ces routes changent. Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  liste: {
    title: 'Parties à traiter',
    short: 'Cochez les parties à éclater ou à absorber.',
    text: 'Une ligne par partie, avec son titre et le début de son texte. Pour « Éclater » : une ligne par titre de niveau 2 ou 3 de la description ; chaque section cochée devient un sous-élément, les autres restent dans la description, titre compris, à leur place. Pour « Absorber » : une ligne par sous-élément direct ; chaque sous-élément coché est fondu dans l\'élément, les autres restent ses sous-éléments. Tout est coché à l\'ouverture.',
    side: 'top',
    changes: [{
      id: 'item-parts-pick-modal',
      kind: 'evolution',
      text: '« Éclater en sous-éléments » et « Absorber les enfants » ouvrent maintenant une fenêtre où vous choisissez, une par une, les sections ou les sous-éléments concernés.',
      date: '2026-11-26',
    }],
  },
  tout: {
    title: 'Tout cocher',
    short: 'Coche ou décoche toutes les lignes d\'un coup.',
    text: 'Coche toutes les lignes, ou les décoche toutes si elles le sont déjà, pour n\'en garder ensuite que quelques-unes.',
    side: 'bottom',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Éclater ou absorber',
  summary: 'Choisissez, partie par partie, ce qui devient un sous-élément (Éclater) ou ce qui est fondu dans l\'élément (Absorber).',
  ...derived,
  hints: {
    ...derived.hints,
    introSplit: 'Chaque section cochée devient un sous-élément (titre de la section, texte de la section). Les sections décochées et le texte placé avant le premier titre restent dans la description.',
    introAbsorb: 'Chaque sous-élément coché est fondu dans cet élément puis supprimé. Les sous-éléments décochés restent tels quels.',
    emptySplit: 'La description ne contient aucun titre de niveau 2 ou 3 : rien à éclater.',
    emptyAbsorb: 'Cet élément n\'a pas de sous-élément direct : rien à absorber.',
    confirmSplit: 'Crée un sous-élément par section cochée (type Élément, statut de l\'élément, sans image ni fichier : les contenus restent sur l\'élément) et retire ces sections de la description. Pas d\'annulation depuis cette fenêtre.',
    confirmAbsorb: 'Ajoute à la description le titre et le texte de chaque sous-élément coché, reprend ses contributions, tags, relations, contenus, références externes et données sécurisées (sans doublon), remonte ses propres sous-éléments d\'un niveau, puis le supprime. Pas d\'annulation depuis cette fenêtre.',
  },
  tour: [
    {
      popover: {
        title: 'Éclater ou absorber',
        description: 'Rien n\'est fait sans votre choix : cochez les parties concernées, puis confirmez.',
      },
    },
    ...elementTourSteps('item-parts-pick', elements),
  ],
};
