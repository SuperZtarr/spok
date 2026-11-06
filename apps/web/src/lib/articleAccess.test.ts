/* TNR de l'accès aux articles : adresse du mode Composer (itemOpenMode) et action « Lire l'article » du menu ⋮
   (itemMenuGroups) — présente seulement sur un article, vers sa page, avec retour à la vue d'origine. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { articlePageUrl, articleReturnState, itemUrl, parseItemMode } from './itemOpenMode';
import { buildItemMenuGroups } from './itemMenuGroups';
import { appNavigate } from './appNavigate';

vi.mock('./appNavigate', () => ({ appNavigate: vi.fn() }));

const actionsOf = (item?: { type?: string; spaceId?: string | null }) =>
  buildItemMenuGroups('a1', { onOpen: vi.fn() }, { item }).flatMap((g) => g.actions);

describe('adresses d\'un article', () => {
  it('le mode Composer fait l\'aller-retour par l\'adresse', () => {
    const url = itemUrl('s1', 'a1', 'compose');
    expect(url).toBe('/spaces/s1/content?item=a1&mode=composition');
    expect(parseItemMode('composition')).toBe('compose');
  });

  it('page de lecture et retour à la vue d\'origine', () => {
    expect(articlePageUrl('s1', 'a1')).toBe('/spaces/s1/articles/a1');
    expect(articleReturnState({ pathname: '/spaces/s1', search: '?view=thread' })).toEqual({ from: '/spaces/s1?view=thread' });
  });
});

describe('menu ⋮ : Lire l\'article', () => {
  beforeEach(() => vi.mocked(appNavigate).mockClear());

  it('absent sur un autre type ou sans élément', () => {
    expect(actionsOf({ type: 'NOTE', spaceId: 's1' }).some((a) => a.id === 'read-article')).toBe(false);
    expect(actionsOf().some((a) => a.id === 'read-article')).toBe(false);
  });

  it('sur un article, va à sa page en gardant la vue d\'origine', () => {
    const action = actionsOf({ type: 'ARTICLE', spaceId: 's1' }).find((a) => a.id === 'read-article');
    expect(action).toBeDefined();
    action!.onClick();
    expect(appNavigate).toHaveBeenCalledWith('/spaces/s1/articles/a1', { state: { from: `${window.location.pathname}${window.location.search}` } });
  });
});
