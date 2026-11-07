/* Résolution de la zone survolée par DevZoneInspector : une modale reste une limite, même rendue dans <main>. */
// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { findDevTarget } from './DevZoneInspector';

const q = (id: string) => document.getElementById(id);

describe('findDevTarget', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main data-devzone="contenu">
        <p id="page"></p>
        <div data-modal-root>
          <div id="fond"></div>
          <div role="dialog" data-dev-name="ItemEditModal" id="panneau">
            <span id="hors-zone"></span>
            <div data-devzone="item-entete"><span id="dans-zone"></span></div>
          </div>
          <div role="dialog" id="sans-nom"><span id="sans-nom-enfant"></span></div>
        </div>
      </main>
      <div data-devzone="zone-inconnue"><span id="inconnue"></span></div>`;
  });

  it('page : zone de la page', () => {
    expect(findDevTarget(q('page'))?.name).toBe('contenu');
  });

  it('dans une zone de la modale : cette zone', () => {
    expect(findDevTarget(q('dans-zone'))?.name).toBe('item-entete');
  });

  it('modale hors zone : la modale et son nom, jamais la zone de la page', () => {
    const hit = findDevTarget(q('hors-zone'));
    expect(hit?.name).toBe('ItemEditModal');
    expect(hit?.el).toBe(q('panneau'));
  });

  it('modale sans nom : libellé générique', () => {
    expect(findDevTarget(q('sans-nom-enfant'))?.name).toBe('modale');
  });

  it('fond de la modale : rien', () => {
    expect(findDevTarget(q('fond'))).toBeNull();
  });

  it('zone sans couleur : rien', () => {
    expect(findDevTarget(q('inconnue'))).toBeNull();
  });
});
