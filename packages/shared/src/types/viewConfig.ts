export type ViewAccess = 'public' | 'user' | 'admin';
export type ViewCategory = 'dashboard' | 'basic' | 'planning' | 'exploration';

export interface ViewConfigItem {
  id: string;        // matches ViewMode in the frontend
  label: string;
  icon: string;      // lucide icon name
  category: ViewCategory;
  order: number;
  visible: boolean;
  access: ViewAccess;
}

export interface ViewCategoryConfig {
  id: ViewCategory;
  label: string;
  order: number;
}

// Global pages config (dashboard tabs)
export type GlobalPageGroup = 'global' | 'myActivities' | 'misc';

export interface GlobalPageConfig {
  id: string;
  label: string;
  icon: string;
  group: GlobalPageGroup;
  order: number;
  visible: boolean;
  access: ViewAccess;
}

export interface GlobalPageGroupConfig {
  id: GlobalPageGroup;
  label: string;
  order: number;
}
