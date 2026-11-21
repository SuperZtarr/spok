/*
 * MoveToItemDialog — « Déplacer vers… » un contenu ou une donnée sécurisée (2026-11-21) : choix de l'élément cible avec
 * le sélecteur commun (ItemSearchPicker : Cet espace / Communauté / Tous mes espaces, l'élément d'origine exclu).
 * Props : isOpen / onClose ; spaceId, itemId (élément d'origine) ; what (nom du contenu, pour le titre) ; onMove(hit)
 * appelle l'écriture et rejette en cas de refus (droits, plafond) — l'erreur s'affiche sous le champ du sélecteur.
 * Droits vérifiés par l'API sur les DEUX éléments ; aucun contrôle ici. Rappel fonctionnel : FieldHelp item-contents.move.
 * Utilisé par ItemContentsSection (vignettes) et ItemSecretsSection (lignes).
 */
import { Modal } from '../ui/Modal';
import { ItemSearchPicker, type ItemSearchHit } from '../ItemSearchPicker';
import { FieldHelp } from '../../help/FieldHelp';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  itemId: string;
  what: string;
  onMove: (hit: ItemSearchHit) => Promise<unknown>;
}

export function MoveToItemDialog({ isOpen, onClose, spaceId, itemId, what, onMove }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Déplacer « ${what} » vers…`} size="default" devName="MoveToItemDialog">
      <div className="space-y-2">
        <FieldHelp page="item-contents" field="move" />
        <ItemSearchPicker spaceId={spaceId} excludeIds={new Set([itemId])} actionLabel="Déplacer ici" autoFocus
          onPick={async (hit) => { await onMove(hit); onClose(); }} />
      </div>
    </Modal>
  );
}
