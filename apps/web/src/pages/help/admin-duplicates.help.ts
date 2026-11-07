/* Aide utilisateur de la page d'administration « Doublons » (/admin/duplicates, DuplicatesPage), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (PageHelpButton), le tour et le mode Aide. Rappels fonctionnels (hints, via pageHint ; clé refresh portée par son élément) décrivant l'effet réel côté API :
   à revérifier à chaque évolution des routes /admin. Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  criteres: {
    title: 'Critères',
    short: 'Titre, adresse ou nom de fichier identique.',
    text: 'Un onglet par critère : titre, adresse ou nom de fichier identique. Les éléments d\'un même groupe sont côte à côte ; ouvrez-les pour comparer avant de supprimer. La suppression demande une confirmation et reste restaurable depuis la page Audit.',
    target: '[data-tour="admin-duplicates-tabs"]',
    side: 'bottom',
  },
  refresh: {
    title: 'Actualiser',
    short: 'Recalcule la liste des doublons (lecture seule).',
    text: 'Recalcule la liste des doublons.',
    target: '[data-tour="admin-duplicates-refresh"]',
    noZone: true,
    side: 'left',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Doublons',
  summary: 'Les éléments en double dans tout SPOK : même titre, même adresse (liens) ou même nom de fichier.',
  ...derived,
  hints: {
    ...derived.hints,
    open: 'Ouvre l\'élément dans son espace, dans un nouvel onglet.',
    delete: 'Supprimer cet élément (une confirmation suit) : même effet que depuis son espace — tracé et restaurable depuis la page Audit.',
  },
  tour: [
    {
      popover: {
        title: 'Doublons',
        description: 'Les contenus saisis ou copiés plusieurs fois.',
      },
    },
    ...elementTourSteps('admin-duplicates', elements),
  ],
};
