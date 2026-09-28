/* Constantes du Gantt : hauteurs de lignes, largeurs de colonnes, niveaux de zoom.
 * RELATION_TYPES : dérivé de la source unique constants/relationTypes.ts — ne pas redéfinir ici. */
import type { LucideIcon } from 'lucide-react';
import { RELATION_TYPE_LIST } from '../../constants/relationTypes';

// Zoom level configuration
export type ZoomLevel = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'multiyear';

export interface ZoomConfig {
  label: string;
  days: number;
  dayWidth: number;
  navStep: number; // days to navigate
  showDayNumbers: boolean;
  showWeekdays: boolean;
  snapDays: number; // granularité du snap D&D
}

export const ZOOM_CONFIGS: Record<ZoomLevel, ZoomConfig> = {
  day:     { label: 'Jour',      days: 7,   dayWidth: 80, navStep: 1,  showDayNumbers: true,  showWeekdays: true,  snapDays: 1  },
  week:    { label: 'Semaine',   days: 42,  dayWidth: 40, navStep: 1,  showDayNumbers: true,  showWeekdays: true,  snapDays: 1  },
  month:   { label: 'Mois',      days: 90,  dayWidth: 20, navStep: 7,  showDayNumbers: true,  showWeekdays: false, snapDays: 1  },
  quarter: { label: 'Trimestre', days: 180, dayWidth: 8,  navStep: 7,  showDayNumbers: false, showWeekdays: false, snapDays: 7  },
  year:    { label: 'Année',     days: 365, dayWidth: 4,  navStep: 30, showDayNumbers: false, showWeekdays: false, snapDays: 30 },
  multiyear: { label: 'Multi-années', days: 1095, dayWidth: 2, navStep: 90, showDayNumbers: false, showWeekdays: false, snapDays: 90 },
};

export const ZOOM_ORDER: ZoomLevel[] = ['day', 'week', 'month', 'quarter', 'year', 'multiyear'];

// Types de relation proposés (source unique : constants/relationTypes.ts)
export const RELATION_TYPES: { id: string; label: string; Icon: LucideIcon; description: string; color: string }[] =
  RELATION_TYPE_LIST.map((m) => ({ id: m.id, label: m.label, Icon: m.Icon, description: m.description, color: m.textClass }));
