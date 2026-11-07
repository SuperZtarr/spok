/* Aide utilisateur de la page d'administration « Audit » (/admin/audit-logs, AuditLogsPage), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le
   « ? » (PageHelpButton), le tour et le mode Aide. Rappels fonctionnels (hints, via pageHint) décrivant l'effet réel côté API : à revérifier à chaque évolution des routes
   /admin. Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  maintenance: {
    title: 'Maintenance',
    short: 'Purger les entrées anciennes ou en trop.',
    text: 'Purger les entrées anciennes ou en trop. Irréversible : l\'historique effacé ne pourra plus servir à restaurer.',
    target: '[data-tour="admin-audit-maintenance"]',
    side: 'left',
  },
  journal: {
    title: 'Le journal',
    short: 'Les entrées, regroupées par opération.',
    text: 'Les entrées, regroupées par opération. Une suppression se restaure ligne par ligne, ou par opération entière (« Restaurer le batch ») ; une modification se défait champ par champ.',
    target: '[data-tour="admin-audit-list"]',
    side: 'top',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Audit',
  summary: 'Le journal de toutes les modifications de SPOK (créations, modifications, déplacements, suppressions), avec restauration.',
  ...derived,
  hints: {
    ...derived.hints,
    purge: 'Purger : supprime définitivement les entrées plus anciennes que le nombre de jours indiqué. Irréversible — elles ne pourront plus servir à restaurer.',
    purgeOverflow: 'Purger l\'excédent : garde les entrées les plus récentes jusqu\'au seuil et supprime définitivement les autres. Irréversible.',
    restore: 'Restaurer : recrée l\'élément, l\'espace ou la communauté supprimé à partir de cette entrée.',
    restoreUpdate: 'Restaurer : choisir les champs à remettre à leur valeur d\'avant cette modification.',
    restoreBatch: 'Restaurer le batch : recrée toutes les suppressions de cette opération (ex. un espace et ses éléments), communautés puis espaces puis éléments.',
  },
  tour: [
    {
      popover: {
        title: 'Audit',
        description: 'Qui a fait quoi, quand — et comment revenir en arrière.',
      },
    },
    ...elementTourSteps('admin-audit', elements),
  ],
};
