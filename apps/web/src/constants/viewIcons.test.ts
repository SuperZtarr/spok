/* Contrôle des icônes de vues : toute vue du registre a son icône dans la source unique (viewIcons.ts),
   sinon elle afficherait l'icône de repli sans aucune erreur. */
import { describe, it, expect } from 'vitest';
import { List, ZoomIn } from 'lucide-react';
import { VIEW_REGISTRY, MENU_REGISTRY } from '@spok/shared';
import { getViewIcon, getNavIcon, hasViewIcon } from './viewIcons';

describe('icônes de vues', () => {
  it.each(VIEW_REGISTRY.map((v) => [v.id, v.icon]))('vue %s : icône %s déclarée', (_id, icon) => {
    expect(hasViewIcon(icon)).toBe(true);
  });

  // Source unique aussi pour la navigation globale (2026-11-13, fin des NAV_ICONS recopiées)
  it.each(MENU_REGISTRY.map((m) => [m.key, m.icon]))('entrée de menu %s : icône %s déclarée', (_key, icon) => {
    expect(hasViewIcon(icon)).toBe(true);
    expect(getNavIcon(icon)).not.toBeNull();
  });

  it('renvoie l\'icône demandée, et List si elle est inconnue', () => {
    expect(getViewIcon('ZoomIn')).toBe(ZoomIn);
    expect(getViewIcon('inconnue')).toBe(List);
  });
});
