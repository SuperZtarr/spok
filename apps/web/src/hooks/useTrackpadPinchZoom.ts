/**
 * Hook : zoom au pincement du pad à vitesse normale sous Windows/Linux dans un canevas React Flow.
 *
 * Pourquoi : un pincement de pad arrive comme un événement wheel + ctrlKey avec un deltaY minuscule
 * (quelques unités, contre ~100 par cran de molette). @xyflow/system compense par un facteur ×10,
 * mais uniquement sur macOS (`isMacOs()`) : ailleurs le pincement est ~10× trop lent.
 *
 * Params :
 * - wrapperRef : élément qui contient le <ReactFlow> (et lui seul pour le repère du pointeur)
 * - minZoom / maxZoom : les mêmes bornes que celles passées à <ReactFlow>
 *
 * Usage : appeler dans un composant situé sous un ReactFlowProvider (utilise useReactFlow).
 * Ne s'applique qu'aux petits deltas ctrl+wheel en pixels (|deltaY| < 50) : Ctrl + molette souris
 * (cran ≥ 100) et macOS restent gérés par React Flow. Les zones `.nowheel` sont laissées à React Flow.
 */
import { useEffect, type RefObject } from 'react';
import { useReactFlow } from '@xyflow/react';

const PINCH_FACTOR = 10;
const MAX_PINCH_DELTA = 50;
const isMacOs = () => typeof navigator !== 'undefined' && navigator.userAgent.indexOf('Mac') >= 0;

export function useTrackpadPinchZoom(
  wrapperRef: RefObject<HTMLElement | null>,
  minZoom: number,
  maxZoom: number,
) {
  const { getViewport, setViewport } = useReactFlow();

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || isMacOs()) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || e.deltaMode !== 0 || Math.abs(e.deltaY) >= MAX_PINCH_DELTA) return;
      if ((e.target as Element | null)?.closest?.('.nowheel')) return;
      // Capture : on passe avant le handler d3-zoom de React Flow
      e.preventDefault();
      e.stopPropagation();

      const { x, y, zoom } = getViewport();
      const nextZoom = Math.min(maxZoom, Math.max(minZoom, zoom * Math.pow(2, -e.deltaY * 0.002 * PINCH_FACTOR)));
      if (nextZoom === zoom) return;
      // Garder fixe le point du canevas sous le pointeur
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const ratio = nextZoom / zoom;
      setViewport({ x: px - (px - x) * ratio, y: py - (py - y) * ratio, zoom: nextZoom });
    };

    el.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => el.removeEventListener('wheel', onWheel, { capture: true });
  }, [wrapperRef, minZoom, maxZoom, getViewport, setViewport]);
}
