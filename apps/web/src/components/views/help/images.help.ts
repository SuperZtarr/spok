/* Aide utilisateur de la vue « Images » (images), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris
   par le « ? » (ViewHelpButton), le tour (useViewOnboarding), le mode Aide et les infobulles : hints.bulkUpload lu par
   BulkUploadButton (la clé de l'élément ne doit pas changer), détails du zoom lus par ImagesView.
   Contenus multiples (lot 3a, 2026-11-08) : une vignette par image portée, quel que soit le type de l'élément ;
   l'import crée un « Élément » par fichier ; annonce contents-view-images (sans date, datée à la MEP). */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  bulkUpload: {
    title: 'Importer des images',
    short: 'Importer des images : choisissez plusieurs fichiers, chacun devient un élément qui porte cette image (ou glissez-les dans la vue)',
    text: 'Ajoutez plusieurs images d\'un coup — ou déposez-les directement sur la vue. Chaque image crée un nouvel élément, titré du nom du fichier, qui la porte comme contenu (réduite automatiquement si elle est très grande). Rien d\'autre n\'est modifié.',
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
    text: 'Une vignette par image portée par un élément, quel que soit son type : un élément qui porte trois images apparaît trois fois. Un clic l\'ouvre en plein écran (flèches pour passer d\'une image à l\'autre, Échap pour fermer). Un double-clic ouvre la fiche de l\'élément. Glisser une vignette range tout l\'élément sous un autre parent, avec ses autres images.',
    target: '[data-tour="images-tile"]',
    side: 'right',
    changes: [{ id: 'contents-view-images', kind: 'evolution', text: 'La vue Images montre les images de tous les éléments, quel que soit leur type, une vignette par image.', date: '2026-11-11' }],
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Images',
  summary: 'Toutes les images portées par les éléments de l\'espace (et les schémas qui ont un aperçu), une vignette par image, regroupées par élément parent.',
  short: 'Galerie d\'images',
  empty: 'Aucune image. Ajoutez une image à n\'importe quel élément (zone Contenus de sa fiche) pour la retrouver dans cette galerie.',
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
