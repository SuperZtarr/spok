import {
  List, GitBranch, GitMerge, FileText, LayoutGrid, Users, MessageSquare, Table2, Clock,
  ExternalLink, Image, Bug, CheckSquare,
  Columns3, CalendarCheck, GanttChart, Calendar, TrendingDown, Layers, Flame,
  Share2, Network, CircleDot, Waypoints, Circle, Orbit, SquareStack, Disc, Grid3x3, Focus,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  List, GitBranch, GitMerge, FileText, LayoutGrid, Users, MessageSquare, Table2, Clock,
  ExternalLink, Image, Bug, CheckSquare,
  Columns3, CalendarCheck, GanttChart, Calendar, TrendingDown, Layers, Flame,
  Share2, Network, CircleDot, Waypoints, Circle, Orbit, SquareStack, Disc, Grid3x3, Focus,
};

export function getViewIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? List;
}
