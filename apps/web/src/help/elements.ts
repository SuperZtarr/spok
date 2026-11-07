/*
 * Élément d'aide unique (pilote Kanban, décision Thomas 2026-11-07) : une fonction = un élément, écrit une fois dans la
 * fiche de son composant. Ces fonctions en dérivent les champs lus par les affichages existants, pour que survol,
 * « ? », mode Aide et tutoriel montrent le même texte sans le recopier.
 * Params : fiche (clé de la fiche, 1re partie de data-help-zone), elements (éléments par clé de zone).
 * Usage : ...helpFromElements(elements) dans une HelpEntry, puis tour: [intro, ...elementTourSteps(...), ...].
 * Une nouveauté fait partie de l'étape de sa fonction : toDriveStep y ajoute son badge et son texte tant que
 * l'utilisateur ne l'a pas traitée, et voir l'étape la traite. Ensuite, l'étape reste avec la seule explication : celle-ci
 * doit donc décrire le comportement actuel, et le texte du changement seulement ce qui vient de changer.
 * Ne pas réécrire à la main dans la fiche un texte qui vient d'un élément : les deux divergeraient.
 */
import type { DriveStep } from 'driver.js';
import { NEWS_BADGE_CLASS, NEWS_TEXTS, NEWS_TOUR_CLASS } from './newsTexts';
import type { HelpChange, HelpElement, HelpEntry, HelpZone, TourStep } from './types';

export type HelpElements = Record<string, HelpElement>;

/** Sélecteur de la zone d'un élément : le même repère sert au mode Aide, au tutoriel et aux nouveautés. */
export const zoneSelector = (fiche: string, zone: string) => `[data-help-zone="${fiche}:${zone}"]`;

/** Un changement sans date n'est visible qu'en développement local : il ne peut pas partir en production. */
export const isPublished = (change: HelpChange, includeUndated: boolean = import.meta.env.DEV) => !!change.date || includeUndated;

/** Étapes de tutoriel des éléments, dans leur ordre de déclaration. */
export function elementTourSteps(fiche: string, elements: HelpElements, includeUndated?: boolean): TourStep[] {
  return Object.entries(elements).map(([zone, element]) => {
    const changes = (element.changes ?? []).filter((change) => isPublished(change, includeUndated));
    return {
      element: element.target ?? zoneSelector(fiche, zone),
      popover: { title: element.title, description: element.text, side: element.side },
      changes: changes.length > 0 ? changes : undefined,
    };
  });
}

/** Étape prête pour driver.js. La description est du HTML, affiché tel quel : n'y faire entrer que des textes de fiche. */
export function toDriveStep(step: TourStep, handled: string[], onSeen: (id: string) => void): DriveStep {
  const { changes, ...drive } = step;
  const pending = (changes ?? []).filter((change) => !handled.includes(change.id));
  if (pending.length === 0) return drive;
  const badges = pending
    .map((change) => `<span class="block mt-2"><span class="${NEWS_BADGE_CLASS}">${NEWS_TEXTS.kind[change.kind]}</span> ${change.text}</span>`)
    .join('');
  return {
    ...drive,
    popover: { ...drive.popover, description: drive.popover.description + badges },
    onHighlighted: (element) => {
      element?.classList.add(NEWS_TOUR_CLASS);
      pending.forEach((change) => onSeen(change.id));
    },
    onDeselected: (element) => element?.classList.remove(NEWS_TOUR_CLASS),
  };
}

/** Conseils, zones du mode Aide et infobulles dérivés des éléments. */
export function helpFromElements(elements: HelpElements): Pick<HelpEntry, 'elements' | 'tips' | 'zones' | 'hints'> {
  const zones: Record<string, HelpZone> = {};
  const hints: Record<string, string> = {};
  for (const [key, element] of Object.entries(elements)) {
    if (!element.noZone) zones[key] = { title: element.title, text: element.text };
    hints[key] = element.short;
  }
  return {
    elements,
    tips: Object.values(elements).map((element) => `${element.title} : ${element.text}`),
    zones,
    hints,
  };
}
