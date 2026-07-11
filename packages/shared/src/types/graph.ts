/* Types graphe : nœuds/liens (GraphData), sunburst (SunburstNode). */
export interface SunburstNode {
  name: string;
  id: string;
  nodeType: 'global' | 'community' | 'space' | 'item';
  itemType?: string;
  status?: string | null;
  value?: number;
  children?: SunburstNode[];
}
