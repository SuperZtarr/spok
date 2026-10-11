/*
 * AddChildrenDialog — question posée quand on ajoute à la préparation un élément qui a des sous-éléments directs :
 * « Élément seul » ou « Avec ses N sous-éléments » (ajoutés juste après, dans leur ordre d'origine).
 * Piloté par useActiveLiveSessionStore.pendingAdd (posé par requestAddToAgenda) ; rendu par LiveSessionHost
 * pour fonctionner depuis n'importe quelle page. Annuler (fermeture) n'ajoute rien.
 * Libellés : « préparation » (anciennement « programme », renommé 2026-10-11).
 */
import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useActiveLiveSessionStore } from '../../stores/activeLiveSession';
import { addToAgenda } from '../../lib/liveItemActions';

export function AddChildrenDialog() {
  const pending = useActiveLiveSessionStore((s) => s.pendingAdd);
  const info = useActiveLiveSessionStore((s) => s.info);
  const spaceId = useActiveLiveSessionStore((s) => s.spaceId);
  const setPendingAdd = useActiveLiveSessionStore((s) => s.setPendingAdd);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pending || !info) return null;
  const close = () => { setError(null); setPendingAdd(null); };
  const add = async (includeChildren: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await addToAgenda(info, spaceId, pending.itemId, includeChildren);
      setPendingAdd(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ajout impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={close} title="Ajouter à la préparation" size="small">
      <p className="text-sm mb-4">
        Cet élément a {pending.count} sous-élément{pending.count > 1 ? 's' : ''}. Les ajouter aussi à la préparation, juste après lui ?
      </p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="bordered" disabled={busy} onClick={() => add(false)}>Élément seul</Button>
        <Button type="button" disabled={busy} data-autofocus onClick={() => add(true)}>
          Avec {pending.count > 1 ? `ses ${pending.count} sous-éléments` : 'son sous-élément'}
        </Button>
      </div>
    </Modal>
  );
}
