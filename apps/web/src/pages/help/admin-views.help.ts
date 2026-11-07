/* Aide utilisateur de la page d'administration « Configuration des vues » (/admin/views, ViewsConfigPage), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris
   par le « ? » (PageHelpButton), le tour et le mode Aide. Rappels fonctionnels (hints, via pageHint ; clé save portée par son élément) décrivant l'effet réel : surcharges
   AppConfig 'menu_overrides' (routes/admin/menu.ts) lues par useMenuItems — à revérifier à chaque évolution de ces deux fichiers. Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  onglets: {
    title: 'Pages ou vues',
    short: 'Pages de la navigation globale, ou vues d\'un espace.',
    text: 'Les pages de la navigation globale, ou les vues d\'un espace. Les modes Forum, Projet et Loisirs rangent ensuite les vues accessibles (boutons directs ou « Autres vues ») ; ils ne rendent jamais une vue accessible.',
    target: '[data-tour="admin-views-tabs"]',
    side: 'bottom',
  },
  liste: {
    title: 'Une entrée par ligne',
    short: 'Visibilité et accès de chaque entrée.',
    text: 'Œil : visible ou masquée. Liste : qui y a accès, soit Tous (visiteurs compris), Connectés, ou Admins (seulement en mode admin). Chaque ligne part du réglage du code ; une ligne modifiée porte la mention « modifié » et le réglage d\'origine.',
    target: '[data-tour="admin-views-list"]',
    side: 'top',
  },
  save: {
    title: 'Enregistrer',
    short: 'Enregistrer : les changements s\'appliquent à tous les utilisateurs, au plus tard 5 minutes après (ou dès qu\'ils rechargent la page).',
    text: 'Applique les changements à tous les utilisateurs. Rien ne change avant « Enregistrer » ; « Tout réinitialiser » revient au réglage du code.',
    target: '[data-tour="admin-views-save"]',
    noZone: true,
    side: 'left',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Configuration des vues',
  summary: 'Qui voit quelles pages globales et quelles vues d\'espace, pour tout SPOK : masquer une entrée, ou changer qui y a accès.',
  ...derived,
  hints: {
    ...derived.hints,
    intro: 'Ces réglages s\'appliquent à tout SPOK, pour tous les utilisateurs, dès l\'enregistrement. Le mode d\'interface (Forum, Projet, Loisirs) range ensuite les vues accessibles ; il ne donne jamais accès à une vue masquée ou réservée.',
    visible: 'Visible / masquée : une entrée masquée n\'apparaît plus dans les menus ni dans le sélecteur de vues, pour personne.',
    access: 'Qui voit cette entrée : Tous (y compris les visiteurs non connectés des espaces publics), Connectés (tout utilisateur connecté), Admins (seulement les administrateurs, en mode admin).',
    modified: 'Réglage modifié par rapport au code',
    resetRow: 'Revenir au réglage du code pour cette entrée (prend effet à l\'enregistrement).',
    resetAll: 'Tout réinitialiser : remet toutes les entrées au réglage du code. Rien n\'est enregistré tant que vous ne cliquez pas sur « Enregistrer ».',
  },
  tour: [
    {
      popover: {
        title: 'Configuration des vues',
        description: 'Décidez, pour tout SPOK, quelles entrées sont proposées et à qui.',
      },
    },
    ...elementTourSteps('admin-views', elements),
  ],
};
