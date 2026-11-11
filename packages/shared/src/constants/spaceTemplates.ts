/* Templates de création d'espace : arborescence d'items de départ par cas d'usage.
 * Pas de statuts ici : les statuts (référentiels) appartiennent à la communauté
 * (Community.referentiels) — un modèle d'espace ne peut pas les définir (décision 2026-10-16).
 * `tags` : tags de classement posés à la création (tag de la communauté, créé s'il manque) — une anomalie est une
 * Tâche taguée « bug » depuis le lot 4 « contenus multiples » (2026-11-11) ; un texte rédigé est un Élément (UNDEFINED). */
import type { ItemType } from '../types/item.js';

export interface SpaceTemplateItem {
  title: string;
  type: ItemType;
  tags?: string[];
  children?: SpaceTemplateItem[];
}

export interface SpaceTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
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
    items: [
      {
        title: 'Phase 1 — Cadrage',
        type: 'PROJECT',
        children: [
          { title: 'Définir les objectifs et livrables', type: 'TASK' },
          { title: 'Identifier les parties prenantes', type: 'TASK' },
          { title: 'Établir le calendrier prévisionnel', type: 'TASK' },
          { title: 'Rédiger la note de cadrage', type: 'UNDEFINED' },
          { title: 'Réunion de lancement', type: 'MEETING' },
        ],
      },
      {
        title: 'Phase 2 — Conception',
        type: 'PROJECT',
        children: [
          { title: 'Spécifications fonctionnelles', type: 'UNDEFINED' },
          { title: 'Maquettes / wireframes', type: 'TASK' },
          { title: 'Architecture technique', type: 'UNDEFINED' },
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
          { title: 'Documentation technique', type: 'UNDEFINED' },
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
        type: 'UNDEFINED',
        children: [
          { title: 'Registre des risques', type: 'UNDEFINED' },
          { title: 'Journal des décisions', type: 'UNDEFINED' },
        ],
      },
    ],
  },
  {
    id: 'kanban',
    name: 'Kanban',
    description: 'Tableau Kanban avec workflow et exemples de tâches',
    icon: 'LayoutGrid',
    items: [
      { title: 'Rédiger le brief créatif', type: 'TASK' },
      { title: 'Préparer les visuels', type: 'TASK' },
      { title: 'Mettre à jour la FAQ', type: 'TASK' },
      { title: 'Relire les conditions générales', type: 'TASK' },
      { title: 'Planifier la newsletter', type: 'TASK' },
      { title: 'Corriger le formulaire de contact', type: 'TASK', tags: ['bug'] },
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
          { title: 'Ordre du jour', type: 'UNDEFINED' },
          { title: 'Tour de table — avancement', type: 'UNDEFINED' },
          { title: 'Points de blocage', type: 'UNDEFINED' },
          { title: 'Décisions prises', type: 'UNDEFINED' },
          { title: 'Actions à suivre', type: 'TASK' },
        ],
      },
      {
        title: 'Comité de pilotage',
        type: 'MEETING',
        children: [
          { title: 'Tableau de bord projet', type: 'UNDEFINED' },
          { title: 'Risques et alertes', type: 'UNDEFINED' },
          { title: 'Arbitrages demandés', type: 'UNDEFINED' },
          { title: 'Prochaines étapes', type: 'TASK' },
        ],
      },
      {
        title: 'Rétrospective',
        type: 'MEETING',
        children: [
          { title: 'Ce qui a bien marché', type: 'UNDEFINED' },
          { title: 'Ce qui peut être amélioré', type: 'UNDEFINED' },
          { title: 'Actions d\'amélioration', type: 'TASK' },
        ],
      },
      {
        title: 'Atelier de travail',
        type: 'MEETING',
        children: [
          { title: 'Objectif de l\'atelier', type: 'UNDEFINED' },
          { title: 'Résultats et livrables', type: 'UNDEFINED' },
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
        type: 'UNDEFINED',
        children: [
          { title: 'Installation et configuration', type: 'UNDEFINED' },
          { title: 'Premiers pas', type: 'UNDEFINED' },
          { title: 'FAQ', type: 'UNDEFINED' },
        ],
      },
      {
        title: 'Processus et procédures',
        type: 'UNDEFINED',
        children: [
          { title: 'Workflow de validation', type: 'UNDEFINED' },
          { title: 'Gestion des accès', type: 'UNDEFINED' },
          { title: 'Politique de nommage', type: 'UNDEFINED' },
          { title: 'Checklist de mise en production', type: 'UNDEFINED' },
        ],
      },
      {
        title: 'Architecture technique',
        type: 'UNDEFINED',
        children: [
          { title: 'Vue d\'ensemble', type: 'UNDEFINED' },
          { title: 'Modèle de données', type: 'UNDEFINED' },
          { title: 'API et intégrations', type: 'UNDEFINED' },
          { title: 'Infrastructure', type: 'UNDEFINED' },
        ],
      },
      {
        title: 'Ressources',
        type: 'UNDEFINED',
        children: [
          { title: 'Liens utiles', type: 'UNDEFINED' },
          { title: 'Glossaire', type: 'UNDEFINED' },
          { title: 'Contacts clés', type: 'UNDEFINED' },
        ],
      },
    ],
  },
  {
    id: 'bugtracker',
    name: 'Bug Tracker',
    description: 'Suivi de bugs avec workflow de résolution',
    icon: 'Bug',
    items: [
      {
        title: 'Bugs critiques',
        type: 'PROJECT',
        children: [
          { title: 'Crash au démarrage sur Android 12', type: 'TASK', tags: ['bug'] },
          { title: 'Perte de données lors de la sauvegarde', type: 'TASK', tags: ['bug'] },
        ],
      },
      {
        title: 'Bugs majeurs',
        type: 'PROJECT',
        children: [
          { title: 'Le filtre par date ne fonctionne pas', type: 'TASK', tags: ['bug'] },
          { title: 'Erreur 500 à l\'upload de fichiers volumineux', type: 'TASK', tags: ['bug'] },
          { title: 'Notifications non reçues par email', type: 'TASK', tags: ['bug'] },
        ],
      },
      {
        title: 'Bugs mineurs',
        type: 'PROJECT',
        children: [
          { title: 'Faute d\'orthographe page d\'accueil', type: 'TASK', tags: ['bug'] },
          { title: 'Icône manquante en mode sombre', type: 'TASK', tags: ['bug'] },
          { title: 'Alignement cassé sur petit écran', type: 'TASK', tags: ['bug'] },
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
        type: 'UNDEFINED',
        children: [
          { title: 'Mode hors ligne', type: 'UNDEFINED' },
          { title: 'Intégration calendrier', type: 'UNDEFINED' },
          { title: 'Export PDF personnalisé', type: 'UNDEFINED' },
          { title: 'Tableau de bord personnalisable', type: 'UNDEFINED' },
        ],
      },
      {
        title: 'Expérience utilisateur',
        type: 'UNDEFINED',
        children: [
          { title: 'Simplifier l\'onboarding', type: 'UNDEFINED' },
          { title: 'Raccourcis clavier', type: 'UNDEFINED' },
          { title: 'Thèmes de couleurs', type: 'UNDEFINED' },
        ],
      },
      {
        title: 'Stratégie',
        type: 'UNDEFINED',
        children: [
          { title: 'Partenariats potentiels', type: 'UNDEFINED' },
          { title: 'Modèle de tarification', type: 'UNDEFINED' },
          { title: 'Marchés cibles', type: 'UNDEFINED' },
        ],
      },
      { title: 'Idée en vrac 1', type: 'UNDEFINED' },
      { title: 'Idée en vrac 2', type: 'UNDEFINED' },
      { title: 'Idée en vrac 3', type: 'UNDEFINED' },
    ],
  },
  {
    id: 'scrum',
    name: 'Sprint Scrum',
    description: 'Organisation Scrum avec backlog, sprints et user stories',
    icon: 'Zap',
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
        type: 'UNDEFINED',
        children: [
          { title: 'Tests unitaires passent', type: 'UNDEFINED' },
          { title: 'Code review approuvée', type: 'UNDEFINED' },
          { title: 'Documentation mise à jour', type: 'UNDEFINED' },
        ],
      },
    ],
  },
];
