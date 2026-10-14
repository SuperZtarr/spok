/* Aide utilisateur de la vue « Réseau d'un élément » (ego) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Réseau d\'un élément',
  summary: 'Le réseau autour d\'un élément choisi : ses voisins directs, puis indirects, en anneaux.',
  short: 'Réseau égocentrique',
  empty: 'Aucun élément autour duquel construire un réseau. Créez des éléments et reliez-les (hiérarchie, relations, tags).',
  tips: [
    'Choisissez l\'élément central dans la liste, ou cliquez sur un nœud pour le recentrer',
    'Réglez la profondeur de 1 à 3 niveaux',
    'Double-cliquez sur un nœud pour ouvrir sa fiche',
    'Relations et hiérarchie sont toutes deux affichées',
  ],
  zones: {
    reglages: { title: 'Réglages', text: 'L\'élément au centre (avec recherche) et la profondeur des liens, de 1 à 3 niveaux.' },
    noeud: { title: 'Un nœud', text: 'Un clic recentre le réseau sur lui ; un double-clic ouvre sa fiche.' },
  },
  tour: [
    {
      popover: {
        title: 'Vue Réseau d\'un élément',
        description: 'Tout ce qui gravite autour d\'un élément : ce qu\'il bloque, ce qui le permet, ses parents, ses enfants…',
      },
    },
    {
      element: '[data-tour="ego-controls"]',
      popover: {
        title: 'Élément central et profondeur',
        description: 'Choisissez l\'élément au centre (avec recherche) ; la profondeur va de 1 (voisins directs) à 3 niveaux.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="ego-node"]',
      popover: {
        title: 'Un nœud',
        description: 'Un clic recentre le réseau sur lui ; un double-clic ouvre sa fiche.',
        side: 'right',
      },
    },
    ...SPACE_TOOLBAR_STEPS,
  ],
};
