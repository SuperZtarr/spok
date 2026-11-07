/* Aide utilisateur de la page d'administration « Communautés » (/admin/communities, CommunitiesPage), écrite en éléments d'aide (help/elements.ts) : un texte par
   fonction, repris par le « ? » (PageHelpButton), le tour et le mode Aide. Rappels fonctionnels (hints, via pageHint : infobulles des actions à effet, explication
   des blocs de décision ; clés new et pending portées par leur élément) décrivant l'effet réel côté API : à revérifier à chaque évolution des routes /admin.
   Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  new: {
    title: 'Nouvelle communauté',
    short: 'Crée une communauté et désigne son propriétaire.',
    text: 'Crée une communauté et désigne son propriétaire.',
    target: '[data-tour="admin-communities-new"]',
    noZone: true,
    side: 'left',
  },
  pending: {
    title: 'Demandes de publication',
    short: 'Le propriétaire a demandé que sa communauté privée devienne visible par tous. Elle reste privée tant que la demande n\'est pas traitée.',
    text: 'Les communautés dont le propriétaire demande qu\'elles deviennent visibles par tous ; approuvez ou rejetez.',
    target: '[data-tour="admin-communities-pending"]',
    side: 'bottom',
  },
  liste: {
    title: 'La liste',
    short: 'Toutes les communautés.',
    text: 'Cliquez une ligne pour ses paramètres ; glissez sa poignée pour changer l\'ordre d\'affichage. Actions à droite : supprimer montre d\'abord l\'impact et laisse choisir le sort de ses espaces.',
    target: '[data-tour="admin-communities-table"]',
    side: 'top',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Communautés (administration)',
  summary: 'Toutes les communautés SPOK, publiques ou privées : demandes de publication à traiter, ordre d\'affichage, création, suppression.',
  ...derived,
  hints: {
    ...derived.hints,
    csv: 'Télécharge la liste au format CSV.',
    requested: 'Visibilité demandée',
    visOPEN: 'Ouverte : visible par tous, tout le monde peut rejoindre et contribuer.',
    visREADONLY: 'Lecture seule : visible par tous, seuls les membres peuvent contribuer.',
    visPRIVATE: 'Privée : visible uniquement par les membres.',
    approve: 'Approuver : la communauté prend la visibilité demandée et devient visible par tous les utilisateurs de SPOK. Le propriétaire n\'est pas prévenu. Réversible depuis les paramètres de la communauté.',
    reject: 'Rejeter : la demande est effacée, la communauté reste privée. Le propriétaire n\'est pas prévenu ; il pourra refaire une demande.',
    delete: 'Supprimer : une confirmation montre l\'impact (espaces, éléments, membres) et laisse choisir — supprimer aussi ses espaces, ou les garder détachés de toute communauté. Tout ou rien ; tracé dans l\'audit.',
  },
  tour: [
    {
      popover: {
        title: 'Communautés',
        description: 'Toutes les communautés, y compris celles dont vous n\'êtes pas membre.',
      },
    },
    ...elementTourSteps('admin-communities', elements),
  ],
};
