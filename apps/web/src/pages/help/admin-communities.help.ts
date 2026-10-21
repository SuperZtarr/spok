/* Aide utilisateur de la page d'administration « Communautés » (/admin/communities, CommunitiesPage).
   Lue par son point d'interrogation (PageHelpButton), son tour et ses rappels fonctionnels (hints, via pageHint :
   infobulles des actions à effet, explication des blocs de décision) — registre help/pageHelp.ts.
   Les rappels décrivent l'effet réel côté API : à revérifier à chaque évolution des routes /admin. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Communautés (administration)',
  summary: 'Toutes les communautés SPOK, publiques ou privées : demandes de publication à traiter, ordre d\'affichage, création, suppression.',
  tips: [
    '« En attente d\'approbation » : un propriétaire a demandé à rendre sa communauté visible par tous ; approuvez ou rejetez',
    'Cliquez sur une ligne pour ouvrir les paramètres de la communauté',
    'Glissez une ligne par sa poignée pour changer l\'ordre d\'affichage des communautés',
    'Supprimer montre d\'abord l\'impact et laisse choisir le sort de ses espaces',
  ],
  tour: [
    {
      popover: {
        title: 'Communautés',
        description: 'Toutes les communautés, y compris celles dont vous n\'êtes pas membre.',
      },
    },
    {
      element: '[data-tour="admin-communities-new"]',
      popover: {
        title: 'Nouvelle communauté',
        description: 'Crée une communauté et désigne son propriétaire.',
        side: 'left',
      },
    },
    {
      element: '[data-tour="admin-communities-pending"]',
      popover: {
        title: 'Demandes de publication',
        description: 'Les communautés dont le propriétaire demande qu\'elles deviennent visibles par tous.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="admin-communities-table"]',
      popover: {
        title: 'La liste',
        description: 'Cliquez une ligne pour ses paramètres ; glissez la poignée pour l\'ordre ; actions à droite.',
        side: 'top',
      },
    },
  ],
  hints: {
    new: 'Crée une communauté et désigne son propriétaire.',
    csv: 'Télécharge la liste au format CSV.',
    pending: 'Le propriétaire a demandé que sa communauté privée devienne visible par tous. Elle reste privée tant que la demande n\'est pas traitée.',
    requested: 'Visibilité demandée',
    visOPEN: 'Ouverte : visible par tous, tout le monde peut rejoindre et contribuer.',
    visREADONLY: 'Lecture seule : visible par tous, seuls les membres peuvent contribuer.',
    visPRIVATE: 'Privée : visible uniquement par les membres.',
    approve: 'Approuver : la communauté prend la visibilité demandée et devient visible par tous les utilisateurs de SPOK. Le propriétaire n\'est pas prévenu. Réversible depuis les paramètres de la communauté.',
    reject: 'Rejeter : la demande est effacée, la communauté reste privée. Le propriétaire n\'est pas prévenu ; il pourra refaire une demande.',
    delete: 'Supprimer : une confirmation montre l\'impact (espaces, éléments, membres) et laisse choisir — supprimer aussi ses espaces, ou les garder détachés de toute communauté. Tout ou rien ; tracé dans l\'audit.',
  },
};
