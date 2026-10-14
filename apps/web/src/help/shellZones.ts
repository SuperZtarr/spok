/* Textes du mode Aide pour le cadre commun et la barre d'espace, indexés par nom de zone data-devzone (le même
   vocabulaire que DevZoneInspector). Une zone ajoutée ici doit exister dans le code, et toute zone data-devzone posée
   doit avoir son texte ici (sauf « contenu », trop large) — contrôlé par coverage.test. Titre ≤ 4 mots, 1 à 3 phrases,
   sans lister les boutons (rôle des infobulles). */
import type { HelpZone } from './types';

export const SHELL_ZONES: Record<string, HelpZone> = {
  sidebar: { title: 'Barre latérale', text: 'Vos espaces et vos communautés. Cliquez sur un espace pour y entrer.' },
  'sidebar-logo': { title: 'Logo', text: 'Ramène à l\'accueil.' },
  'sidebar-guide': { title: 'Guide de démarrage', text: 'Relance la visite guidée des bases de SPOK.' },
  'sidebar-nav': { title: 'Navigation', text: 'Vos accès aux espaces : favoris, récents, vos espaces, vos communautés.' },
  'sidebar-favoris': { title: 'Favoris', text: 'Les espaces marqués d\'une étoile, toujours en tête de la barre.' },
  'sidebar-recents': { title: 'Récents', text: 'Les derniers espaces visités, pour y revenir vite.' },
  'sidebar-mes-espaces': { title: 'Mes espaces', text: 'Votre espace personnel et les espaces hors communauté dont vous êtes membre.' },
  'sidebar-communaute': { title: 'Une communauté', text: 'Une communauté et ses espaces : cliquez pour déplier ses espaces, ou sur son nom pour ouvrir sa page.' },
  'sidebar-autres-espaces': { title: 'Autres espaces', text: 'Des espaces visibles hors de vos communautés : vous pouvez les consulter ou les rejoindre.' },
  'sidebar-arbre': { title: 'Communauté courante', text: 'La communauté où vous êtes et l\'arbre de ses espaces. « Toutes les communautés » revient à la liste complète.' },
  'sidebar-footer': { title: 'Pied de barre', text: 'Les pages d\'administration quand le mode admin est actif, et la date de la dernière mise en ligne de SPOK.' },
  header: { title: 'En-tête', text: 'Où vous êtes, le mode d\'affichage (Forum, Projet, JDR, Tous), la création rapide, les séances en direct, les notifications et votre compte.' },
  bandeau: { title: 'Navigation globale', text: 'Les pages qui couvrent toutes vos communautés (accueil, communautés, espaces, graphes, liens), puis vos pages personnelles.' },
  toolbar: { title: 'Barre de l\'espace', text: 'Commune à toutes les vues de l\'espace : choix de la vue, ordre, filtre, aperçu et actions de l\'espace.' },
  'toolbar-vues': { title: 'Vues', text: 'Les vues de la famille du mode courant en accès direct ; les autres familles sont dans les menus déroulants. Le contenu reste le même, seule la présentation change.' },
  'toolbar-ordre': { title: 'Ordre', text: 'L\'ordre des éléments dans les vues en liste : votre ordre manuel ou alphabétique.' },
  'toolbar-filtre': { title: 'Filtre', text: 'Ne garde que les éléments d\'un type, d\'un statut ou contenant un texte. Le filtre reste actif quand vous changez de vue.' },
  'toolbar-apercu': { title: 'Aperçu', text: 'Met en évidence les éléments qui correspondent, sans masquer les autres.' },
  'toolbar-actions': { title: 'Actions de l\'espace', text: 'Séances en direct, nombre d\'éléments, modèles, historique et paramètres de l\'espace.' },
  'contenu-barre-vue': { title: 'Barre de la vue', text: 'Les commandes propres à la vue affichée : créer un élément, régler l\'affichage, aide et export.' },
};
