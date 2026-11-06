/*
 * TNR des règles portées par VIEW_REGISTRY (@spok/shared, seule source) : un visiteur non connecté a les mêmes
 * vues qu'un connecté, seul le niveau admin reste réservé (décision Thomas 2026-11-06) ; les vues masquées sur
 * mobile se dérivent du registre.
 * Ne pas recopier ici la liste des vues : le registre reste la référence, une nouvelle vue n'impose rien dans ce test.
 */
import { describe, expect, it } from 'vitest';
import { MOBILE_HIDDEN_VIEWS, VIEW_REGISTRY } from '@spok/shared';

describe('accès des vues', () => {
  it('aucune vue au niveau « connecté » : public pour tous, ou admin', () => {
    expect(VIEW_REGISTRY.filter((v) => v.access === 'user').map((v) => v.id)).toEqual([]);
  });
});

describe('vues masquées sur mobile', () => {
  it('reprend exactement les vues marquées mobileHidden du registre', () => {
    expect([...MOBILE_HIDDEN_VIEWS].sort()).toEqual(VIEW_REGISTRY.filter((v) => v.mobileHidden).map((v) => v.id).sort());
  });

  it('la vue Process est masquée, la Liste reste disponible', () => {
    expect(MOBILE_HIDDEN_VIEWS.has('process')).toBe(true);
    expect(MOBILE_HIDDEN_VIEWS.has('list')).toBe(false);
  });
});
