/* Tests des nouveautés : zone allumée (« C'est noté », Expliquez-moi puis Compris, effacement en mode Aide), cartes d'accueil
   (Montrer vers le dernier espace, « C'est noté », lien vers l'historique), page Toutes les nouveautés (Montrer rallume
   l'annonce, « C'est noté » et mention Vue pour un compte connecté) et choix
   de l'espace à ouvrir. Sources d'annonces fictives (vi.mock) : les tests ne dépendent pas des vraies annonces du moment. */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { spacesApi, userApi } from '../lib/api';
import { NewsPage } from '../pages/NewsPage';
import { useAuthStore } from '../stores/auth';
import { useHelpAnnouncementsStore } from '../stores/helpAnnouncements';
import { useHelpModeStore } from '../stores/helpMode';
import { NewFeatureOverlay } from './NewFeatureOverlay';
import { NewsCards, targetSpaceId } from './NewsCards';
import { NEWS_TEXTS } from './newsTexts';

const DEMO = 'test-annonce';
vi.mock('./announcementSources', () => ({
  ANNOUNCEMENT_SOURCES: [{
    fiche: 'kanban',
    view: 'kanban',
    elements: {
      colonne: {
        title: 'Colonne',
        short: 'Court',
        text: 'Déposez une carte',
        changes: [{ id: 'test-annonce', kind: 'evolution', text: 'Ce qui change' }],
      },
    },
  }],
}));

const zone = <div data-help-zone="kanban:colonne">Colonne</div>;

beforeEach(() => {
  // L'environnement de test ne calcule aucune taille : sans cela, la zone passerait pour hors de l'écran
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 10, 100, 100));
  vi.spyOn(userApi, 'updateHelpState').mockResolvedValue({ onboardingDone: true, handled: [] });
  localStorage.clear();
  act(() => {
    useHelpAnnouncementsStore.setState({ loaded: true, onboardingDone: true, handled: [] });
    useHelpModeStore.setState({ active: false });
  });
});

