/* Tests de useDialogFocus : focus initial, rotation Tab dans la modale, pile de modales, restauration. */
import { useRef } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { useDialogFocus } from './useDialogFocus';

function Dialog({ open, children, testId = 'panel' }: { open: boolean; children?: React.ReactNode; testId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, open);
  if (!open) return null;
  return <div ref={ref} data-testid={testId}>{children}</div>;
}

describe('useDialogFocus', () => {
  it('donne le focus à l\'élément data-autofocus à l\'ouverture', () => {
    const { getByText } = render(
      <Dialog open><button>Confirmer</button><button data-autofocus>Annuler</button></Dialog>,
    );
    expect(document.activeElement).toBe(getByText('Annuler'));
  });

  it('donne le focus au panneau sans cible data-autofocus', () => {
    const { getByTestId } = render(<Dialog open><button>OK</button></Dialog>);
    expect(document.activeElement).toBe(getByTestId('panel'));
  });

  it('respecte un champ déjà focalisé par autoFocus', () => {
    const { getByPlaceholderText } = render(
      <Dialog open><input placeholder="Titre" autoFocus /><button data-autofocus>X</button></Dialog>,
    );
    expect(document.activeElement).toBe(getByPlaceholderText('Titre'));
  });

  it('fait tourner Tab / Maj+Tab à l\'intérieur de la modale', () => {
    const { getByText } = render(<Dialog open><button>Premier</button><button>Dernier</button></Dialog>);
    getByText('Dernier').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(getByText('Premier'));
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(getByText('Dernier'));
  });

  it('seule la modale du dessus capte Tab', () => {
    const { getByText } = render(
      <>
        <Dialog open testId="bas"><button>Bas</button></Dialog>
        <Dialog open testId="haut"><button>Haut 1</button><button>Haut 2</button></Dialog>
      </>,
    );
    getByText('Haut 2').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(getByText('Haut 1'));
  });

  it('rend le focus à l\'élément d\'origine à la fermeture', () => {
    function Host({ open }: { open: boolean }) {
      return (
        <>
          <button>Déclencheur</button>
          <Dialog open={open}><button>Dedans</button></Dialog>
        </>
      );
    }
    const { getByText, rerender } = render(<Host open={false} />);
    getByText('Déclencheur').focus();
    rerender(<Host open />);
    expect(document.activeElement).not.toBe(getByText('Déclencheur'));
    rerender(<Host open={false} />);
    expect(document.activeElement).toBe(getByText('Déclencheur'));
  });
});
