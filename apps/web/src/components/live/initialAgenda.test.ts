/* Tests de la préparation initiale d'une séance : choix proposés (premier niveau, ordre, sous-éléments), défauts, envoi. */
import { buildAgendaChoices, defaultSelection, toAgendaPayload } from './initialAgenda';

const items = [
  { id: 'b', title: 'Bilan', parentId: null, position: 2 },
  { id: 'a', title: 'Accueil', parentId: null, position: 1 },
  { id: 'a1', title: 'Accueil 1', parentId: 'a', position: 1 },
  { id: 'a2', title: 'Accueil 2', parentId: 'a', position: 2 },
  { id: 'c', title: '', parentId: null, position: 3 },
] as any[];

describe('buildAgendaChoices', () => {
  it('premier niveau seulement, dans l\'ordre, avec le nombre de sous-éléments', () => {
    expect(buildAgendaChoices(items)).toEqual([
      { id: 'a', title: 'Accueil', childCount: 2 },
      { id: 'b', title: 'Bilan', childCount: 0 },
      { id: 'c', title: 'Sans titre', childCount: 0 },
    ]);
  });
});

describe('defaultSelection + toAgendaPayload', () => {
  const choices = buildAgendaChoices(items);

  it('par défaut : tout coché, avec les sous-éléments', () => {
    expect(toAgendaPayload(choices, defaultSelection(choices))).toEqual([
      { sourceItemId: 'a', includeChildren: true },
      { sourceItemId: 'b' },
      { sourceItemId: 'c' },
    ]);
  });

  it('décocher retire l\'élément ; « seul » coupe les sous-éléments', () => {
    const sel = defaultSelection(choices);
    sel.b.checked = false;
    sel.a.withChildren = false;
    expect(toAgendaPayload(choices, sel)).toEqual([
      { sourceItemId: 'a', includeChildren: false },
      { sourceItemId: 'c' },
    ]);
  });

  it('tout décoché : préparation vide', () => {
    const sel = defaultSelection(choices);
    for (const k of Object.keys(sel)) sel[k].checked = false;
    expect(toAgendaPayload(choices, sel)).toEqual([]);
  });
});
