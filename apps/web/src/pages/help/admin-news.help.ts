/* Aide utilisateur de la page d'administration « Publication des nouveautés » (/admin/news, NewsAdminPage), écrite en éléments d'aide
   (help/elements.ts) : un texte par fonction, repris par le « ? » (PageHelpButton), le tour et le mode Aide. Rappels fonctionnels (hints, via
   pageHint) décrivant l'effet réel : surcharges AppConfig 'news_overrides' (routes/admin/news.ts) appliquées par help/announcements.ts
   (applyOverrides) — à revérifier à chaque évolution de ces deux fichiers. Pas d'annonce : les annonces ne sont pas filtrées par rôle,
   celle d'une page d'administration s'afficherait à tous. Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  liste: {
    title: 'Une annonce par ligne',
    short: 'Chaque nouveauté écrite dans SPOK, avec sa publication.',
    text: 'Chaque nouveauté ou évolution, les plus récentes d\'abord : écran concerné, type, texte, et la date posée à la mise en production. Une ligne réglée porte la mention « modifié » ; son état (publiée, masquée, programmée) se lit à droite.',
    target: '[data-tour="admin-news-list"]',
    side: 'top',
  },
  reglages: {
    title: 'Masquer ou dater',
    short: 'Masquer une annonce, corriger sa date ou la programmer.',
    text: 'L\'œil masque l\'annonce ou la republie. La date remplace celle de la mise en production : une date passée la reclasse dans l\'historique, une date future la programme, elle n\'apparaît qu\'à partir de ce jour. Date vide : celle de la mise en production.',
    target: '[data-tour="admin-news-row"]',
    side: 'bottom',
  },
  save: {
    title: 'Enregistrer',
    short: 'Enregistrer : les réglages s\'appliquent à tous les utilisateurs.',
    text: 'Applique les réglages à tous les utilisateurs, à leur prochain chargement de page. Rien ne change avant « Enregistrer » ; « Tout réinitialiser » revient aux annonces du code.',
    target: '[data-tour="admin-news-save"]',
    noZone: true,
    side: 'left',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Publication des nouveautés',
  route: '/admin/news',
  summary: 'Décider quelles nouveautés sont annoncées et à partir de quand : masquer une annonce, corriger sa date ou la programmer.',
  empty: 'Aucune nouveauté écrite pour le moment.',
  ...derived,
  hints: {
    ...derived.hints,
    intro: 'Les textes des annonces viennent du code ; ici on décide seulement si elles sont publiées et à quelle date, pour tous les utilisateurs. Une annonce masquée ou programmée disparaît de l\'accueil, des zones allumées, du tutoriel et de la page Nouveautés.',
    hide: 'Masquer : l\'annonce n\'est plus montrée à personne (accueil, zone allumée, tutoriel, page Nouveautés). Republier la remet en place ; ce que chacun a déjà noté reste noté. Prend effet à l\'enregistrement.',
    date: 'Date de publication, qui remplace celle de la mise en production. Future : l\'annonce n\'apparaît qu\'à partir de ce jour. Vide : date de la mise en production. Prend effet à l\'enregistrement.',
    modified: 'Réglée ici, différente du code',
    resetRow: 'Revenir à l\'annonce du code pour cette ligne : publiée, à la date de mise en production (prend effet à l\'enregistrement).',
    resetAll: 'Tout réinitialiser : retire tous les réglages, chaque annonce redevient celle du code. Rien n\'est enregistré tant que vous ne cliquez pas sur « Enregistrer ».',
    pending: 'Pas encore mise en production : elle sera datée automatiquement à la prochaine mise en production. Visible seulement en développement local.',
  },
  tour: [
    {
      popover: {
        title: 'Publication des nouveautés',
        description: 'Décidez quelles nouveautés sont annoncées, et à partir de quand.',
      },
    },
    ...elementTourSteps('admin-news', elements),
  ],
};
