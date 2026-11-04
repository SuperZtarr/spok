/*
 * PresenterPanel — panneau des présentateurs : recherche avec portée (ItemSearchPicker, bornée par l'API aux espaces
 * lisibles) puis « Afficher » → copie verrouillée + diffusion.
 * Les résultats issus de l'espace de séance lui-même sont exclus (on n'affiche pas une copie de copie).
 * Props : sessionSpaceId, parentSpaceId (portée « Cet espace »), onDisplay.
 */
import { ItemSearchPicker } from '../ItemSearchPicker';

interface Props {
  sessionSpaceId: string;
  parentSpaceId: string;
  onDisplay: (sourceSpaceId: string, sourceItemId: string) => Promise<void>;
}

export function PresenterPanel({ sessionSpaceId, parentSpaceId, onDisplay }: Props) {
  return (
    <div className="p-3">
      <ItemSearchPicker
        autoFocus
        spaceId={parentSpaceId}
        communitySpaceId={sessionSpaceId}
        excludeSpaceId={sessionSpaceId}
        actionLabel="Afficher"
        onPick={(hit) => onDisplay(hit.spaceId, hit.id)}
      />
    </div>
  );
}
