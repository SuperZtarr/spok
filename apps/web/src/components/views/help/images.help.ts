/* Aide utilisateur de la vue « Images » (images), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris
   par le « ? » (ViewHelpButton), le tour (useViewOnboarding), le mode Aide et les infobulles : hints.bulkUpload lu par
   BulkUploadButton (la clé de l'élément ne doit pas changer), détails du zoom lus par ImagesView. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  bulkUpload: {
    title: 'Importer des images',
    short: 'Importer des images : choisissez plusieurs fichiers, chacun devient un élément Image (ou glissez-les dans la vue)',
    text: 'Ajoutez plusieurs images d\'un coup — ou déposez-les directement sur la vue. Chaque image devient un élément Image (réduite automatiquement si elle est très grande).',
    target: '[data-tour="bulk-upload"]',
    noZone: true,
    side: 'bottom',
  },
  zoom: {
    title: 'Taille des vignettes',
    short: 'Taille des vignettes',
    text: 'Agrandissez ou réduisez la galerie avec les loupes ou le curseur.',
    target: '[data-tour="images-zoom"]',
    side: 'bottom',
  },
  vignette: {
    title: 'Une image',
    short: 'Cliquez pour l\'ouvrir en grand.',
    text: 'Un clic l\'ouvre en plein écran (flèches pour naviguer, Échap pour fermer). Un double-clic ouvre sa fiche. Glissez-la pour la ranger sous un autre élément.',
    target: '[data-tour="images-tile"]',
    side: 'right',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Images',
  summary: 'La galerie d\'images de l\'espace, regroupées par élément parent.',
  short: 'Galerie d\'images',
  empty: 'Aucune image. Ajoutez une image à un élément pour la retrouver dans cette galerie.',
  ...derived,
  hints: {
    ...derived.hints,
    zoomOut: 'Vignettes plus petites',
    zoomRange: 'Taille des vignettes',
    zoomIn: 'Vignettes plus grandes',
  },
  tour: [
    {
      popover: {
        title: 'Vue Images',
        description: 'Toutes les images de l\'espace en galerie, regroupées sous leur élément parent.',
      },
    },
    ...elementTourSteps('images', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};
