/* Textes du mode Aide pour le cadre commun et la barre d'espace, indexés par nom de zone data-devzone (le même
   vocabulaire que DevZoneInspector). Une zone ajoutée ici doit exister dans le code, et toute zone data-devzone posée
   doit avoir son texte ici (sauf « contenu », trop large) — contrôlé par coverage.test. Titre ≤ 4 mots, 1 à 3 phrases,
   sans lister les boutons (rôle des infobulles). */
import type { HelpZone } from './types';

/** Infobulles de la barre latérale (lues par HelpHint dans Layout.tsx). */
export const SIDEBAR_HINTS = {
  process: (count: number) => `Cet espace contient un process (${count} élément${count > 1 ? 's' : ''} placé${count > 1 ? 's' : ''}) — vue Process de l'espace.`,
};

export const SHELL_ZONES: Record<string, HelpZone> = {
  sidebar: { title: 'Barre latérale', text: 'Vos espaces et vos communautés. Cliquez sur un espace pour y entrer. Une petite icône après son nom signale qu\'il contient un process.' },
  'sidebar-logo': { title: 'Logo', text: 'Ramène à l\'accueil.' },
  'sidebar-guide': { title: 'Guide de démarrage', text: 'Relance la visite guidée des bases de SPOK.' },
  'sidebar-nav': { title: 'Navigation', text: 'Vos accès aux espaces : favoris, récents, vos espaces, vos communautés.' },
  'sidebar-favoris': { title: 'Favoris', text: 'Les espaces marqués d\'une étoile, toujours en tête de la barre.' },
  'sidebar-recents': { title: 'Récents', text: 'Les derniers espaces visités, pour y revenir vite.' },
  'sidebar-mes-espaces': { title: 'Mes espaces', text: 'Votre espace personnel et les espaces hors communauté dont vous êtes membre.' },
  'sidebar-communaute': { title: 'Une communauté', text: 'Une communauté et ses espaces : cliquez pour déplier ses espaces, ou sur son nom pour ouvrir sa page. Au survol, « + » crée un espace et « ⋯ » sur un espace ouvre ses actions.' },
  'sidebar-autres-espaces': { title: 'Autres espaces', text: 'Des espaces visibles hors de vos communautés : vous pouvez les consulter ou les rejoindre.' },
  'sidebar-arbre': { title: 'Communauté courante', text: 'La communauté où vous êtes et l\'arbre de ses espaces. « Toutes les communautés » revient à la liste complète. Au survol d\'un espace, « ⋯ » permet de créer un sous-espace, de le déplacer, de changer son ordre ou de le supprimer.' },
  'sidebar-footer': { title: 'Pied de barre', text: 'Les pages d\'administration quand le mode admin est actif, et la date de la dernière mise en ligne de SPOK.' },
  header: { title: 'En-tête', text: 'Où vous êtes, le mode d\'affichage (Forum, Projet, Loisirs, Tous), la création rapide, les séances en direct, les notifications et votre compte.' },
  bandeau: { title: 'Navigation globale', text: 'Les pages qui couvrent toutes vos communautés (accueil, communautés, espaces, graphes, liens), puis vos pages personnelles.' },
  toolbar: { title: 'Barre de l\'espace', text: 'Commune à toutes les vues de l\'espace : choix de la vue, ordre, filtre ou aperçu selon la vue, et actions de l\'espace.' },
  'toolbar-vues': { title: 'Vues', text: 'Les vues du mode courant en accès direct ; les autres sont dans les menus « Autres vues », un par catégorie (Basique, Types, Planification, Exploration). Le contenu reste le même, seule la présentation change.' },
  'toolbar-ordre': { title: 'Ordre', text: 'L\'ordre des éléments dans les vues en liste : votre ordre manuel ou alphabétique.' },
  'toolbar-filtre': { title: 'Filtre', text: 'Ne garde que les éléments des types et statuts cochés (plusieurs choix possibles) ou contenant un texte. Vos critères restent actifs quand vous changez de vue ; dans une vue en Aperçu, ils mettent en évidence au lieu de masquer.' },
  'toolbar-apercu': { title: 'Aperçu', text: 'Remplace le filtre dans les vues qui montrent des liens ou une structure (carte mentale, Gantt, graphes…) : met en évidence les éléments qui correspondent, sans masquer les autres.' },
  'toolbar-actions': { title: 'Actions de l\'espace', text: 'Séances en direct, nombre d\'éléments, modèles, historique et paramètres de l\'espace.' },
  'contenu-barre-vue': { title: 'Barre de la vue', text: 'Les commandes propres à la vue affichée : créer un élément, régler l\'affichage, aide et export.' },
  // Fiche d'un élément (ItemEditModal, ItemReadView)
  'item-chemin': { title: 'Chemin de l\'élément', text: 'La communauté, l\'espace et les parents de l\'élément. Cliquez sur un parent pour l\'ouvrir.' },
  'item-entete': { title: 'En-tête de la fiche', text: 'Le type et le titre de l\'élément, le choix entre Afficher et Modifier, et qui l\'a créé.' },
  'item-description': { title: 'Description', text: 'Le texte de l\'élément, avec sa mise en forme, ses images et ses mentions d\'autres éléments.' },
  'item-contributions': { title: 'Réactions et contributions', text: 'Les réactions à l\'élément et les messages des membres, avec leurs réponses.' },
  'item-champs': { title: 'Champs de pilotage', text: 'Le type, le statut, les dates et le média de l\'élément.' },
  'item-type': { title: 'Type', text: 'La nature de l\'élément. Elle détermine les statuts proposés et le rangement dans les vues.' },
  'item-statut': { title: 'Statut', text: 'L\'avancement de l\'élément. Il définit sa colonne dans le Kanban.' },
  'item-dates': { title: 'Dates', text: 'Le début, la fin et l\'échéance. Elles placent l\'élément dans le Gantt et le calendrier.' },
  'item-details': { title: 'Détails', text: 'L\'identifiant de l\'élément, son assignation, ses relations, ses tags et ses enfants.' },
  'item-relations': { title: 'Relations', text: 'Les liens avec d\'autres éléments, sans lien de parenté.' },
  'item-tags': { title: 'Tags', text: 'Les étiquettes de l\'élément, pour le retrouver et le filtrer.' },
  'item-enfants': { title: 'Éléments enfants', text: 'Les sous-éléments de cet élément. Cliquez sur l\'un d\'eux pour l\'ouvrir.' },
  'item-pied': { title: 'Pied de la fiche', text: 'Enregistrer ou fermer la fiche, et les autres actions sur l\'élément.' },
  'item-lecture': { title: 'Mode Afficher', text: 'La fiche présentée comme un document à lire. On modifie en passant sur « Modifier ».' },
};
