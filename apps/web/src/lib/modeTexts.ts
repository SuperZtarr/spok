/*
 * Textes générés depuis le registre des modes (MODE_REGISTRY, @spok/shared) et le registre des vues — centralisation
 * des référentiels (2026-11-13) : aucun texte de l'interface n'énumère les modes, leurs favoris ou leurs vues
 * d'ouverture à la main. Infobulles des boutons de mode (Layout), options du contexte (CommunitySettingsPage),
 * aide (fiches *.help.ts, shellZones) et businessRules lisent ces fonctions.
 * Changer un mode ou un favori = MODE_REGISTRY seulement ; ces phrases suivent.
 */
import { MODE_REGISTRY, VIEW_REGISTRY, SPACE_VIEW_SECTIONS, getInterfaceMode, type InterfaceMode } from '@spok/shared';

const VIEW_LABEL = new Map(VIEW_REGISTRY.map((v) => [v.id, v.label]));
const viewLabel = (id: string) => VIEW_LABEL.get(id) ?? id;

/** « a, b et c » */
function joinFr(list: string[]): string {
  return list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} et ${list[list.length - 1]}`;
}

/** Libellés des favoris d'un mode, dans l'ordre : « Discussions, Texte, Récents… » */
export function favoritesLabel(mode: string): string {
  return getInterfaceMode(mode).favorites.map(viewLabel).join(', ');
}

/** Infobulle d'un mode : « Sujets et discussions : favoris Discussions, Texte… » */
export function modeHint(mode: string): string {
  const m = getInterfaceMode(mode);
  return `${m.description} : favoris ${favoritesLabel(m.id)}`;
}

/** Liste des modes : « Forum, Projet, Loisirs, Documentation, Exploration, Tous » */
export function modesList(): string {
  return MODE_REGISTRY.map((m) => m.label).join(', ');
}

/** Contextes de communauté proposés (modes qui en ont un) : « Forum, Projet, Loisirs, Documentation, Exploration » */
export function contextsList(): string {
  return MODE_REGISTRY.filter((m) => m.context).map((m) => m.label).join(', ');
}

/** Contexte enregistré → mode : « FORUM→Forum, …, sinon Tous » */
export function contextModeSentence(): string {
  const withContext = MODE_REGISTRY.filter((m) => m.context).map((m) => `${m.context}→${m.label}`);
  const fallback = MODE_REGISTRY.find((m) => !m.context);
  return `${withContext.join(', ')}${fallback ? `, sinon ${fallback.label}` : ''}`;
}

/** Catégories de vues : « Contenus, Organisation, Suivi, Planification, Exploration » */
export function viewCategoriesList(): string {
  return SPACE_VIEW_SECTIONS.map((s) => s.label).join(', ');
}

/** Vue d'ouverture par contexte : « Forum → Discussions, …, Neutre → Liste » */
export function openingViewsSentence(): string {
  return MODE_REGISTRY.map((m) => `${'contextLabel' in m ? m.contextLabel : m.label} → ${viewLabel(m.openingView)}`).join(', ');
}

/** Favoris de chaque mode : « Forum = Discussions, Texte… ; Projet = … » */
export function favoritesByModeSentence(): string {
  return MODE_REGISTRY.map((m) => `${m.label} = ${favoritesLabel(m.id)}`).join(' ; ');
}

/** Modes à fiche d'élément réduite : « Forum et Loisirs » */
export function collapsedModesLabel(): string {
  return joinFr(MODE_REGISTRY.filter((m) => m.itemModalCollapsed).map((m) => m.label));
}

/** Choix du contexte d'une communauté ('NONE' = neutre, null en base), dans l'ordre du registre, Neutre en tête. */
export type ContextChoice = 'NONE' | NonNullable<(typeof MODE_REGISTRY)[number]['context']>;
export function contextOptions(): { value: ContextChoice; mode: InterfaceMode; label: string; description: string }[] {
  const options = MODE_REGISTRY.map((m) => ({
    value: (m.context ?? 'NONE') as ContextChoice,
    mode: m.id as InterfaceMode,
    label: 'contextLabel' in m ? m.contextLabel : m.label,
    description: modeHint(m.id),
  }));
  return [...options.filter((o) => o.value === 'NONE'), ...options.filter((o) => o.value !== 'NONE')];
}
