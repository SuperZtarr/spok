/* Aide utilisateur de la vue « Calendrier » (calendar) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Calendrier',
  summary: 'Les éléments datés sur un calendrier : mois, semaine ou liste.',
  tips: [
    'Glissez un élément vers un autre jour pour le replanifier, tirez son bord pour changer sa durée',
    'Sélectionnez un ou plusieurs jours vides pour créer un élément sur ces dates',
    'Cliquez sur un élément pour ouvrir sa fiche',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Calendrier',
        description: 'Vos éléments datés posés sur le calendrier, avec les numéros de semaine.',
      },
    },
    {
      element: '.fc-header-toolbar',
      popover: {
        title: 'Navigation et affichage',
        description: 'Précédent / Suivant / Aujourd\'hui pour se déplacer ; Mois, Semaine ou Liste pour l\'affichage.',
        side: 'bottom',
      },
    },
    {
      element: '.fc-event',
      popover: {
        title: 'Un élément',
        description: 'Cliquez pour ouvrir sa fiche ; glissez-le vers un autre jour pour le replanifier ; tirez son bord pour changer sa durée.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="calendar-toolbar"]',
      popover: {
        title: 'Créer en sélectionnant',
        description: 'Sélectionnez un ou plusieurs jours vides : un élément est créé sur ces dates.',
        side: 'top',
      },
    },
    ...SPACE_TOOLBAR_STEPS,
  ],
};
