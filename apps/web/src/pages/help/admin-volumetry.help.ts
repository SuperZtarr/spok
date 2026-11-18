/* Aide utilisateur de la page d'administration « Volumétrie » (/admin/volumetry, VolumetryPage, 2026-11-18), écrite en
   éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? » (PageHelpButton), le tour et le mode
   Aide. Les seuils cités viennent du registre @spok/shared volumetry.ts (describeVolumetryThresholds), jamais recopiés.
   Rappels fonctionnels (hints, via pageHint) : effet réel côté API, à revérifier si GET /admin/volumetry évolue.
   Registre help/pageHelp.ts. */
import { describeVolumetryThresholds, VOLUMETRY_WATCH_INTERVAL_HOURS } from '@spok/shared';
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  base: {
    title: 'Base entière',
    short: 'Le poids total de la base de données.',
    text: 'Le poids total de la base de données sur le disque, comparé à son seuil.',
    target: '[data-tour="admin-volumetry-database"]',
    side: 'bottom',
  },
  tables: {
    title: 'Tables',
    short: 'Lignes, taille et croissance de chaque table.',
    text: `Chaque table : nombre de lignes, taille sur le disque (index compris), lignes ajoutées sur 7 et 30 jours, et son état face au seuil. Les tables qui dépassent leur seuil sont en tête. Toutes les ${VOLUMETRY_WATCH_INTERVAL_HOURS} heures, SPOK refait la mesure et notifie les administrateurs pour chaque seuil dépassé, une seule fois tant que la notification n'est pas lue. Rien n'est jamais effacé automatiquement. Seuils : ${describeVolumetryThresholds()}`,
    target: '[data-tour="admin-volumetry-tables"]',
    side: 'top',
    changes: [{
      id: 'admin-volumetry-2026-11',
      kind: 'new',
      text: 'Nouvelle page Volumétrie : la taille et la croissance de chaque table, avec une notification aux administrateurs quand un seuil est dépassé.',
      date: '2026-11-18',
    }],
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Volumétrie',
  summary: 'Ce que pèsent les données, table par table, et celles qui grossissent trop.',
  ...derived,
  hints: {
    ...derived.hints,
    refresh: 'Mesurer : relit la taille et le nombre de lignes de chaque table. Rien n\'est modifié.',
    purge: 'Purger : ouvre la page où cette table se purge à la main. Rien n\'est effacé tant que vous n\'y lancez pas la purge.',
  },
  tour: [
    {
      popover: {
        title: 'Volumétrie',
        description: 'Repérer les données qui gonflent avant qu\'elles ne pèsent.',
      },
    },
    ...elementTourSteps('admin-volumetry', elements),
  ],
};
