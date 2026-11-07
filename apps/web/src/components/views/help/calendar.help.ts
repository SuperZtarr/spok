/* Aide utilisateur de la vue « Calendrier » (calendar), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. L'intérieur de FullCalendar n'accepte pas de zone :
   une seule zone, les autres éléments visent ses classes (.fc-*). */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  calendrier: {
    title: 'Calendrier',
    short: 'Les éléments datés jour par jour.',
    text: 'Vos éléments datés posés sur le calendrier, avec les numéros de semaine. Changez de période et d\'affichage en haut, glissez un élément pour le déplacer.',
    side: 'top',
  },
  navigation: {
    title: 'Navigation et affichage',
    short: 'Changez de période et d\'affichage.',
    text: 'Précédent / Suivant / Aujourd\'hui pour se déplacer ; Mois, Semaine ou Liste pour l\'affichage.',
    target: '.fc-header-toolbar',
    noZone: true,
    side: 'bottom',
  },
  evenement: {
    title: 'Un élément',
    short: 'Cliquez pour ouvrir sa fiche.',
    text: 'Cliquez pour ouvrir sa fiche ; glissez-le vers un autre jour pour le replanifier ; tirez son bord pour changer sa durée.',
    target: '.fc-event',
    noZone: true,
    side: 'bottom',
  },
  creer: {
    title: 'Créer en sélectionnant',
    short: 'Sélectionnez des jours vides pour créer un élément.',
    text: 'Sélectionnez un ou plusieurs jours vides : un élément est créé sur ces dates.',
    target: '[data-tour="calendar-toolbar"]',
    noZone: true,
    side: 'top',
  },
};

export const help: HelpEntry = {
  title: 'Calendrier',
  summary: 'Les éléments datés sur un calendrier : mois, semaine ou liste.',
  short: 'Calendrier : mois, semaine ou liste',
  ...helpFromElements(elements),
  tour: [
    ...elementTourSteps('calendar', elements),
    ...SPACE_TOOLBAR_STEPS,
  ],
};
