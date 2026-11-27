/* TNR de l'accès aux articles et aux process (itemOpenMode, itemMenuGroups — 2026-11-26) : adresses de lecture et de
   composition ; menu ⋮ Lire | Modifier | Composer — dans la fiche quand la vue fournit onOpen (la vue reste derrière),
   sinon vers la page de l'article / le canevas du process avec retour à la vue d'origine. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { articleComposeUrl, articlePageUrl, articleReturnState, isComposing, itemUrl, parseItemMode } from './itemOpenMode';
import { buildItemMenuGroups } from './itemMenuGroups';
import { appNavigate } from './appNavigate';

vi.mock('./appNavigate', () => ({ appNavigate: vi.fn() }));

describe('adresses', () => {
  it('composition : page de l\'article ou fiche, par l\'adresse', () => {
    expect(articleComposeUrl('s1', 'a1')).toBe('/spaces/s1/articles/a1?mode=composition');
    expect(isComposing('composition')).toBe(true);
    expect(isComposing(null)).toBe(false);
    expect(itemUrl('s1', 'a1', 'compose')).toBe('/spaces/s1/content?item=a1&mode=composition');
    expect(parseItemMode('composition')).toBe('compose');
  });

  it('page de lecture et retour à la vue d\'origine', () => {
    expect(articlePageUrl('s1', 'a1')).toBe('/spaces/s1/articles/a1');
    expect(articleReturnState({ pathname: '/spaces/s1', search: '?view=thread' })).toEqual({ from: '/spaces/s1?view=thread' });
  });
});

describe('menu ⋮ : Lire | Modifier | Composer (vocabulaire unique, 2026-11-26)', () => {
  beforeEach(() => vi.mocked(appNavigate).mockClear());
  const from = { state: { from: `${window.location.pathname}${window.location.search}` } };

  it('élément ordinaire : Lire et Modifier ouvrent la fiche, pas de Composer', () => {
    const onOpen = vi.fn();
    const actions = buildItemMenuGroups('a1', { onOpen }, { item: { type: 'TASK', spaceId: 's1' } }).flatMap((g) => g.actions);
    expect(actions.filter((a) => ['read', 'edit', 'compose'].includes(a.id)).map((a) => a.label)).toEqual(['Lire', 'Modifier']);
    actions.find((a) => a.id === 'read')!.onClick();
    expect(onOpen).toHaveBeenCalledWith('a1', 'read');
  });

  it('article / process avec onOpen : Lire et Composer dans la fiche', () => {
    for (const type of ['ARTICLE', 'PROCESS']) {
      const onOpen = vi.fn();
      const actions = buildItemMenuGroups('a1', { onOpen }, { item: { type, spaceId: 's1' } }).flatMap((g) => g.actions);
      actions.find((a) => a.id === 'read')!.onClick();
      actions.find((a) => a.id === 'compose')!.onClick();
      expect(onOpen.mock.calls).toEqual([['a1', 'read'], ['a1', 'compose']]);
    }
    expect(appNavigate).not.toHaveBeenCalled();
  });

  it('sans onOpen : page de l\'article / canevas du process, avec retour à la vue d\'origine', () => {
    const article = buildItemMenuGroups('a1', {}, { item: { type: 'ARTICLE', spaceId: 's1' } }).flatMap((g) => g.actions);
    article.find((a) => a.id === 'read')!.onClick();
    expect(appNavigate).toHaveBeenCalledWith('/spaces/s1/articles/a1', from);
    const process = buildItemMenuGroups('p1', {}, { item: { type: 'PROCESS', spaceId: 's1' } }).flatMap((g) => g.actions);
    process.find((a) => a.id === 'compose')!.onClick();
    expect(appNavigate).toHaveBeenCalledWith('/spaces/s1?view=process&process=p1&mode=composition', from);
  });

  it('sans droit de modifier : seulement Lire', () => {
    const actions = buildItemMenuGroups('a1', { onOpen: vi.fn() }, { item: { type: 'ARTICLE', spaceId: 's1' }, canEdit: false }).flatMap((g) => g.actions);
    expect(actions.some((a) => a.id === 'edit' || a.id === 'compose')).toBe(false);
    expect(actions.some((a) => a.id === 'read')).toBe(true);
  });
});
