/* Aide utilisateur de la fenêtre « Importer des données » (RawImportModal, onglet Espaces des paramètres de la communauté),
   écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? » (PageHelpButton), le tour, le
   mode Aide et les rappels (pageHint : clé confirm, à ne pas renommer). Rappels écrits d'après
   apps/api/src/utils/rawExport.ts (importRawDocument) : à revoir si l'import change. Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  fichier: {
    title: 'Fichier',
    short: 'Choisissez un fichier « Données brutes » (JSON ou XML).',
    text: 'Un fichier produit par Exporter → Données brutes, dans cette instance de SPOK ou une autre (locale, production), ou écrit par un autre outil au même format. Le fichier est lu et contrôlé tout de suite : rien n\'est créé avant de cliquer sur Importer.',
    target: '[data-tour="raw-import-file"]',
    side: 'bottom',
  },
  destination: {
    title: 'Destination',
    short: 'Où arrive l\'espace importé : à la racine de la communauté ou sous un espace.',
    text: 'L\'espace racine du fichier arrive à cet endroit, avec tous ses sous-espaces. Sous un espace, il faut pouvoir y écrire. Les tags sont rapprochés par nom de ceux déjà proposés à cet endroit.',
    target: '[data-tour="raw-import-destination"]',
    side: 'bottom',
  },
  apercu: {
    title: 'Aperçu',
    short: 'Ce qui sera créé, ce qui sera laissé de côté.',
    text: 'Nombre d\'espaces, d\'éléments, de contenus, de relations et de contributions qui seront créés. Sont aussi listées les références vers des éléments absents du fichier (abandonnées) et les personnes sans compte ici : leurs éléments et contributions seront à votre nom, et un assigné sans compte devient un assigné en saisie libre (son nom). Les personnes sont reconnues par leur e-mail parmi les membres de cette communauté seulement ; l\'e-mail n\'est dans le fichier que si l\'export a été fait par un propriétaire.',
    target: '[data-tour="raw-import-preview"]',
    side: 'top',
  },
  confirm: {
    title: 'Importer',
    short: 'Crée une COPIE des données du fichier : nouveaux espaces dont vous êtes propriétaire, nouveaux éléments. Rien d\'existant n\'est modifié ni écrasé ; images et fichiers sont recopiés. Pour annuler, supprimez l\'espace importé.',
    text: 'Crée tout en une fois (tout ou rien) : espaces, éléments avec leur hiérarchie, tags, références externes, contenus, questions, articles, process, relations et contributions. Les données sécurisées ne voyagent jamais. Les images et fichiers stockés dans SPOK sont recopiés : supprimer la copie ne touche jamais l\'original.',
    target: '[data-tour="raw-import-confirm"]',
    noZone: true,
    side: 'top',
  },
};

export const help: HelpEntry = {
  title: 'Importer des données',
  summary: 'Recrée dans cette communauté un espace exporté en « Données brutes » (JSON ou XML), avec ses sous-espaces : une copie, sans lien avec l\'original.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Importer des données',
        description: 'Choisissez un fichier, vérifiez l\'aperçu, puis importez : rien n\'est créé avant.',
      },
    },
    ...elementTourSteps('raw-import', elements),
  ],
};
