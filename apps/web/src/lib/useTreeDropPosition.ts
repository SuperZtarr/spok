/*
 * useTreeDropPosition — position de dépôt (« avant » / « dedans » / « après ») d'un glisser dnd-kit dans une
 * arborescence d'éléments (Liste de SpacePage, colonne du Gantt), recalculée à CHAQUE mouvement du pointeur.
 * Pourquoi : onDragOver de dnd-kit ne se déclenche que quand la ligne survolée change ; calculer la position là la
 * figeait à l'entrée dans la ligne (bord haut → « avant », bord bas → « après ») et rendait « dedans » (glisser
 * sous un élément) presque impossible — signalement cmwqiehge00357iccoco9r4ut, 2026-11-21.
 * Params : activeId (glisser en cours, sinon rien n'est écouté), overId (ligne survolée, onDragOver), rowSelector
 * (sélecteur CSS de la ligne d'un id, ex. [data-item-id="…"]). Zones : tiers haut / milieu / tiers bas (dropPositionAt).
 * Règle : ne pas recalculer la position dans onDragOver ; lire la valeur renvoyée au moment du dépôt.
 */
import { useEffect, useRef, useState } from 'react';

export type TreeDropPosition = 'before' | 'after' | 'nest';

/** Zone sous le pointeur dans une ligne : tiers haut = avant, tiers bas = après, milieu (ou ligne sans hauteur) = dedans */
export function dropPositionAt(pointerY: number, rect: { top: number; height: number } | null | undefined): TreeDropPosition {
  if (!rect || rect.height === 0) return 'nest';
  const ratio = (pointerY - rect.top) / rect.height;
  return ratio < 0.33 ? 'before' : ratio > 0.67 ? 'after' : 'nest';
}

export function useTreeDropPosition(activeId: string | null, overId: string | null, rowSelector: (id: string) => string): TreeDropPosition {
  const [position, setPosition] = useState<TreeDropPosition>('nest');
  const pointerY = useRef(0);
  const selector = useRef(rowSelector);
  selector.current = rowSelector;

  useEffect(() => {
    if (!activeId) { setPosition('nest'); return; }
    const compute = () => {
      const rect = overId && overId !== 'root' ? document.querySelector(selector.current(overId))?.getBoundingClientRect() : null;
      setPosition(dropPositionAt(pointerY.current, rect));
    };
    compute();
    const handler = (e: PointerEvent) => { pointerY.current = e.clientY; compute(); };
    window.addEventListener('pointermove', handler);
    return () => window.removeEventListener('pointermove', handler);
  }, [activeId, overId]);

  return position;
}
