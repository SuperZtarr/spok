export interface SunburstNode {
  name: string;
  id: string;
  nodeType: 'global' | 'community' | 'space' | 'item';
  itemType?: string;
  value?: number;
  children?: SunburstNode[];
}
