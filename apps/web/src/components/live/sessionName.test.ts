/* Nom par défaut d'une séance : « Séance » + date locale du jour (demande Thomas 2026-10-15). */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { defaultSessionName, todayLocal } from './sessionName';

describe('sessionName', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('todayLocal : date locale AAAA-MM-JJ', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 5, 23, 30));
    expect(todayLocal()).toBe('2026-10-05');
  });

  it('defaultSessionName : préfixé de « Séance »', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 15, 9, 0));
    expect(defaultSessionName()).toBe('Séance 2026-10-15');
  });
});
