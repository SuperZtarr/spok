/* Aide utilisateur des Paramètres de la communauté (/communities/:id/settings), écrite en éléments d'aide (help/elements.ts) : un texte par onglet,
   repris par le « ? » (HelpButton) et le tour (usePageTourPulse) ; un onglet n'a pas de zone du mode Aide. `fields` : aide sous les champs (FieldHelp).
   Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  general: {
    title: 'Général',
    short: 'Nom, description, visibilité et contexte.',
    text: 'Nom, description, visibilité et contexte (Forum, Projet, Loisirs) de la communauté.',
    target: '[data-tour="community-tab-general"]',
    noZone: true,
    side: 'bottom',
  },
  images: {
    title: 'Images',
    short: 'Avatar et couverture.',
    text: 'Avatar (affiché dans la barre latérale et les cartes) et image de couverture. Glissez ou cliquez pour envoyer une image.',
    target: '[data-tour="community-tab-images"]',
    noZone: true,
    side: 'bottom',
  },
  espaces: {
    title: 'Espaces',
    short: 'Les espaces et leur hiérarchie.',
    text: 'Liste des espaces de la communauté. Glissez une ligne sur le haut ou le bas d\'une autre pour changer l\'ordre, sur son milieu pour la ranger dedans. Créez de nouveaux espaces.',
    target: '[data-tour="community-tab-spaces"]',
    noZone: true,
    side: 'bottom',
  },
  membres: {
    title: 'Membres',
    short: 'Les accès en 3 colonnes.',
    text: '3 colonnes : non-membres → membres → propriétaires. Cliquez les flèches pour déplacer entre colonnes.',
    target: '[data-tour="community-tab-members"]',
    noZone: true,
    side: 'bottom',
  },
  emails: {
    title: 'Emails',
    short: 'Historique et renvoi des emails.',
    text: 'Historique des emails envoyés à la communauté. Renvoyez un email aux nouveaux membres ou individuellement.',
    target: '[data-tour="community-tab-emails"]',
    noZone: true,
    side: 'bottom',
  },
  referentiels: {
    title: 'Référentiels',
    short: 'Statuts et libellés de types.',
    text: 'Les statuts et les libellés de types de la communauté : libellés, couleurs, ordre. Les espaces en héritent.',
    target: '[data-tour="community-tab-referentiels"]',
    noZone: true,
    side: 'bottom',
  },
  tags: {
    title: 'Tags',
    short: 'Les tags partagés par les espaces.',
    text: 'Les tags partagés par les espaces de la communauté : nom et couleur.',
    target: '[data-tour="community-tab-tags"]',
    noZone: true,
    side: 'bottom',
  },
  apercu: {
    title: 'Aperçu',
    short: 'Comment la communauté apparaît dans les listes.',
    text: 'Comment la communauté apparaît dans les listes (vignette).',
    target: '[data-tour="community-tab-apercu"]',
    noZone: true,
    side: 'bottom',
  },
  danger: {
    title: 'Danger',
    short: 'Supprimer la communauté.',
    text: 'Supprimer la communauté, avec ou sans ses espaces.',
    target: '[data-tour="community-tab-danger"]',
    noZone: true,
    side: 'bottom',
  },
};

export const help: HelpEntry = {
  title: 'Paramètres de la communauté',
  summary: 'Gérez votre communauté : informations et contexte, images, référentiels, tags, espaces, membres et emails.',
  ...helpFromElements(elements),
  fields: {
    spacesOpenSettings: 'Cliquer un espace ouvre ses paramètres (pas l\'espace lui-même) — pour y entrer, passez par la barre latérale ou la page de la communauté.',
    spacesOrder:'Glissez un espace sur le haut ou le bas d\'une ligne pour le placer avant ou après (ordre vu par tous les membres), sur son milieu pour en faire un sous-espace, ou sur le bandeau du haut pour le remettre au premier niveau.',
    visibilityRequest: 'Rendre la communauté visible par tous nécessite la validation d\'un administrateur : une demande sera envoyée à l\'enregistrement.',
    context: 'Le contexte adapte automatiquement l\'interface (vues proposées, champs) pour tous les visiteurs de la communauté. Il choisit aussi la vue d\'ouverture des espaces sans vue par défaut : Forum → Discussions, Projet → Gantt, Loisirs → Carte mentale.',
    reservedStatus: 'Issue d’une question (Ouverte, Tranchée, Reportée, Sans conclusion) : proposée seulement pour les éléments Question, qui n’utilisent qu’elles. Libellé, couleur, ordre et visibilité se modifient ; elle ne se supprime pas.',
    avatar: '256 × 256 px, affiché en rond. Cliquez sur l\'image pour la changer.',
  },
  tour: elementTourSteps('community-settings', elements),
};
