/* Aide utilisateur de la page d'administration « Utilisateurs » (/admin/users, UsersPage), écrite en éléments d'aide (help/elements.ts) : un texte par fonction,
   repris par le « ? » (PageHelpButton), le tour et le mode Aide. Rappels fonctionnels (hints, via pageHint : infobulles des actions à effet, explication des
   blocs de décision) décrivant l'effet réel côté API : à revérifier à chaque évolution des routes /admin. Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  new: {
    title: 'Nouvel utilisateur',
    short: 'Crée un compte à la main ; la personne pourra se connecter avec l\'e-mail et le mot de passe saisis.',
    text: 'Crée un compte à la main (nom, e-mail, mot de passe, rôle).',
    target: '[data-tour="admin-users-new"]',
    noZone: true,
    side: 'left',
  },
  liste: {
    title: 'La liste',
    short: 'Une ligne par compte.',
    text: 'Une ligne par compte ; cliquez-la pour son détail (rôle global, statistiques, appartenances). Les actions sont à droite : désactiver bloque la connexion sans rien effacer ; supprimer n\'est possible que pour un compte sans aucune trace. Colonne Claude : accordez ou retirez l\'accès MCP, « Demande en attente » signale une demande de l\'utilisateur. L\'icône réseau montre à quoi le compte a accès dans chaque communauté et espace.',
    target: '[data-tour="admin-users-table"]',
    side: 'top',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Utilisateurs',
  summary: 'Tous les comptes SPOK : rôle, état, dernière connexion, accès Claude. On y crée, désactive ou supprime un compte.',
  ...derived,
  hints: {
    ...derived.hints,
    // Fiche utilisateur — colonnes d'accès (AccessColumnManager)
    accessAddCommunity: 'Donner l\'accès : la personne devient membre de cette communauté (elle la voit dans sa barre latérale, avec les espaces qui lui sont ouverts).',
    accessAddSpace: 'Donner l\'accès : la personne devient membre de cet espace et peut y travailler.',
    accessPromote: 'Rendre propriétaire : la personne pourra gérer les réglages et les membres. Les autres propriétaires le restent.',
    accessDemote: 'Rétrograder en membre : elle perd la gestion des réglages et des membres. Refusé s\'il s\'agit du dernier propriétaire.',
    accessRemove: 'Retirer l\'accès supprime son adhésion directe. Ses adhésions aux espaces (ou à la communauté) restent à part, et un accès hérité d\'une visibilité ouverte reste possible — voir la page Accès.',
    csv: 'Télécharge la liste au format CSV.',
    anomalyFilter: 'Filtre posé depuis Diagnostics : seuls les comptes concernés par cette anomalie sont listés.',
    mcpAdmin: 'Les administrateurs ont toujours l\'accès Claude (MCP).',
    mcpGrant: 'Accorder l\'accès Claude : ce compte pourra créer des jetons pour connecter Claude à SPOK. Efface sa demande en attente ; tracé dans l\'audit.',
    mcpRevoke: 'Retirer l\'accès Claude : les jetons de ce compte cessent de fonctionner. Tracé dans l\'audit ; réversible.',
    access: 'Voir les accès : l\'arbre des communautés et espaces, avec l\'accès effectif de ce compte (direct, hérité ou aucun).',
    disable: 'Désactiver : bloque la connexion (et les jetons Claude) ; contenus et appartenances sont conservés. Réversible. Impossible sur votre compte ou sur le dernier administrateur actif.',
    enable: 'Réactiver : la personne peut de nouveau se connecter.',
    delete: 'Supprimer définitivement : possible seulement pour un compte qui n\'a laissé aucune trace (éléments, contributions, audit, e-mails…). Sinon la suppression est refusée — désactivez-le.',
  },
  tour: [
    {
      popover: {
        title: 'Utilisateurs',
        description: 'La liste de tous les comptes, administrateurs en premier.',
      },
    },
    ...elementTourSteps('admin-users', elements),
  ],
};
