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
    description: 'Structure de gestion de projet avec phases et tâches',
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
        title: 'Planification',
        type: 'PROJECT',
        children: [
          { title: 'Définir les objectifs', type: 'TASK' },
          { title: 'Identifier les parties prenantes', type: 'TASK' },
          { title: 'Établir le calendrier', type: 'TASK' },
        ],
      },
      {
        title: 'Développement',
        type: 'PROJECT',
        children: [
          { title: 'Conception', type: 'TASK' },
          { title: 'Implémentation', type: 'TASK' },
          { title: 'Tests', type: 'TASK' },
        ],
      },
      {
        title: 'Livraison',
        type: 'PROJECT',
        children: [
          { title: 'Revue finale', type: 'TASK' },
          { title: 'Déploiement', type: 'TASK' },
          { title: 'Rétrospective', type: 'MEETING' },
        ],
      },
    ],
  },
  {
    id: 'kanban',
    name: 'Kanban',
    description: 'Tableau Kanban simple avec colonnes de workflow',
    icon: 'LayoutGrid',
    statuses: [
      { id: 'backlog', label: 'Backlog', color: 'bg-slate-100 text-slate-600', borderColor: 'border-slate-400 bg-slate-100', order: 0, visible: true },
      { id: 'todo', label: 'À faire', color: 'bg-yellow-100 text-yellow-800', borderColor: 'border-yellow-300 bg-yellow-50', order: 1, visible: true },
      { id: 'in_progress', label: 'En cours', color: 'bg-orange-100 text-orange-800', borderColor: 'border-orange-300 bg-orange-50', order: 2, visible: true },
      { id: 'done', label: 'Terminé', color: 'bg-green-100 text-green-800', borderColor: 'border-green-300 bg-green-50', order: 3, visible: true },
    ],
  },
  {
    id: 'meeting',
    name: 'Réunions',
    description: 'Espace de suivi de réunions avec notes et décisions',
    icon: 'Users',
    items: [
      {
        title: 'Réunion d\'équipe hebdomadaire',
        type: 'MEETING',
        children: [
          { title: 'Ordre du jour', type: 'NOTE' },
          { title: 'Compte-rendu', type: 'DOCUMENT' },
        ],
      },
    ],
  },
];
