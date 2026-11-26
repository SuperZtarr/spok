/* Aide utilisateur de la page d'administration « Volumétrie » (/admin/volumetry, VolumetryPage, 2026-11-18), écrite en
   éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? » (PageHelpButton), le tour et le mode
   Aide. Les seuils cités viennent du registre @spok/shared volumetry.ts (describeVolumetryThresholds), jamais recopiés.
   Rappels fonctionnels (hints, via pageHint) : effet réel côté API, à revérifier si GET /admin/volumetry évolue.
   Registre help/pageHelp.ts. Rubrique Stockage (2026-11-26) : éléments storage, trash, orphans ; délai, motifs et seuil
   viennent du registre @spok/shared storageTrash.ts / volumetry.ts. */
import {
  describeVolumetryThresholds, VOLUMETRY_WATCH_INTERVAL_HOURS, VOLUMETRY_STORAGE_MAX_MB, STORAGE_TRASH_GRACE_DAYS,
  STORAGE_TRASH_REASONS, STORAGE_ORPHAN_MIN_AGE_HOURS,
} from '@spok/shared';
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
  storage: {
    title: 'Stockage de fichiers',
    short: 'Ce que pèsent les fichiers des éléments.',
    text: `Le volume des images et fichiers des éléments dans le stockage, et celui de la corbeille, comparés au seuil de ${VOLUMETRY_STORAGE_MAX_MB.toLocaleString('fr-FR')} Mo. Au-delà, les administrateurs sont notifiés comme pour une table.`,
    target: '[data-tour="admin-volumetry-storage"]',
    side: 'bottom',
    changes: [{
      id: 'admin-volumetry-storage-2026-11',
      kind: 'new',
      text: 'Rubrique Stockage de fichiers : le volume des fichiers, la corbeille et la recherche des fichiers orphelins.',
      date: '2026-11-26',
    }],
  },
  trash: {
    title: 'Corbeille',
    short: 'Fichiers que plus rien n\'utilise, gardés avant effacement.',
    text: `Quand un élément, un espace ou un contenu est supprimé, ou un doublon écarté par une fusion, ses fichiers que plus rien n'utilise arrivent ici. Leur adresse ne répond plus, mais ils sont gardés ${STORAGE_TRASH_GRACE_DAYS} jours : restaurer l'élément depuis l'historique les remet en place. Passé ce délai, SPOK les efface. Motifs : ${STORAGE_TRASH_REASONS.map((r) => r.label).join(', ')}.`,
    target: '[data-tour="admin-volumetry-trash"]',
    side: 'top',
  },
  orphans: {
    title: 'Orphelins',
    short: 'Fichiers encore en ligne que plus rien n\'utilise.',
    text: `Fichiers d'éléments toujours accessibles à leur adresse alors qu'aucun élément ne s'en sert : supprimés avant l'existence de la corbeille, ou échappés. La recherche lit tout le stockage, seulement quand vous la lancez ; un fichier envoyé depuis moins de ${STORAGE_ORPHAN_MIN_AGE_HOURS} h n'est jamais compté. Les mettre à la corbeille coupe leur adresse et les efface après ${STORAGE_TRASH_GRACE_DAYS} jours.`,
    target: '[data-tour="admin-volumetry-orphans"]',
    side: 'top',
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
    'purge-trash': 'Effacer maintenant : efface définitivement les fichiers cochés, sans attendre la fin du délai. Un élément restauré ensuite reviendra sans eux. Irréversible.',
    'search-orphans': 'Rechercher : compare tout le stockage aux éléments pour lister les fichiers que plus rien n\'utilise. Rien n\'est modifié.',
    'trash-orphans': `Mettre à la corbeille : les fichiers cochés cessent aussitôt d'être accessibles à leur adresse et sont effacés dans ${STORAGE_TRASH_GRACE_DAYS} jours. Chacun est revérifié avant : un fichier redevenu utilisé reste en place.`,
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
