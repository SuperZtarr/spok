export type MenuAccess = 'public' | 'user' | 'admin';

export interface MenuOverride {
  key: string;
  visible: boolean;
  access: MenuAccess;
}

export interface MenuItemConfig {
  id: string;
  key: string;
  label: string;
  icon: string;
  section: string;
  sectionLabel: string;
  sectionOrder: number;
  route: string | null;
  viewMode: string | null;
  order: number;
  visible: boolean;
  access: MenuAccess;
}

export interface MenuSection {
  id: string;
  label: string;
  order: number;
  items: MenuItemConfig[];
}
