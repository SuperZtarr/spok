/* Aide utilisateur de la vue « Réseau d'un élément » (ego), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  reglages: {
    title: 'Élément central et profondeur',
    short: 'L\'élément au centre et la profondeur des liens.',
    text: 'Choisissez l\'élément au centre (avec recherche) ; la profondeur va de 1 (voisins directs) à 3 niveaux. Relations et hiérarchie sont toutes deux affichées.',
    target: '[data-tour="ego-controls"]',
    side: 'bottom',
  },
  noeud: {
    title: 'Un nœud',
    short: 'Un clic le recentre, un double-clic ouvre sa fiche.',
    text: 'Un clic recentre le réseau sur lui ; un double-clic ouvre sa fiche.',
    target: '[data-tour="ego-node"]',
    side: 'right',
  },
};

export const help: HelpEntry = {
  title: 'Réseau d\'un élément',
  summary: 'Le réseau autour d\'un élément choisi : ses voisins directs, puis indirects, en anneaux.',
  short: 'Réseau égocentrique',
  empty: 'Aucun élément autour duquel construire un réseau. Créez des éléments et reliez-les (hiérarchie, relations, tags).',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Vue Réseau d\'un élément',
        description: 'Tout ce qui gravite autour d\'un élément : ce qu\'il bloque, ce qui le permet, ses parents, ses enfants…',
      },
    },
    ...elementTourSteps('ego', elements),
    ...SPACE_TOOLBAR_STEPS,
  ],
};
