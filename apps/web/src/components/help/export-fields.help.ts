/* Aide utilisateur de la fenêtre « Champs à exporter » (ExportFieldsModal), écrite en éléments d'aide (help/elements.ts) :
   un texte par fonction, repris par le « ? » (PageHelpButton), le tour et le mode Aide (zones export-fields:*).
   Rappels (`hints`, via pageHint) écrits d'après hooks/useExportFields.ts et lib/exportUtils.ts : à revoir s'ils changent.
   Les champs ne sont pas énumérés ici : la fenêtre les affiche depuis le registre shared EXPORT_FIELD_REGISTRY.
   Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  selection: {
    title: 'Champs exportés',
    short: 'Cochez les champs à mettre en colonnes.',
    text: 'Cochez les champs à exporter : chacun devient une colonne du fichier. « Tout cocher » reprend tous les champs, « Rétablir par défaut » remet tous les champs dans l\'ordre d\'origine. Il faut au moins un champ coché. Les données sécurisées ne sont jamais exportées. Un champ apparu depuis votre dernier export arrive décoché en bas de la liste.',
    side: 'bottom',
    changes: [{
      id: 'export-fields-more',
      kind: 'evolution',
      text: 'L\'export propose aussi les références externes, les contenus (images, fichiers, liens, schémas), l\'auteur et l\'identifiant de chaque élément.',
      date: '2026-11-25',
    }],
  },
  ordre: {
    title: 'Ordre des colonnes',
    short: 'Glissez une ligne ou utilisez ↑ / ↓ pour ranger les colonnes.',
    text: 'L\'ordre de la liste est celui des colonnes du fichier. Glissez une ligne par sa poignée, ou utilisez les flèches ↑ / ↓ (aussi au clavier). Les champs décochés restent dans la liste, à leur place, pour pouvoir les reprendre.',
    target: '[data-tour="export-fields-list"]',
    side: 'right',
    changes: [{
      id: 'export-fields-choice',
      kind: 'new',
      text: 'À l\'export CSV, Excel ou PDF données, vous choisissez désormais les champs exportés et l\'ordre des colonnes ; le choix est gardé pour vous dans chaque espace.',
      date: '2026-11-18',
    }],
  },
  exporter: {
    title: 'Exporter',
    short: 'Télécharge le fichier avec les champs cochés, dans cet ordre.',
    text: 'Télécharge le fichier avec les champs cochés, dans l\'ordre de la liste, et retient ce choix pour vos prochains exports dans cet espace (CSV, Excel et PDF données partagent le même choix). Dans le PDF, une description longue est raccourcie pour garder le tableau lisible ; CSV et Excel la gardent entière.',
    target: '[data-tour="export-fields-confirm"]',
    side: 'top',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Champs à exporter',
  summary: 'Choisit les champs d\'un export de données (CSV, Excel, PDF données) et l\'ordre des colonnes.',
  ...derived,
  hints: {
    ...derived.hints,
    remembered: 'Votre choix est gardé pour vous dans cet espace (si vous en êtes membre) et vaut pour CSV, Excel et PDF données. Les « Données brutes » (JSON, XML) restent complètes.',
    reset: 'Coche tous les champs et les remet dans l\'ordre d\'origine.',
    noneChecked: 'Cochez au moins un champ pour exporter.',
    confirm: 'Télécharge le fichier avec les champs cochés, dans l\'ordre de la liste, et retient ce choix pour cet espace.',
  },
  tour: [
    {
      popover: {
        title: 'Champs à exporter',
        description: 'Choisissez les colonnes du fichier et leur ordre avant de le télécharger.',
      },
    },
    ...elementTourSteps('export-fields', elements),
  ],
};
