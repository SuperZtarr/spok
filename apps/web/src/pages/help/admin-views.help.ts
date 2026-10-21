/* Aide utilisateur de la page d'administration « Configuration des vues » (/admin/views, ViewsConfigPage).
   Lue par son point d'interrogation (PageHelpButton), son tour et ses rappels fonctionnels (hints, via pageHint).
   Les rappels décrivent l'effet réel : surcharges AppConfig 'menu_overrides' (routes/admin/menu.ts) lues par
   useMenuItems — à revérifier à chaque évolution de ces deux fichiers. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Configuration des vues',
  summary: 'Qui voit quelles pages globales et quelles vues d\'espace, pour tout SPOK : masquer une entrée, ou changer qui y a accès.',
  tips: [
    'Chaque ligne part du réglage du code ; une ligne modifiée porte la mention « modifié » et le réglage d\'origine',
    'Accès : Tous (visiteurs compris), Connectés, ou Admins (seulement en mode admin)',
    'Les modes Forum, Projet et JDR rangent ensuite les vues accessibles (boutons directs ou « Autres vues ») ; ils ne rendent jamais une vue accessible',
    'Les lecteurs d\'un espace restent limités à leurs vues (Présentation, Liste, Kanban, Gantt, Carte mentale)',
    'Rien ne change avant « Enregistrer » ; « Tout réinitialiser » revient au réglage du code',
  ],
  tour: [
    {
      popover: {
        title: 'Configuration des vues',
        description: 'Décidez, pour tout SPOK, quelles entrées sont proposées et à qui.',
      },
    },
    {
      element: '[data-tour="admin-views-tabs"]',
      popover: {
        title: 'Pages ou vues',
        description: 'Les pages de la navigation globale, ou les vues d\'un espace.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="admin-views-list"]',
      popover: {
        title: 'Une entrée par ligne',
        description: 'Œil : visible ou masquée. Liste : qui y a accès. « modifié » : différent du réglage du code.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="admin-views-save"]',
      popover: {
        title: 'Enregistrer',
        description: 'Applique les changements à tous les utilisateurs.',
        side: 'left',
      },
    },
  ],
  hints: {
    intro: 'Ces réglages s\'appliquent à tout SPOK, pour tous les utilisateurs, dès l\'enregistrement. Le mode d\'interface (Forum, Projet, JDR) range ensuite les vues accessibles ; il ne donne jamais accès à une vue masquée ou réservée.',
    visible: 'Visible / masquée : une entrée masquée n\'apparaît plus dans les menus ni dans le sélecteur de vues, pour personne.',
    access: 'Qui voit cette entrée : Tous (y compris les visiteurs non connectés des espaces publics), Connectés (tout utilisateur connecté), Admins (seulement les administrateurs, en mode admin).',
    modified: 'Réglage modifié par rapport au code',
    resetRow: 'Revenir au réglage du code pour cette entrée (prend effet à l\'enregistrement).',
    resetAll: 'Tout réinitialiser : remet toutes les entrées au réglage du code. Rien n\'est enregistré tant que vous ne cliquez pas sur « Enregistrer ».',
    save: 'Enregistrer : les changements s\'appliquent à tous les utilisateurs, au plus tard 5 minutes après (ou dès qu\'ils rechargent la page).',
  },
};
