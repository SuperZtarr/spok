/* Aide utilisateur de la vue « Documents » (documents), écrite en éléments d'aide (help/elements.ts) : un texte par fonction,
   repris par le « ? » (ViewHelpButton), le tour (useViewOnboarding), le mode Aide et l'infobulle du bouton d'import
   (hints.bulkUpload, lu par BulkUploadButton : la clé `bulkUpload` de l'élément ne doit pas changer). */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  bulkUpload: {
    title: 'Importer des fichiers',
    short: 'Importer des documents : choisissez plusieurs fichiers, chacun devient un élément Document (ou glissez-les dans la vue)',
    text: 'Ajoutez plusieurs fichiers d\'un coup — ou déposez-les directement sur la vue. Chaque fichier devient un élément Document.',
    target: '[data-tour="bulk-upload"]',
    noZone: true,
    side: 'bottom',
  },
  groupe: {
    title: 'Groupe',
    short: 'Les documents rangés sous un même parent.',
    text: 'Les documents rangés sous un même élément parent ; cliquez sur l\'en-tête pour ouvrir ce parent.',
    side: 'bottom',
  },
  ligne: {
    title: 'Un document',
    short: 'Cliquez pour ouvrir sa fiche.',
    text: 'Son type et son nom. Cliquez pour ouvrir sa fiche ; au survol apparaissent le téléchargement et le menu d\'actions. Glissez-le pour le ranger sous un autre élément.',
    target: '[data-tour="documents-row"]',
    side: 'bottom',
  },
};

export const help: HelpEntry = {
  title: 'Documents',
  summary: 'Les documents (fichiers) de l\'espace, regroupés par élément parent, avec le type de chaque fichier.',
  short: 'Fichiers et documents',
  empty: 'Aucun document. Créez un élément de type Document pour le retrouver ici.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Vue Documents',
        description: 'Les fichiers de l\'espace — PDF, textes, tableurs… — regroupés sous leur élément parent.',
      },
    },
    ...elementTourSteps('documents', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};
