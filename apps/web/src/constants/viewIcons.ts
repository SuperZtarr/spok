/*
 * Source unique des icônes nommées de SPOK : nom d'icône Lucide (champ `icon` de VIEW_REGISTRY et de MENU_REGISTRY)
 * → composant. Centralisation des référentiels (2026-11-13) : remplace aussi les deux cartes NAV_ICONS qui étaient
 * recopiées dans GlobalNavBar.tsx et Layout.tsx (celle de Layout avait perdu Sun, icône de « Ma journée »).
 * - getViewIcon(name) : vues d'espace (barre de vues, barre latérale, cartes, accueil public, administration) —
 *   icône inconnue → List.
 * - getNavIcon(name) : navigation globale (bandeau, grille mobile) — icône inconnue → null (pas d'icône).
 * Nouvelle vue ou nouvelle page = son icône ajoutée ICI seulement ; viewIcons.test.ts échoue si une vue du registre
 * ou une entrée de MENU_REGISTRY n'y est pas.
 */
import {
  List, GitBranch, GitMerge, FileText, LayoutGrid, Users, MessageSquare, Table2, Clock,
  ExternalLink, Image, Newspaper, CheckSquare, Tags, Paperclip,
  Columns3, CalendarCheck, GanttChart, Calendar, TrendingDown, Layers, Flame,
  Share2, Network, CircleDot, Waypoints, Circle, Orbit, SquareStack, Disc, Grid3x3, Focus, Workflow, ZoomIn,
  Home, FolderKanban, LayoutDashboard, ClipboardList, Activity, Sun, User, Building2, BarChart3, History,
  AlertTriangle, Settings, Copy, Search, Sparkles, Tag, LogOut, Map as MapIconLucide,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  // vues d'espace
  List, GitBranch, GitMerge, FileText, LayoutGrid, Users, MessageSquare, Table2, Clock,
  ExternalLink, Image, Newspaper, CheckSquare, Tags, Paperclip,
  Columns3, CalendarCheck, GanttChart, Calendar, TrendingDown, Layers, Flame,
  Share2, Network, CircleDot, Waypoints, Circle, Orbit, SquareStack, Disc, Grid3x3, Focus, Workflow, ZoomIn,
  // navigation globale (MENU_REGISTRY)
  Home, FolderKanban, LayoutDashboard, ClipboardList, Activity, Sun, User, Building2, BarChart3, History,
  AlertTriangle, Settings, Copy, Search, Sparkles, Tag, LogOut, MapIcon: MapIconLucide,
};

/** Icône d'une vue d'espace (inconnue → List). */
export function getViewIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? List;
}

/** Icône d'une entrée de la navigation globale (inconnue → null). */
export function getNavIcon(iconName: string): LucideIcon | null {
  return ICON_MAP[iconName] ?? null;
}

/** Vrai si l'icône est déclarée ici (contrôle de couverture, viewIcons.test.ts). */
export function hasViewIcon(iconName: string): boolean {
  return iconName in ICON_MAP;
}
