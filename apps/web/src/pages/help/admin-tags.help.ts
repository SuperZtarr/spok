/* Aide utilisateur de la page d'administration « Tags » (/admin/tags, TagsPage), écrite en éléments d'aide
   (help/elements.ts) : un texte par fonction, repris par le « ? » (PageHelpButton), le tour et le mode Aide.
   Rappels fonctionnels (hints, via pageHint) décrivant l'effet réel côté API (apps/api/src/routes/admin/tags.ts) :
   à revérifier à chaque évolution de ces routes. duplicatesIntro : phrase visible sous l'onglet Doublons (bloc de
   décision). Registre help/pageHelp.ts. Annonce `admin-tags-grouped` (liste rangée par portée, 2026-11-13) sans date,
   datée par la session MEP. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  onglets: {
    title: 'Tous / Doublons',
    short: 'Liste des tags ou tags en double.',
    text: '« Tous les tags » liste chaque tag avec sa portée : global (proposé dans tous les espaces), communauté (proposé dans les espaces de cette communauté) ou espace (proposé dans cet espace et ses sous-espaces). « Doublons » regroupe les tags de même nom, majuscules comprises.',
    changes: [{ id: 'admin-tags-page', kind: 'new', text: 'Nouvelle page d\'administration Tags : tags globaux, proposés dans tous les espaces, et fusion des tags en double entre communautés.', date: '2026-11-11' }],
    target: '[data-tour="admin-tags-tabs"]',
    side: 'bottom',
  },
  creer: {
    title: 'Tag global',
    short: 'Crée un tag proposé dans tous les espaces.',
    text: 'Un tag global est proposé dans le sélecteur de tags de tous les espaces, y compris ceux sans communauté. Seul un admin le crée, le renomme ou le supprime. Le nom doit être unique parmi les tags globaux.',
    target: '[data-tour="admin-tags-create"]',
    side: 'bottom',
  },
  liste: {
    title: 'Tags',
    short: 'Renommer, recolorer, rendre global, supprimer.',
    text: 'Les tags sont rangés par portée : Globaux, Communautés (un intertitre par communauté), Espaces (un intertitre par espace), avec leur nombre. Filtrez par portée ou par nom. Pour chaque tag : nombre d\'éléments qui le portent, renommer ou changer la couleur, « Rendre global » (un tag de communauté ou d\'espace devient proposé partout), supprimer. Un tag « Espace » est créé depuis la fiche d\'un élément : il est proposé dans son espace et tous ses sous-espaces.',
    changes: [
      { id: 'admin-tags-space-scope', kind: 'evolution', text: 'Les tags d\'espace sont de retour : la liste les montre avec leur espace, et le filtre Portée propose « Espaces ».', date: '2026-11-12' },
      { id: 'admin-tags-grouped', kind: 'evolution', text: 'La liste des tags est rangée par portée : Globaux, puis une rubrique par communauté et par espace, avec leur nombre.', date: '2026-11-13' },
    ],
    target: '[data-tour="admin-tags-list"]',
    side: 'top',
  },
  doublons: {
    title: 'Doublons',
    short: 'Fusionner les tags de même nom.',
    text: 'Choisissez le tag à garder dans chaque groupe, puis « Fusionner » : les éléments des autres tags reçoivent le tag gardé, et les autres tags sont supprimés. Le tag gardé doit être visible depuis tous les éléments : un tag global l\'est toujours ; un tag de communauté seulement si tous les éléments sont dans cette communauté. Un tag d\'espace n\'est pas proposé ici. Sinon, rendez-le global d\'abord.',
    target: '[data-tour="admin-tags-duplicates"]',
    side: 'top',
  },
  refresh: {
    title: 'Actualiser',
    short: 'Relit les tags et les doublons (lecture seule).',
    text: 'Relit la liste des tags et des doublons.',
    target: '[data-tour="admin-tags-refresh"]',
    noZone: true,
    side: 'left',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Tags',
  summary: 'Les tags de SPOK : globaux (tous les espaces), propres à une communauté ou à un espace (et ses sous-espaces), et la fusion des tags en double.',
  ...derived,
  hints: {
    ...derived.hints,
    create: 'Crée un tag global : il apparaît aussitôt dans le sélecteur de tags de tous les espaces. Refusé si un tag global du même nom existe.',
    edit: 'Renommer ou changer la couleur : le changement se voit sur tous les éléments qui portent le tag. Refusé si le nom est déjà pris dans la même portée.',
    promote: 'Rendre global : ce tag n\'appartient plus à sa communauté ou à son espace et devient proposé dans tous les espaces ; ses éléments le gardent. Refusé si un tag global du même nom existe : fusionnez plutôt dans ce tag global. Journalisé dans l\'audit.',
    delete: 'Supprimer le tag : il est retiré de tous les éléments qui le portent (une confirmation suit). Irréversible ; journalisé dans l\'audit, sans restauration.',
    merge: 'Fusionner : les éléments des autres tags du groupe reçoivent le tag choisi (sans double), puis ces tags sont supprimés. Irréversible ; journalisé dans l\'audit (action Fusion).',
    duplicatesIntro: 'Tags de même nom (majuscules comprises) dans plusieurs communautés ou en global. Choisissez le tag à garder, puis fusionnez : il remplace les autres sur tous leurs éléments. Un tag grisé ne peut pas être gardé, car certains éléments sont hors de sa communauté.',
    noTarget: 'Aucun tag de ce groupe ne peut être gardé : rendez-en un global (onglet « Tous les tags »), puis fusionnez.',
  },
  tour: [
    {
      popover: {
        title: 'Tags',
        description: 'Les tags globaux et ceux des communautés, et leurs doublons.',
      },
    },
    ...elementTourSteps('admin-tags', elements),
  ],
};
