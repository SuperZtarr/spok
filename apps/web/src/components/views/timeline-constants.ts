import { Link2, Ban, ArrowLeft, Copy, Cog, FlaskConical, type LucideIcon } from 'lucide-react';

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
  week:    { label: 'Semaine',   days: 42,  dayWidth: 40, navStep: 7,  showDayNumbers: true,  showWeekdays: true,  snapDays: 1  },
  month:   { label: 'Mois',      days: 90,  dayWidth: 20, navStep: 30, showDayNumbers: true,  showWeekdays: false, snapDays: 7  },
  quarter: { label: 'Trimestre', days: 180, dayWidth: 8,  navStep: 30, showDayNumbers: false, showWeekdays: false, snapDays: 7  },
  year:    { label: 'Année',     days: 365, dayWidth: 4,  navStep: 90, showDayNumbers: false, showWeekdays: false, snapDays: 30 },
};

export const ZOOM_ORDER: ZoomLevel[] = ['day', 'week', 'month', 'quarter', 'year'];

// Relation types (same as MindMapView)
export const RELATION_TYPES: { id: string; label: string; Icon: LucideIcon; description: string; color: string }[] = [
  { id: 'relates', label: 'Est lié à', Icon: Link2, description: 'Lien simple entre deux éléments', color: 'text-purple-500' },
  { id: 'blocks', label: 'Bloque', Icon: Ban, description: 'A doit être terminé avant B', color: 'text-red-500' },
  { id: 'depends', label: 'Dépend de', Icon: ArrowLeft, description: 'A nécessite B pour avancer', color: 'text-orange-500' },
  { id: 'duplicates', label: 'Duplique', Icon: Copy, description: 'A est un doublon de B', color: 'text-gray-500' },
  { id: 'implements', label: 'Implémente', Icon: Cog, description: 'A réalise/concrétise B', color: 'text-blue-500' },
  { id: 'tests', label: 'Teste', Icon: FlaskConical, description: 'A valide le bon fonctionnement de B', color: 'text-green-500' },
];