describe('NewFeatureOverlay', () => {
  it('n\'annonce rien tant que le suivi du compte n\'est pas chargé', () => {
    act(() => useHelpAnnouncementsStore.setState({ loaded: false }));
    render(<>{zone}<NewFeatureOverlay /></>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('enregistre sur le serveur ce qui est traité', () => {
    render(<>{zone}<NewFeatureOverlay /></>);
    fireEvent.click(screen.getByRole('button', { name: NEWS_TEXTS.ignore }));
    expect(userApi.updateHelpState).toHaveBeenCalledWith({ add: [DEMO] });
  });

  it('n\'affiche rien sans la zone à l\'écran', () => {
    render(<NewFeatureOverlay />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('allume la zone avec son badge ; C\'est noté traite l\'annonce', () => {
    render(<>{zone}<NewFeatureOverlay /></>);
    expect(screen.getByText(NEWS_TEXTS.kind.evolution)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: NEWS_TEXTS.ignore }));
    expect(useHelpAnnouncementsStore.getState().handled).toContain(DEMO);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Expliquez-moi montre l\'explication sans traiter l\'annonce ; Compris la traite', () => {
    render(<>{zone}<NewFeatureOverlay /></>);
    fireEvent.click(screen.getByRole('button', { name: NEWS_TEXTS.explain }));
    expect(useHelpAnnouncementsStore.getState().handled).not.toContain(DEMO);
    expect(screen.getByText(/Déposez une carte/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: NEWS_TEXTS.done }));
    expect(useHelpAnnouncementsStore.getState().handled).toContain(DEMO);
  });

  it('passe au-dessus d\'une modale quand sa zone s\'y trouve, sous elle sinon', () => {
    const { unmount } = render(<>{zone}<NewFeatureOverlay /></>);
    expect(screen.getByRole('dialog').className).toContain('z-40');
    unmount();
    render(<><div data-modal-root>{zone}</div><NewFeatureOverlay /></>);
    expect(screen.getByRole('dialog').className).toContain('z-[60]');
  });

  it('s\'efface pendant le mode Aide', () => {
    render(<>{zone}<NewFeatureOverlay /></>);
    act(() => useHelpModeStore.getState().enter());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('NewsCards', () => {
  const cards = (spaces: { id: string }[]) => render(<MemoryRouter><NewsCards spaces={spaces} /></MemoryRouter>);

  it('Montrer ouvre la vue dans l\'espace visé', () => {
    cards([{ id: 's1' }]);
    expect(screen.getByRole('link', { name: NEWS_TEXTS.show }).getAttribute('href')).toBe('/spaces/s1?view=kanban');
  });

  it('sans espace : pas de Montrer', () => {
    cards([]);
    expect(screen.queryByRole('link', { name: NEWS_TEXTS.show })).toBeNull();
  });

  it('C\'est noté retire la carte ; seul le lien vers l\'historique reste', () => {
    const { container } = cards([{ id: 's1' }]);
    fireEvent.click(screen.getByRole('button', { name: NEWS_TEXTS.ignore }));
    expect(container.querySelector('[data-tour="home-news"]')).toBeNull();
    expect(screen.getByRole('link', { name: NEWS_TEXTS.all }).getAttribute('href')).toBe('/news');
  });
});

describe('NewsPage', () => {
  const page = () => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><NewsPage /></MemoryRouter>
    </QueryClientProvider>,
  );

  it('liste aussi une annonce déjà traitée, avec son explication', () => {
    act(() => useHelpAnnouncementsStore.setState({ handled: [DEMO] }));
    page();
    expect(screen.getByText('Ce qui change')).toBeTruthy();
    expect(screen.getByText('Déposez une carte')).toBeTruthy();
    expect(screen.getByText(NEWS_TEXTS.unreleased)).toBeTruthy();
  });

  it('Montrer remet l\'annonce à traiter', async () => {
    vi.spyOn(spacesApi, 'list').mockResolvedValue([{ id: 's1' }] as never);
    act(() => {
      useAuthStore.setState({ user: { id: 'u1' } } as never);
      useHelpAnnouncementsStore.setState({ handled: [DEMO] });
    });
    page();
    fireEvent.click(await screen.findByRole('link', { name: NEWS_TEXTS.show }));
    expect(useHelpAnnouncementsStore.getState().handled).not.toContain(DEMO);
    act(() => useAuthStore.setState({ user: null } as never));
  });

  it('C\'est noté marque l\'annonce comme vue et affiche la mention Vue', () => {
    vi.spyOn(spacesApi, 'list').mockResolvedValue([] as never);
    act(() => useAuthStore.setState({ user: { id: 'u1' } } as never));
    page();
    expect(screen.queryByText(NEWS_TEXTS.seen)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: NEWS_TEXTS.ignore }));
    expect(useHelpAnnouncementsStore.getState().handled).toContain(DEMO);
    expect(screen.getByText(NEWS_TEXTS.seen)).toBeTruthy();
    expect(screen.queryByRole('button', { name: NEWS_TEXTS.ignore })).toBeNull();
    act(() => useAuthStore.setState({ user: null } as never));
  });

  it('sans connexion : ni C\'est noté ni mention Vue', () => {
    page();
    expect(screen.queryByRole('button', { name: NEWS_TEXTS.ignore })).toBeNull();
    expect(screen.queryByText(NEWS_TEXTS.seen)).toBeNull();
  });
});

describe('targetSpaceId', () => {
  it('préfère le dernier espace visité encore accessible', () => {
    localStorage.setItem('spok_recent_spaces', JSON.stringify(['perdu', 's2']));
    expect(targetSpaceId(['s1', 's2'])).toBe('s2');
  });

  it('se rabat sur le premier espace si la liste est absente ou illisible', () => {
    expect(targetSpaceId(['s1', 's2'])).toBe('s1');
    localStorage.setItem('spok_recent_spaces', '{illisible');
    expect(targetSpaceId(['s1', 's2'])).toBe('s1');
  });
});
