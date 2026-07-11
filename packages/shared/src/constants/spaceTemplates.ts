/* Templates de création d'espace : statuts/labels préconfigurés par cas d'usage. */
import type { StatusConfig, TypeLabelConfig } from '../types/referentiels.js';
import type { ItemType } from '../types/item.js';

export interface SpaceTemplateItem {
  title: string;
  type: ItemType;
  children?: SpaceTemplateItem[];
}

export interface SpaceTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  statuses?: StatusConfig[];
  typeLabels?: Record<string, TypeLabelConfig>;
  items?: SpaceTemplateItem[];
}

export const SPACE_TEMPLATES: SpaceTemplate[] = [
  {
    id: 'blank',
    name: 'Vide',
    description: 'Espace vierge avec les référentiels par défaut',
    icon: 'FileText',
  },
  {
    id: 'project',
    name: 'Projet',
    description: 'Structure de gestion de projet avec phases, jalons et tâches',
    icon: 'FolderKanban',
    statuses: [
      { id: 'undefined', label: 'Non défini', color: 'bg-slate-100 text-slate-600', borderColor: 'border-slate-400 bg-slate-100', order: 0, visible: true },
      { id: 'todo', label: 'À faire', color: 'bg-yellow-100 text-yellow-800', borderColor: 'border-yellow-300 bg-yellow-50', order: 1, visible: true },
      { id: 'in_progress', label: 'En cours', color: 'bg-orange-100 text-orange-800', borderColor: 'border-orange-300 bg-orange-50', order: 2, visible: true },
      { id: 'in_review', label: 'En revue', color: 'bg-purple-100 text-purple-800', borderColor: 'border-purple-300 bg-purple-50', order: 3, visible: true },
      { id: 'done', label: 'Terminé', color: 'bg-green-100 text-green-800', borderColor: 'border-green-300 bg-green-50', order: 4, visible: true },
      { id: 'cancelled', label: 'Annulé', color: 'bg-gray-100 text-gray-800', borderColor: 'border-gray-300 bg-gray-50', order: 5, visible: true },
    ],
    items: [
      {
        title: 'Phase 1 — Cadrage',
        type: 'PROJECT',
        children: [
          { title: 'Définir les objectifs et livrables', type: 'TASK' },
          { title: 'Identifier les parties prenantes', type: 'TASK' },
          { title: 'Établir le calendrier prévisionnel', type: 'TASK' },
          { title: 'Rédiger la note de cadrage', type: 'DOCUMENT' },
          { title: 'Réunion de lancement', type: 'MEETING' },
        ],
      },
      {
        title: 'Phase 2 — Conception',
        type: 'PROJECT',
        children: [
          { title: 'Spécifications fonctionnelles', type: 'DOCUMENT' },
          { title: 'Maquettes / wireframes', type: 'TASK' },
          { title: 'Architecture technique', type: 'DOCUMENT' },
          { title: 'Revue de conception', type: 'MEETING' },
        ],
      },
      {
        title: 'Phase 3 — Réalisation',
        type: 'PROJECT',
        children: [
          { title: 'Développement', type: 'TASK' },
          { title: 'Tests unitaires', type: 'TASK' },
          { title: 'Tests d\'intégration', type: 'TASK' },
          { title: 'Documentation technique', type: 'DOCUMENT' },
        ],
      },
      {
        title: 'Phase 4 — Livraison',
        type: 'PROJECT',
        children: [
          { title: 'Recette utilisateur', type: 'TASK' },
          { title: 'Corrections post-recette', type: 'TASK' },
          { title: 'Déploiement en production', type: 'TASK' },
          { title: 'Rétrospective', type: 'MEETING' },
        ],
      },
      {
        title: 'Risques et décisions',
        type: 'NOTE',
        children: [
          { title: 'Registre des risques', type: 'NOTE' },
          { title: 'Journal des décisions', type: 'NOTE' },
        ],
      },
    ],
  },
  {
    id: 'kanban',
    name: 'Kanban',
    description: 'Tableau Kanban avec workflow et exemples de tâches',
    icon: 'LayoutGrid',
    statuses: [
      { id: 'backlog', label: 'Backlog', color: 'bg-slate-100 text-slate-600', borderColor: 'border-slate-400 bg-slate-100', order: 0, visible: true },
      { id: 'todo', label: 'À faire', color: 'bg-yellow-100 text-yellow-800', borderColor: 'border-yellow-300 bg-yellow-50', order: 1, visible: true },
      { id: 'in_progress', label: 'En cours', color: 'bg-orange-100 text-orange-800', borderColor: 'border-orange-300 bg-orange-50', order: 2, visible: true },
      { id: 'done', label: 'Terminé', color: 'bg-green-100 text-green-800', borderColor: 'border-green-300 bg-green-50', order: 3, visible: true },
    ],
    items: [
      { title: 'Rédiger le brief créatif', type: 'TASK' },
      { title: 'Préparer les visuels', type: 'TASK' },
      { title: 'Mettre à jour la FAQ', type: 'TASK' },
      { title: 'Relire les conditions générales', type: 'TASK' },
      { title: 'Planifier la newsletter', type: 'TASK' },
      { title: 'Corriger le formulaire de contact', type: 'BUG' },
      { title: 'Optimiser le temps de chargement', type: 'TASK' },
      { title: 'Traduire la page d\'accueil', type: 'TASK' },
    ],
  },
  {
    id: 'meeting',
    name: 'Réunions',
    description: 'Suivi de réunions avec ordres du jour, décisions et actions',
    icon: 'Users',
    items: [
      {
        title: 'Réunion d\'équipe hebdomadaire',
        type: 'MEETING',
        children: [
          { title: 'Ordre du jour', type: 'NOTE' },
          { title: 'Tour de table — avancement', type: 'NOTE' },
          { title: 'Points de blocage', type: 'NOTE' },
          { title: 'Décisions prises', type: 'DOCUMENT' },
          { title: 'Actions à suivre', type: 'TASK' },
        ],
      },
      {
        title: 'Comité de pilotage',
        type: 'MEETING',
        children: [
          { title: 'Tableau de bord projet', type: 'DOCUMENT' },
          { title: 'Risques et alertes', type: 'NOTE' },
          { title: 'Arbitrages demandés', type: 'NOTE' },
          { title: 'Prochaines étapes', type: 'TASK' },
        ],
      },
      {
        title: 'Rétrospective',
        type: 'MEETING',
        children: [
          { title: 'Ce qui a bien marché', type: 'NOTE' },
          { title: 'Ce qui peut être amélioré', type: 'NOTE' },
          { title: 'Actions d\'amélioration', type: 'TASK' },
        ],
      },
      {
        title: 'Atelier de travail',
        type: 'MEETING',
        children: [
          { title: 'Objectif de l\'atelier', type: 'NOTE' },
          { title: 'Résultats et livrables', type: 'DOCUMENT' },
        ],
      },
    ],
  },
  {
    id: 'wiki',
    name: 'Wiki',
    description: 'Base de connaissances avec catégories et articles',
    icon: 'BookOpen',
    items: [
      {
        title: 'Guide de démarrage',
        type: 'DOCUMENT',
        children: [
          { title: 'Installation et configuration', type: 'NOTE' },
          { title: 'Premiers pas', type: 'NOTE' },
          { title: 'FAQ', type: 'NOTE' },
        ],
      },
      {
        title: 'Processus et procédures',
        type: 'DOCUMENT',
        children: [
          { title: 'Workflow de validation', type: 'NOTE' },
          { title: 'Gestion des accès', type: 'NOTE' },
          { title: 'Politique de nommage', type: 'NOTE' },
          { title: 'Checklist de mise en production', type: 'NOTE' },
        ],
      },
      {
        title: 'Architecture technique',
        type: 'DOCUMENT',
        children: [
          { title: 'Vue d\'ensemble', type: 'NOTE' },
          { title: 'Modèle de données', type: 'NOTE' },
          { title: 'API et intégrations', type: 'NOTE' },
          { title: 'Infrastructure', type: 'NOTE' },
        ],
      },
      {
        title: 'Ressources',
        type: 'DOCUMENT',
        children: [
          { title: 'Liens utiles', type: 'LINK' },
          { title: 'Glossaire', type: 'NOTE' },
          { title: 'Contacts clés', type: 'NOTE' },
        ],
      },
    ],
  },
  {
    id: 'bugtracker',
    name: 'Bug Tracker',
    description: 'Suivi de bugs avec workflow de résolution',
    icon: 'Bug',
    statuses: [
      { id: 'new', label: 'Nouveau', color: 'bg-red-100 text-red-800', borderColor: 'border-red-300 bg-red-50', order: 0, visible: true },
      { id: 'confirmed', label: 'Confirmé', color: 'bg-orange-100 text-orange-800', borderColor: 'border-orange-300 bg-orange-50', order: 1, visible: true },
      { id: 'in_progress', label: 'En cours', color: 'bg-blue-100 text-blue-800', borderColor: 'border-blue-300 bg-blue-50', order: 2, visible: true },
      { id: 'resolved', label: 'Résolu', color: 'bg-green-100 text-green-800', borderColor: 'border-green-300 bg-green-50', order: 3, visible: true },
      { id: 'closed', label: 'Fermé', color: 'bg-gray-100 text-gray-800', borderColor: 'border-gray-300 bg-gray-50', order: 4, visible: true },
      { id: 'wontfix', label: 'Ne sera pas corrigé', color: 'bg-slate-100 text-slate-600', borderColor: 'border-slate-400 bg-slate-100', order: 5, visible: true },
    ],
    items: [
      {
        title: 'Bugs critiques',
        type: 'PROJECT',
        children: [
          { title: 'Crash au démarrage sur Android 12', type: 'BUG' },
          { title: 'Perte de données lors de la sauvegarde', type: 'BUG' },
        ],
      },
      {
        title: 'Bugs majeurs',
        type: 'PROJECT',
        children: [
          { title: 'Le filtre par date ne fonctionne pas', type: 'BUG' },
          { title: 'Erreur 500 à l\'upload de fichiers volumineux', type: 'BUG' },
          { title: 'Notifications non reçues par email', type: 'BUG' },
        ],
      },
      {
        title: 'Bugs mineurs',
        type: 'PROJECT',
        children: [
          { title: 'Faute d\'orthographe page d\'accueil', type: 'BUG' },
          { title: 'Icône manquante en mode sombre', type: 'BUG' },
          { title: 'Alignement cassé sur petit écran', type: 'BUG' },
        ],
      },
      {
        title: 'Améliorations',
        type: 'PROJECT',
        children: [
          { title: 'Ajouter un raccourci clavier pour la recherche', type: 'TASK' },
          { title: 'Améliorer le message d\'erreur de connexion', type: 'TASK' },
        ],
      },
    ],
  },
  {
    id: 'brainstorm',
    name: 'Brainstorming',
    description: 'Capturer et organiser des idées librement',
    icon: 'Lightbulb',
    items: [
      {
        title: 'Nouvelles fonctionnalités',
        type: 'NOTE',
        children: [
          { title: 'Mode hors ligne', type: 'NOTE' },
          { title: 'Intégration calendrier', type: 'NOTE' },
          { title: 'Export PDF personnalisé', type: 'NOTE' },
          { title: 'Tableau de bord personnalisable', type: 'NOTE' },
        ],
      },
      {
        title: 'Expérience utilisateur',
        type: 'NOTE',
        children: [
          { title: 'Simplifier l\'onboarding', type: 'NOTE' },
          { title: 'Raccourcis clavier', type: 'NOTE' },
          { title: 'Thèmes de couleurs', type: 'NOTE' },
        ],
      },
      {
        title: 'Stratégie',
        type: 'NOTE',
        children: [
          { title: 'Partenariats potentiels', type: 'NOTE' },
          { title: 'Modèle de tarification', type: 'NOTE' },
          { title: 'Marchés cibles', type: 'NOTE' },
        ],
      },
      { title: 'Idée en vrac 1', type: 'NOTE' },
      { title: 'Idée en vrac 2', type: 'NOTE' },
      { title: 'Idée en vrac 3', type: 'NOTE' },
    ],
  },
  {
    id: 'scrum',
    name: 'Sprint Scrum',
    description: 'Organisation Scrum avec backlog, sprints et user stories',
    icon: 'Zap',
    statuses: [
      { id: 'backlog', label: 'Product Backlog', color: 'bg-slate-100 text-slate-600', borderColor: 'border-slate-400 bg-slate-100', order: 0, visible: true },
      { id: 'todo', label: 'Sprint Backlog', color: 'bg-yellow-100 text-yellow-800', borderColor: 'border-yellow-300 bg-yellow-50', order: 1, visible: true },
      { id: 'in_progress', label: 'En cours', color: 'bg-blue-100 text-blue-800', borderColor: 'border-blue-300 bg-blue-50', order: 2, visible: true },
      { id: 'in_review', label: 'En revue', color: 'bg-purple-100 text-purple-800', borderColor: 'border-purple-300 bg-purple-50', order: 3, visible: true },
      { id: 'done', label: 'Terminé', color: 'bg-green-100 text-green-800', borderColor: 'border-green-300 bg-green-50', order: 4, visible: true },
    ],
    items: [
      {
        title: 'Sprint 1',
        type: 'PERIOD',
        children: [
          { title: 'US-001 : En tant qu\'utilisateur, je veux créer un compte', type: 'TASK' },
          { title: 'US-002 : En tant qu\'utilisateur, je veux me connecter', type: 'TASK' },
          { title: 'US-003 : En tant qu\'utilisateur, je veux modifier mon profil', type: 'TASK' },
          { title: 'Sprint Planning', type: 'MEETING' },
          { title: 'Sprint Review', type: 'MEETING' },
          { title: 'Rétrospective Sprint 1', type: 'MEETING' },
        ],
      },
      {
        title: 'Sprint 2',
        type: 'PERIOD',
        children: [
          { title: 'US-004 : En tant qu\'utilisateur, je veux créer un projet', type: 'TASK' },
          { title: 'US-005 : En tant qu\'utilisateur, je veux inviter des membres', type: 'TASK' },
          { title: 'US-006 : En tant qu\'admin, je veux gérer les permissions', type: 'TASK' },
        ],
      },
      {
        title: 'Product Backlog',
        type: 'PROJECT',
        children: [
          { title: 'US-007 : En tant qu\'utilisateur, je veux exporter en PDF', type: 'TASK' },
          { title: 'US-008 : En tant qu\'utilisateur, je veux recevoir des notifications', type: 'TASK' },
          { title: 'US-009 : En tant qu\'admin, je veux voir les statistiques', type: 'TASK' },
          { title: 'US-010 : En tant qu\'utilisateur, je veux un mode hors ligne', type: 'TASK' },
        ],
      },
      {
        title: 'Définition of Done',
        type: 'DOCUMENT',
        children: [
          { title: 'Tests unitaires passent', type: 'NOTE' },
          { title: 'Code review approuvée', type: 'NOTE' },
          { title: 'Documentation mise à jour', type: 'NOTE' },
        ],
      },
    ],
  },
];
