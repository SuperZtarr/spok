/* Aide utilisateur des Paramètres de l'espace (/spaces/:id/settings), écrite en éléments d'aide (help/elements.ts) : un texte par onglet, repris
   par le « ? » (HelpButton) et le tour (usePageTourPulse) ; un onglet n'a pas de zone du mode Aide. `fields` : aide sous les champs (FieldHelp).
   Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  general: {
    title: 'Général',
    short: 'Nom, communauté, parent, visibilité, vue par défaut.',
    text: 'Nom, communauté de rattachement, espace parent, visibilité (dont « héritée »), vue ouverte par défaut et rôle des nouveaux membres de la communauté.',
    target: '[data-tour="space-tab-general"]',
    noZone: true,
    side: 'bottom',
  },
  images: {
    title: 'Images',
    short: 'Avatar et couverture.',
    text: 'Avatar (barre latérale, cartes) et image de couverture. Glissez, collez ou choisissez une image, puis cadrez la couverture.',
    target: '[data-tour="space-tab-images"]',
    noZone: true,
    side: 'bottom',
  },
  membres: {
    title: 'Membres',
    short: 'Les accès en 3 colonnes.',
    text: 'Les accès en 3 colonnes : non-membres → membres → propriétaires. Invitez de nouvelles personnes par email.',
    target: '[data-tour="space-tab-members"]',
    noZone: true,
    side: 'bottom',
  },
  apercu: {
    title: 'Aperçu',
    short: 'Comment l\'espace apparaît dans les listes.',
    text: 'Comment l\'espace apparaît dans les listes (carte).',
    target: '[data-tour="space-tab-apercu"]',
    noZone: true,
    side: 'bottom',
  },
  danger: {
    title: 'Zone de danger',
    short: 'Transférer la propriété ou supprimer.',
    text: 'Transférer la propriété ou supprimer l\'espace, avec prévisualisation de ce qui sera supprimé : sous-espaces supprimés ou détachés.',
    target: '[data-tour="space-tab-danger"]',
    noZone: true,
    side: 'bottom',
  },
};

export const help: HelpEntry = {
  title: 'Paramètres de l\'espace',
  summary: 'Configurez votre espace : nom, communauté et parent, visibilité, vue par défaut, images, membres.',
  ...helpFromElements(elements),
  fields: {
    community: 'Rattache cet espace à une communauté dont vous êtes membre.',
    parent: 'Range cet espace sous un autre espace de la même communauté : il en devient un sous-espace.',
    defaultRole: 'Quand quelqu\'un rejoint la communauté, il est ajouté automatiquement à cet espace avec ce rôle.',
    visibility: 'Ce que peuvent faire les membres de la communauté qui ne sont pas membres de cet espace. « Héritée » suit l\'espace parent ou la communauté.',
    defaultView: 'La vue affichée à l\'ouverture de l\'espace, pour tout le monde. « Selon la communauté » suit le contexte de sa communauté : Forum → Discussions, Projet → Gantt, Loisirs → Carte mentale, Documentation → Arborescence, Exploration → Récents, sinon Liste.',
    avatar: '256 × 256 px, affiché en rond. Cliquez sur l\'image pour la changer.',
  },
  tour: elementTourSteps('space-settings', elements),
};
