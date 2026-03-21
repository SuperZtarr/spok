import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewMode = 'list' | 'tree' | 'mindmap' | 'kanban' | 'types' | 'timeline' | 'planning' | 'calendar' | 'graph' | 'text' | 'sunburst' | 'relations' | 'bubble' | 'radialTree' | 'treemap' | 'burndown' | 'cfd' | 'chord' | 'crossTable' | 'heatmap' | 'ego' | 'members' | 'priority' | 'images' | 'links' | 'documents' | 'bugs' | 'overview';

export type ViewCategory = 'dashboard' | 'basic' | 'itemTypes' | 'planning' | 'exploration';

export const VIEW_CATEGORIES: { value: ViewCategory; label: string }[] = [
  { value: 'dashboard', label: 'Tableau de bord' },
  { value: 'basic', label: 'Basique' },
  { value: 'itemTypes', label: 'Types' },
  { value: 'planning', label: 'Planification' },
  { value: 'exploration', label: 'Exploration' },
];

export const VIEW_MODES: { value: ViewMode; label: string; icon: string; category: ViewCategory }[] = [
  { value: 'list', label: 'Liste', icon: 'List', category: 'basic' },
  { value: 'tree', label: 'Arborescence', icon: 'GitBranch', category: 'basic' },
  { value: 'kanban', label: 'Kanban', icon: 'Columns3', category: 'planning' },
  { value: 'text', label: 'Texte', icon: 'FileText', category: 'basic' },
  { value: 'planning', label: 'Planning', icon: 'CalendarCheck', category: 'planning' },
  { value: 'timeline', label: 'Gantt', icon: 'GanttChart', category: 'planning' },
  { value: 'calendar', label: 'Calendrier', icon: 'Calendar', category: 'planning' },
  { value: 'types', label: 'Types', icon: 'LayoutGrid', category: 'basic' },
  { value: 'mindmap', label: 'Carte mentale', icon: 'Share2', category: 'exploration' },
  { value: 'graph', label: 'Graphe', icon: 'Network', category: 'exploration' },
  { value: 'sunburst', label: 'Sunburst', icon: 'CircleDot', category: 'exploration' },
  { value: 'relations', label: 'Relations', icon: 'Waypoints', category: 'exploration' },
{ value: 'bubble', label: 'Bulles', icon: 'Circle', category: 'exploration' },
  { value: 'radialTree', label: 'Arbre radial', icon: 'Orbit', category: 'exploration' },
  { value: 'treemap', label: 'Treemap', icon: 'SquareStack', category: 'exploration' },
  { value: 'chord', label: 'Chord', icon: 'Disc', category: 'exploration' },
  { value: 'burndown', label: 'Burndown', icon: 'TrendingDown', category: 'planning' },
  { value: 'cfd', label: 'Flux cumulatif', icon: 'Layers', category: 'planning' },
  { value: 'members', label: 'Membres', icon: 'Users', category: 'basic' },
  { value: 'priority', label: 'Priorités', icon: 'Flame', category: 'basic' },
  { value: 'crossTable', label: 'Tableau croisé', icon: 'Table2', category: 'basic' },
  { value: 'heatmap', label: 'Heatmap', icon: 'Grid3x3', category: 'exploration' },
  { value: 'ego', label: 'Réseau ego', icon: 'Focus', category: 'exploration' },
  { value: 'links', label: 'Liens', icon: 'ExternalLink', category: 'itemTypes' },
  { value: 'images', label: 'Images', icon: 'Image', category: 'itemTypes' },
  { value: 'documents', label: 'Documents', icon: 'FileText', category: 'itemTypes' },
  { value: 'bugs', label: 'Bugs', icon: 'Bug', category: 'itemTypes' },
];

interface ViewModeState {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
}

export const useViewModeStore = create<ViewModeState>()(
  persist(
    (set) => ({
      mode: 'tree',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'view-mode-storage',
    }
  )
);
