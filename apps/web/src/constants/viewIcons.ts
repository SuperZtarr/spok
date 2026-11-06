/*
 * Source unique des icônes de vues : nom d'icône Lucide (champ `icon` de VIEW_REGISTRY) → composant.
 * Utilisée par la barre de vues, la barre latérale, les cartes d'espace, la présentation d'un espace, l'accueil public
 * et l'administration des espaces. Nouvelle vue = son icône ajoutée ici, jamais de liste locale dans une page :
 * viewIcons.test.ts échoue si une vue du registre n'y est pas. Icône inconnue : getViewIcon renvoie List.
 */
import {
  List, GitBranch, GitMerge, FileText, LayoutGrid, Users, MessageSquare, Table2, Clock,
  ExternalLink, Image, Newspaper, Bug, CheckSquare,
  Columns3, CalendarCheck, GanttChart, Calendar, TrendingDown, Layers, Flame,
  Share2, Network, CircleDot, Waypoints, Circle, Orbit, SquareStack, Disc, Grid3x3, Focus, Workflow, ZoomIn,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  List, GitBranch, GitMerge, FileText, LayoutGrid, Users, MessageSquare, Table2, Clock,
  ExternalLink, Image, Newspaper, Bug, CheckSquare,
  Columns3, CalendarCheck, GanttChart, Calendar, TrendingDown, Layers, Flame,
  Share2, Network, CircleDot, Waypoints, Circle, Orbit, SquareStack, Disc, Grid3x3, Focus, Workflow, ZoomIn,
};

export function getViewIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? List;
}

/** L'icône est-elle déclarée ? Sert au contrôle de viewIcons.test.ts : sans ce test, un oubli passe inaperçu (repli sur List). */
export function hasViewIcon(iconName: string): boolean {
  return iconName in ICON_MAP;
}
