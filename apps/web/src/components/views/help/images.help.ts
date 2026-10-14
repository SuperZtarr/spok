/* Aide utilisateur de la vue « Images » (images) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton), le tour (useViewOnboarding) et les infobulles
   (hints : bouton d'import BulkUploadButton, zoom des vignettes dans ImagesView). */
import type { HelpEntry } from '../../../help/types';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Images',
  summary: 'La galerie d\'images de l\'espace, regroupées par élément parent.',
  short: 'Galerie d\'images',
  empty: 'Aucune image. Ajoutez une image à un élément pour la retrouver dans cette galerie.',
  tips: [
    'Cliquez sur une image pour l\'ouvrir en plein écran ; flèches pour naviguer, Échap pour fermer',
    'Double-cliquez pour ouvrir la fiche de l\'image',
    'Importez plusieurs images d\'un coup avec le bouton d\'import ou par glisser-déposer',
    'Réglez la taille des vignettes avec le curseur de zoom',
  ],
  hints: {
    bulkUpload: 'Importer des images : choisissez plusieurs fichiers, chacun devient un élément Image (ou glissez-les dans la vue)',
    zoomOut: 'Vignettes plus petites',
    zoomRange: 'Taille des vignettes',
    zoomIn: 'Vignettes plus grandes',
  },
  zones: {
    zoom: { title: 'Taille des vignettes', text: 'Réglez la taille d\'affichage de la galerie.' },
    vignette: { title: 'Une image', text: 'Cliquez pour l\'ouvrir en grand ; double-cliquez pour ouvrir sa fiche.' },
  },
  tour: [
    {
      popover: {
        title: 'Vue Images',
        description: 'Toutes les images de l\'espace en galerie, regroupées sous leur élément parent.',
      },
    },
    {
      element: '[data-tour="bulk-upload"]',
      popover: {
        title: 'Importer des images',
        description: 'Ajoutez plusieurs images d\'un coup — ou déposez-les directement sur la vue. Chaque image devient un élément Image (réduite automatiquement si elle est très grande).',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="images-zoom"]',
      popover: {
        title: 'Taille des vignettes',
        description: 'Agrandissez ou réduisez la galerie avec les loupes ou le curseur.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="images-tile"]',
      popover: {
        title: 'Une image',
        description: 'Un clic l\'ouvre en plein écran (flèches pour naviguer, Échap pour fermer). Un double-clic ouvre sa fiche. Glissez-la pour la ranger sous un autre élément.',
        side: 'right',
      },
    },
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};
