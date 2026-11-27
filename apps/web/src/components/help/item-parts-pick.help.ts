/* Aide utilisateur de la modale de choix avant « Éclater en sous-éléments » / « Absorber les enfants » (ItemPartsPickModal),
   écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? » (PageHelpButton), le tour et le
   mode Aide. Éclater (2026-11-27) : titres de niveau 2, niveaux 3 au choix, destination des contenus — zones sous-titres
   et contenus affichées seulement si la description / l'élément en ont. Rappels (`hints`, via pageHint) écrits d'après apps/api/src/routes/items.ts (POST /:id/split) et
   apps/api/src/routes/item-merge.ts (POST /:id/absorb-children) : à revoir si ces routes changent. Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  liste: {
    title: 'Parties à traiter',
    short: 'Cochez les parties à éclater ou à absorber.',
    text: 'Une ligne par partie, avec son titre et le début de son texte. Pour « Éclater » : une ligne par titre de niveau 2 de la description, cochée à l\'ouverture ; chaque section cochée devient un sous-élément, les autres restent dans la description, titre compris, à leur place. Sous chaque titre de niveau 2, ses titres de niveau 3, décochés à l\'ouverture : coché, le niveau 3 devient un sous-élément de celui de sa section ; décoché, il reste dans le texte de sa section. Pour « Absorber » : une ligne par sous-élément direct, cochée à l\'ouverture ; chaque sous-élément coché est fondu dans l\'élément, les autres restent ses sous-éléments.',
    side: 'top',
    changes: [{
      id: 'item-parts-pick-modal',
      kind: 'evolution',
      text: '« Éclater en sous-éléments » et « Absorber les enfants » ouvrent maintenant une fenêtre où vous choisissez, une par une, les sections ou les sous-éléments concernés.',
      date: '2026-11-26',
    }, {
      id: 'item-split-h2-h3-contents',
      kind: 'evolution',
      text: '« Éclater en sous-éléments » crée maintenant un sous-élément par titre de niveau 2. Pour chaque titre de niveau 3, vous choisissez s\'il reste dans le texte ou devient un sous-élément, et pour chaque image, fichier, lien ou autre contenu, le sous-élément où le déplacer.',
      date: '2026-11-27',
    }],
  },
  tout: {
    title: 'Tout cocher',
    short: 'Coche ou décoche toutes les lignes principales d\'un coup.',
    text: 'Coche toutes les lignes principales (titres de niveau 2 pour « Éclater », sous-éléments pour « Absorber »), ou les décoche toutes si elles le sont déjà, pour n\'en garder ensuite que quelques-unes.',
    side: 'bottom',
  },
  'sous-titres': {
    title: 'Sous-titres',
    short: 'Éclate ou garde dans le texte tous les titres de niveau 3 d\'un coup.',
    text: '« Éclater » seulement, si la description a des titres de niveau 3. « Éclater tous les sous-titres » coche chaque titre de niveau 3 des sections cochées : chacun deviendra un sous-élément de celui de sa section. « Garder les sous-titres dans le texte » les décoche tous : ils restent dans la description de leur section. Chaque titre de niveau 3 se règle aussi un par un dans la liste.',
    side: 'bottom',
  },
  contenus: {
    title: 'Contenus',
    short: 'Choisissez où va chaque image, fichier, lien, schéma ou coordonnée.',
    text: '« Éclater » seulement, si l\'élément a des contenus. Une ligne par contenu, avec une liste : « Reste sur l\'élément » (au départ) ou l\'un des sous-éléments cochés. Le contenu est déplacé, pas copié. Si vous décochez le sous-élément choisi, le contenu revient sur « Reste sur l\'élément ». Les données sécurisées restent toujours sur l\'élément.',
    side: 'top',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Éclater ou absorber',
  summary: 'Choisissez, partie par partie, ce qui devient un sous-élément (Éclater) ou ce qui est fondu dans l\'élément (Absorber).',
  ...derived,
  hints: {
    ...derived.hints,
    introSplit: 'Chaque titre de niveau 2 coché devient un sous-élément (titre et texte de sa section). Chaque titre de niveau 3 coché devient un sous-élément de celui de sa section ; décoché, il reste dans son texte. Les sections décochées et le texte placé avant le premier titre de niveau 2 restent dans la description.',
    introAbsorb: 'Chaque sous-élément coché est fondu dans cet élément puis supprimé. Les sous-éléments décochés restent tels quels.',
    emptySplit: 'La description ne contient aucun titre de niveau 2 : rien à éclater.',
    subsectionsSplit: 'Coche ou décoche d\'un coup les titres de niveau 3 des sections cochées. Coché : sous-élément de celui de sa section. Décoché : reste dans son texte.',
    contentsSplit: 'Choisissez le sous-élément où déplacer chaque contenu ; « Reste sur l\'élément » le laisse ici. Le contenu est déplacé, pas copié.',
    emptyAbsorb: 'Cet élément n\'a pas de sous-élément direct : rien à absorber.',
    confirmSplit: 'Crée un sous-élément par titre coché (type Élément, statut de l\'élément), les niveaux 3 sous celui de leur section, retire ces sections de la description et déplace les contenus vers le sous-élément choisi ; les autres contenus restent sur l\'élément. Pas d\'annulation depuis cette fenêtre.',
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
