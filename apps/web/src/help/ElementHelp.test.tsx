/* Tests du « ? » de section (ElementHelp) : explication complète toujours affichée, nouveauté non traitée ajoutée avec
   son badge puis traitée à l'ouverture, rien sans élément. Fiche réelle item-modal (élément modes, annonce item-section-help). */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ElementHelp } from './ElementHelp';
import { PAGE_HELP } from './pageHelp';
import { useHelpAnnouncementsStore } from '../stores/helpAnnouncements';
import { userApi } from '../lib/api';

const modes = PAGE_HELP['item-modal'].elements!.modes;

beforeEach(() => {
  vi.spyOn(userApi, 'updateHelpState').mockResolvedValue({ onboardingDone: true, handled: [] });
  useHelpAnnouncementsStore.setState({ loaded: true, onboardingDone: true, handled: [] });
});

describe('ElementHelp', () => {
  it("affiche l'explication complète de la section au clic", () => {
    render(<ElementHelp page="item-modal" element="modes" />);
    fireEvent.click(screen.getByRole('button', { name: `Aide : ${modes.title}` }));
    expect(screen.getByRole('dialog')).toHaveTextContent(modes.text);
  });

  it("ajoute la nouveauté non traitée et la traite à l'ouverture", () => {
    render(<ElementHelp page="item-modal" element="modes" />);
    fireEvent.click(screen.getByRole('button', { name: `Aide : ${modes.title}` }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Évolution');
    expect(useHelpAnnouncementsStore.getState().handled).toContain('item-section-help');
  });

  it('garde seulement l\'explication une fois la nouveauté traitée', () => {
    useHelpAnnouncementsStore.setState({ handled: ['item-section-help'] });
    render(<ElementHelp page="item-modal" element="modes" />);
    fireEvent.click(screen.getByRole('button', { name: `Aide : ${modes.title}` }));
    expect(screen.getByRole('dialog')).not.toHaveTextContent('Évolution');
    expect(screen.getByRole('dialog')).toHaveTextContent(modes.text);
  });

  it("ne rend rien pour un élément absent de la fiche", () => {
    const { container } = render(<ElementHelp page="item-modal" element="inexistant" />);
    expect(container).toBeEmptyDOMElement();
  });
});
