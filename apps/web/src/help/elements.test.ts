/* Tests du format « élément d'aide » : un texte unique dérivé vers tous les affichages, règle de publication des annonces
   (sans date = local seulement) et destination de « Montrer ». Fiches d'annonces de test : pas de dépendance aux vraies annonces. */
import { describe, it, expect } from 'vitest';
import { help as kanban } from '../components/views/help/kanban.help';
import { announcementHref, announcementsFrom } from './announcements';
import { ANNOUNCEMENT_SOURCES } from './announcementSources';
import { SPACE_TOOLBAR_STEPS } from './commonTourSteps';
import { elementTourSteps, helpFromElements, toDriveStep, zoneSelector } from './elements';
import { NEWS_BADGE_CLASS, NEWS_TOUR_CLASS } from './newsTexts';
import { SHELL_ZONES } from './shellZones';
import { SPACE_TOOLBAR_ELEMENTS } from './spaceToolbar.elements';
import { SPACE_TOOLBAR_HINTS } from './spaceToolbar.hints';

const elements = {
  zone: { title: 'Titre', short: 'Court', text: 'Explication', side: 'right' as const },
};

describe('éléments d\'aide', () => {
  it('dérive conseils, zones et infobulles du même élément', () => {
    const derived = helpFromElements(elements);
    expect(derived.zones?.zone).toEqual({ title: 'Titre', text: 'Explication' });
    expect(derived.hints?.zone).toBe('Court');
    expect(derived.tips).toEqual(['Titre : Explication']);
  });

  it('dérive une étape de tour pointée sur la zone', () => {
    expect(elementTourSteps('fiche', elements)).toEqual([{
      element: zoneSelector('fiche', 'zone'),
      popover: { title: 'Titre', description: 'Explication', side: 'right' },
    }]);
  });

  it('le Kanban affiche le même texte dans le mode Aide et le tutoriel', () => {
    const texte = kanban.elements!.carte.text;
    expect(kanban.zones!.carte.text).toBe(texte);
    expect(kanban.tour.find((step) => step.element === zoneSelector('kanban', 'carte'))?.popover.description).toBe(texte);
  });
});

describe('changements dans le tutoriel', () => {
  const avecChangement = {
    zone: { ...elements.zone, changes: [{ id: 'c', kind: 'evolution' as const, text: 'Ce qui change' }] },
  };
  const drive = (includeUndated: boolean, handled: string[] = [], onSeen: (id: string) => void = () => {}) =>
    toDriveStep(elementTourSteps('fiche', avecChangement, includeUndated)[0], handled, onSeen);

  it('l\'étape montre le même badge et le même texte tant que le changement n\'est pas traité', () => {
    const description = drive(true).popover?.description;
    expect(description).toContain('Explication');
    expect(description).toContain(`<span class="${NEWS_BADGE_CLASS}">Évolution</span>`);
    expect(description).toContain('Ce qui change');
  });

  it('une fois traité, le changement laisse la seule explication', () => {
    expect(drive(true, ['c']).popover?.description).toBe('Explication');
  });

  it('un changement sans date reste hors du tutoriel en production', () => {
    expect(drive(false).popover?.description).toBe('Explication');
  });

  it('voir l\'étape traite le changement et colore sa zone', () => {
    const seen: string[] = [];
    const step = drive(true, [], (id) => seen.push(id));
    const el = document.createElement('div');
    step.onHighlighted?.(el, step, {} as never);
    expect(seen).toEqual(['c']);
    expect(el.classList.contains(NEWS_TOUR_CLASS)).toBe(true);
    step.onDeselected?.(el, step, {} as never);
    expect(el.classList.contains(NEWS_TOUR_CLASS)).toBe(false);
  });

});

describe('barre commune', () => {
  it('survol, tutoriel et mode Aide reprennent le même élément', () => {
    const filtre = SPACE_TOOLBAR_ELEMENTS.filtre;
    expect(SPACE_TOOLBAR_HINTS.filter).toBe(filtre.short);
    expect(SHELL_ZONES['toolbar-filtre'].text).toBe(filtre.text);
    expect(SPACE_TOOLBAR_STEPS.find((step) => step.element === filtre.target)?.popover.description).toBe(filtre.text);
  });

  it('le tutoriel du Kanban parcourt toute la barre', () => {
    for (const element of Object.values(SPACE_TOOLBAR_ELEMENTS)) {
      expect(kanban.tour.some((step) => step.element === element.target), element.title).toBe(true);
    }
  });
});

describe('annonces', () => {
  const change = (id: string, date?: string) => ({ id, kind: 'new' as const, text: 'Texte', date });
  const element = (id: string, date?: string, target?: string) => ({ ...elements.zone, target, changes: [change(id, date)] });
  const sources = [
    { fiche: 'kanban', view: 'kanban', elements: { colonne: element('vue') } },
    { fiche: 'search', route: '/search', elements: { mots: element('page', '2026-11-01') } },
    { fiche: 'toolbar', inSpace: true, elements: { filtre: element('barre', '2026-11-02', '[data-tour="toolbar-filter"]') } },
    { fiche: 'item-modal', elements: { type: element('modale', '2026-10-01') } },
  ];
  const byId = (id: string) => announcementsFrom(sources, true).find((a) => a.id === id)!;

  it('une annonce sans date reste en local : elle ne peut pas partir en production', () => {
    expect(announcementsFrom(sources, true).map((a) => a.id)).toContain('vue');
    expect(announcementsFrom(sources, false).map((a) => a.id)).not.toContain('vue');
  });

  it('classe de la plus récente à la plus ancienne, les annonces sans date en tête', () => {
    expect(announcementsFrom(sources, true).map((a) => a.id)).toEqual(['vue', 'barre', 'page', 'modale']);
  });

  it('une annonce pointe sa zone, ou le repère de sa commande', () => {
    expect(byId('vue').selector).toBe('[data-help-zone="kanban:colonne"]');
    expect(byId('barre').selector).toBe('[data-tour="toolbar-filter"]');
  });

  it('Montrer ouvre la vue, l\'espace ou la page ; rien pour une modale', () => {
    expect(announcementHref(byId('vue'), 's1')).toBe('/spaces/s1?view=kanban');
    expect(announcementHref(byId('barre'), 's1')).toBe('/spaces/s1');
    expect(announcementHref(byId('page'), undefined)).toBe('/search');
    expect(announcementHref(byId('modale'), 's1')).toBeUndefined();
  });

  it('sans espace, une fonction d\'espace ne peut pas être montrée', () => {
    expect(announcementHref(byId('vue'), undefined)).toBeUndefined();
    expect(announcementHref(byId('barre'), undefined)).toBeUndefined();
  });

  it('les sources réelles couvrent les vues, les pages et la barre', () => {
    const fiches = ANNOUNCEMENT_SOURCES.map((source) => source.fiche);
    expect(fiches).toEqual(expect.arrayContaining(['kanban', 'search', 'toolbar']));
  });
});
