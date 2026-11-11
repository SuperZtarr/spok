/* Aide utilisateur de la vue « Documents » (documents), écrite en éléments d'aide (help/elements.ts) : un texte par fonction,
   repris par le « ? » (ViewHelpButton), le tour (useViewOnboarding), le mode Aide et l'infobulle du bouton d'import
   (hints.bulkUpload, lu par BulkUploadButton : la clé `bulkUpload` de l'élément ne doit pas changer).
   Contenus multiples (lot 3a, 2026-11-08) : une carte par fichier porté, quel que soit le type de l'élément ; l'import
   crée un « Élément » par fichier ; annonce contents-view-documents (sans date, datée à la MEP).
   Aperçu des fichiers (2026-11-11) : texte de `ligne` complété ; l'annonce est portée par item-contents (file-preview). */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  bulkUpload: {
    title: 'Importer des fichiers',
    short: 'Importer des documents : choisissez plusieurs fichiers, chacun devient un élément qui porte ce fichier (ou glissez-les dans la vue)',
    text: 'Ajoutez plusieurs fichiers d\'un coup — ou déposez-les directement sur la vue. Chaque fichier crée un nouvel élément, titré du nom du fichier, qui le porte comme contenu. Rien d\'autre n\'est modifié.',
    target: '[data-tour="bulk-upload"]',
    noZone: true,
    side: 'bottom',
  },
  groupe: {
    title: 'Groupe',
    short: 'Les fichiers des éléments rangés sous un même parent.',
    text: 'Les fichiers des éléments rangés sous un même élément parent ; cliquez sur l\'en-tête pour ouvrir ce parent.',
    side: 'bottom',
  },
  ligne: {
    title: 'Un fichier',
    short: 'Cliquez pour ouvrir la fiche de l\'élément.',
    text: 'Une carte par fichier porté par un élément, quel que soit son type : un élément qui porte trois fichiers apparaît trois fois, avec le nom de chaque fichier après son titre. Le format du fichier est indiqué ; un PDF, un document Office ou un fichier texte montre en haut de la carte sa première page ou le début de son texte. Cliquez pour ouvrir la fiche de l\'élément ; au survol apparaissent le téléchargement de ce fichier et le menu d\'actions de l\'élément. Glisser une carte range tout l\'élément sous un autre parent, avec ses autres fichiers.',
    target: '[data-tour="documents-row"]',
    side: 'bottom',
    changes: [{ id: 'contents-view-documents', kind: 'evolution', text: 'La vue Documents montre les fichiers de tous les éléments, quel que soit leur type, une carte par fichier.', date: '2026-11-11' }],
  },
};

export const help: HelpEntry = {
  title: 'Documents',
  summary: 'Tous les fichiers portés par les éléments de l\'espace, une carte par fichier, regroupés par élément parent, avec le format de chaque fichier.',
  short: 'Fichiers et documents',
  empty: 'Aucun fichier. Joignez un fichier à n\'importe quel élément (zone Contenus de sa fiche) pour le retrouver ici.',
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
