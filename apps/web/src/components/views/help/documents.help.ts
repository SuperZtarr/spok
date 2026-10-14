/* Aide utilisateur de la vue « Documents » (documents) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton), le tour (useViewOnboarding) et l'infobulle du
   bouton d'import (hints.bulkUpload, lu par BulkUploadButton). */
import type { HelpEntry } from '../../../help/types';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Documents',
  summary: 'Les documents (fichiers) de l\'espace, regroupés par élément parent, avec le type de chaque fichier.',
  short: 'Fichiers et documents',
  empty: 'Aucun document. Créez un élément de type Document pour le retrouver ici.',
  tips: [
    'Cliquez sur un document pour ouvrir sa fiche',
    'Le bouton de téléchargement apparaît au survol',
    'Importez plusieurs fichiers d\'un coup avec le bouton d\'import ou par glisser-déposer : un élément par fichier',
  ],
  hints: {
    bulkUpload: 'Importer des documents : choisissez plusieurs fichiers, chacun devient un élément Document (ou glissez-les dans la vue)',
  },
  zones: {
    groupe: { title: 'Groupe', text: 'Les documents rangés sous un même élément parent ; cliquez sur l\'en-tête pour ouvrir ce parent.' },
    ligne: { title: 'Un document', text: 'Son type et son nom ; cliquez pour ouvrir sa fiche, le téléchargement apparaît au survol.' },
  },
  tour: [
    {
      popover: {
        title: 'Vue Documents',
        description: 'Les fichiers de l\'espace — PDF, textes, tableurs… — regroupés sous leur élément parent.',
      },
    },
    {
      element: '[data-tour="bulk-upload"]',
      popover: {
        title: 'Importer des fichiers',
        description: 'Ajoutez plusieurs fichiers d\'un coup — ou déposez-les directement sur la vue. Chaque fichier devient un élément Document.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="documents-row"]',
      popover: {
        title: 'Un document',
        description: 'Cliquez pour ouvrir sa fiche. Au survol apparaissent le téléchargement et le menu d\'actions. Glissez-le pour le ranger sous un autre élément.',
        side: 'bottom',
      },
    },
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};
