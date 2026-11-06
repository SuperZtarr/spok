/*
 * Résolution des zones du mode Aide. Deux marquages, sans wrapper DOM :
 * - cadre et barre d'espace : data-devzone="<nom>" (texte dans SHELL_ZONES) ;
 * - vues (puis pages/modales) : data-help-zone="<fiche>:<zone>" (texte dans VIEW_HELP[fiche].zones, sinon
 *   PAGE_HELP[fiche].zones).
 * S'y ajoute le rappel d'une commande : data-help-hint, posé par HelpHint avec son texte. Il passe avant la zone qui
 * contient la commande ; son titre vient de la commande elle-même (aria-label ou texte court).
 * findHelpZone remonte du nœud survolé à la zone la plus interne QUI A un texte (une zone sans texte est traversée).
 */
import type { HelpZone } from './types';
import { SHELL_ZONES } from './shellZones';
import { VIEW_HELP } from '../components/views/help';
import { PAGE_HELP } from './pageHelp';
import { TOUCH_HELP } from './touch';

const ZONE_SELECTOR = '[data-help-hint],[data-help-zone],[data-devzone]';
const MAX_HINT_TITLE = 40;

/** Nom d'une commande enveloppée par HelpHint. Un champ n'a pas de nom lisible : son texte serait la liste des options. */
function hintTitle(el: HTMLElement): string {
  const label = el.querySelector('[aria-label]')?.getAttribute('aria-label');
  if (label) return label;
  const content = el.querySelector('select, input') ? '' : el.textContent?.trim() ?? '';
  return content && content.length <= MAX_HINT_TITLE ? content : TOUCH_HELP.genericCommand;
}

export function zoneText(id: string): HelpZone | undefined {
  const sep = id.indexOf(':');
  if (sep === -1) return SHELL_ZONES[id];
  const fiche = id.slice(0, sep);
  const zone = id.slice(sep + 1);
  const views = VIEW_HELP as Record<string, { zones?: Record<string, HelpZone> } | undefined>;
  const pages = PAGE_HELP as Record<string, { zones?: Record<string, HelpZone> } | undefined>;
  return views[fiche]?.zones?.[zone] ?? pages[fiche]?.zones?.[zone];
}

export function findHelpZone(target: Element | null): { el: HTMLElement; id: string; zone: HelpZone } | null {
  let el = target?.closest<HTMLElement>(ZONE_SELECTOR) ?? null;
  while (el) {
    if (el.dataset.helpHint) return { el, id: 'hint', zone: { title: hintTitle(el), text: el.dataset.helpHint } };
    const id = el.dataset.helpZone ?? el.dataset.devzone ?? '';
    const zone = zoneText(id);
    if (zone) return { el, id, zone };
    el = el.parentElement?.closest<HTMLElement>(ZONE_SELECTOR) ?? null;
  }
  return null;
}
