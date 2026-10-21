/* Aide utilisateur de la page d'administration « Audit » (/admin/audit-logs, AuditLogsPage).
   Lue par son point d'interrogation (PageHelpButton), son tour et ses rappels fonctionnels (hints, via pageHint :
   infobulles des actions à effet, explication des blocs de décision) — registre help/pageHelp.ts.
   Les rappels décrivent l'effet réel côté API : à revérifier à chaque évolution des routes /admin. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Audit',
  summary: 'Le journal de toutes les modifications de SPOK (créations, modifications, déplacements, suppressions), avec restauration.',
  tips: [
    'Une suppression se restaure ligne par ligne, ou par opération entière (« Restaurer le batch »)',
    'Une modification se défait champ par champ',
    'Les purges effacent définitivement l\'historique : il ne pourra plus servir à restaurer',
  ],
  tour: [
    {
      popover: {
        title: 'Audit',
        description: 'Qui a fait quoi, quand — et comment revenir en arrière.',
      },
    },
    {
      element: '[data-tour="admin-audit-maintenance"]',
      popover: {
        title: 'Maintenance',
        description: 'Purger les entrées anciennes ou en trop. Irréversible.',
        side: 'left',
      },
    },
    {
      element: '[data-tour="admin-audit-list"]',
      popover: {
        title: 'Le journal',
        description: 'Les entrées, regroupées par opération ; restaurez depuis chaque ligne.',
        side: 'top',
      },
    },
  ],
  hints: {
    purge: 'Purger : supprime définitivement les entrées plus anciennes que le nombre de jours indiqué. Irréversible — elles ne pourront plus servir à restaurer.',
    purgeOverflow: 'Purger l\'excédent : garde les entrées les plus récentes jusqu\'au seuil et supprime définitivement les autres. Irréversible.',
    restore: 'Restaurer : recrée l\'élément, l\'espace ou la communauté supprimé à partir de cette entrée.',
    restoreUpdate: 'Restaurer : choisir les champs à remettre à leur valeur d\'avant cette modification.',
    restoreBatch: 'Restaurer le batch : recrée toutes les suppressions de cette opération (ex. un espace et ses éléments), communautés puis espaces puis éléments.',
  },
};
