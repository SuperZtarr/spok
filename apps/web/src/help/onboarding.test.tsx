/* Tests du tutoriel d'accueil : proposition selon le suivi du compte, nouveautés déjà présentes comptées comme vues à la première
   réponse seulement, enregistrement côté serveur, clignotement du « ? » une seule fois. Sources d'annonces fictives (vi.mock). */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { treatOnboarding, useOnboarding, usePageTourPulse } from '../hooks/useOnboarding';
import { userApi } from '../lib/api';
import { useHelpAnnouncementsStore } from '../stores/helpAnnouncements';

vi.mock('./announcementSources', () => ({
  ANNOUNCEMENT_SOURCES: [{
    fiche: 'kanban',
    view: 'kanban',
    elements: { colonne: { title: 'T', short: 'C', text: 'E', changes: [{ id: 'annonce', kind: 'new', text: 'Texte' }] } },
  }],
}));

const handled = () => useHelpAnnouncementsStore.getState().handled;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  vi.spyOn(userApi, 'updateHelpState').mockResolvedValue({ onboardingDone: true, handled: [] });
  useHelpAnnouncementsStore.setState({ loaded: true, onboardingDone: false, handled: [] });
});
afterEach(() => { vi.useRealTimers(); });

describe('proposition du tutoriel', () => {
  it('s\'affiche pour un nouvel arrivant', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.showWelcome).toBe(true);
  });

  it('ne s\'affiche pas tant que le suivi n\'est pas chargé, ni pour un compte qui a déjà répondu', () => {
    act(() => useHelpAnnouncementsStore.setState({ loaded: false, onboardingDone: null }));
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.showWelcome).toBe(false);
    act(() => useHelpAnnouncementsStore.setState({ loaded: true, onboardingDone: true }));
    expect(result.current.showWelcome).toBe(false);
  });

  it('la passer la ferme, compte les nouveautés présentes comme vues et l\'enregistre', () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => result.current.closeWelcome());
    expect(result.current.showWelcome).toBe(false);
    expect(handled()).toContain('annonce');
    expect(userApi.updateHelpState).toHaveBeenCalledWith({ onboardingDone: true, add: ['annonce'] });
  });

  it('une fois traitée, une annonce remise à traiter n\'est plus avalée', () => {
    treatOnboarding();
    act(() => useHelpAnnouncementsStore.getState().unmarkHandled('annonce'));
    treatOnboarding();
    expect(handled()).not.toContain('annonce');
  });
});

describe('suivi du compte', () => {
  it('le chargement reprend l\'état du serveur, et clear le vide pour le compte suivant', async () => {
    vi.spyOn(userApi, 'getHelpState').mockResolvedValue({ onboardingDone: true, handled: ['x'] });
    act(() => useHelpAnnouncementsStore.getState().clear());
    expect(useHelpAnnouncementsStore.getState().loaded).toBe(false);
    await useHelpAnnouncementsStore.getState().load();
    expect(useHelpAnnouncementsStore.getState()).toMatchObject({ loaded: true, onboardingDone: true, handled: ['x'] });
    act(() => useHelpAnnouncementsStore.getState().clear());
    expect(handled()).toEqual([]);
  });

  it('sans réponse du serveur, rien n\'est proposé', async () => {
    vi.spyOn(userApi, 'getHelpState').mockRejectedValue(new Error('hors ligne'));
    act(() => useHelpAnnouncementsStore.getState().clear());
    await useHelpAnnouncementsStore.getState().load();
    expect(useHelpAnnouncementsStore.getState()).toMatchObject({ loaded: false, onboardingDone: null });
  });
});

describe('clignotement du « ? »', () => {
  const steps = [{ popover: { title: 'T', description: 'D' } }];

  it('une seule fois, même sans lancer le tour', () => {
    const first = renderHook(() => usePageTourPulse('page', steps));
    act(() => { vi.advanceTimersByTime(900); });
    expect(first.result.current.pulseHelp).toBe(true);
    first.unmount();
    const second = renderHook(() => usePageTourPulse('page', steps));
    act(() => { vi.advanceTimersByTime(900); });
    expect(second.result.current.pulseHelp).toBe(false);
  });
});
