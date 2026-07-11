/* Constantes du Gantt : hauteurs de lignes, largeurs de colonnes, niveaux de zoom. */
import { Link2, Ban, ArrowRight, type LucideIcon } from 'lucide-react';

// Zoom level configuration
export type ZoomLevel = 'day' | 'week' | 'month' | 'quarter' | 'year';

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
};

export const ZOOM_ORDER: ZoomLevel[] = ['day', 'week', 'month', 'quarter', 'year'];

// Relation types (same as MindMapView)
export const RELATION_TYPES: { id: string; label: string; Icon: LucideIcon; description: string; color: string }[] = [
  { id: 'blocks',     label: 'Bloque',  Icon: Ban,        description: 'Contrainte dure — B ne peut démarrer avant la fin de A', color: 'text-red-500'   },
  { id: 'implements', label: 'Permet',  Icon: ArrowRight, description: 'A permet/rend possible B',                                color: 'text-green-500' },
  { id: 'relates',    label: 'Lié à',   Icon: Link2,      description: 'A et B doivent être traités ensemble',                   color: 'text-blue-500'  },
];
