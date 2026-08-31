/**
 * Inspecteur de zones dev-only.
 *
 * Raison d'être : se donner un vocabulaire commun pour désigner les régions de l'UI
 * ("le bandeau", "la toolbar", "sidebar-nav", "sidebar-communaute"…) pendant les échanges.
 *
 * Fonctionnement : les régions du layout portent `data-devzone="<nom>"` sur leur élément
 * réel (aucun wrapper → zéro impact layout). Monté une fois dans Layout, ce composant
 * n'agit que si le mode dev est actif (`useDevMode`) :
 *   - un `<style>` global trace un encadré coloré permanent autour de CHAQUE zone (outline,
 *     aucun impact layout) — toutes les zones sont donc visibles en continu ;
 *   - au survol, la zone `data-devzone` la plus interne sous le curseur est mise en évidence
 *     (encadré plein) et son nom s'affiche en badge à son coin haut-droit. Un seul nom à la
 *     fois (pas d'empilement des zones parentes).
 * Mode dev OFF → rien monté, `data-devzone` totalement inerte.
 *
 * Convention : ajouter une zone = poser `data-devzone="x"` sur l'élément + une couleur
 * dans ZONE_COLORS. Sous-zones nommées `<parent>-<enfant>` (ex. `sidebar-favoris`).
 */
import { useEffect, useRef, useState } from 'react';
import { useDevMode } from './DevDbStatus';

/** nom de zone (= valeur de data-devzone) → couleur de l'encadré et du badge */
const ZONE_COLORS: Record<string, string> = {
  // premier niveau
  sidebar: '#2563eb',
  header: '#7c3aed',
  bandeau: '#db2777',
  toolbar: '#ea580c',
  contenu: '#059669',
  // sous-zones de la sidebar
  'sidebar-logo': '#0ea5e9',
  'sidebar-guide': '#0891b2',
  'sidebar-nav': '#4f46e5',
  'sidebar-footer': '#6366f1',
  // sections internes de sidebar-nav
  'sidebar-favoris': '#eab308',
  'sidebar-recents': '#14b8a6',
  'sidebar-mes-espaces': '#8b5cf6',
  'sidebar-communaute': '#ec4899',
  'sidebar-autres-espaces': '#f97316',
  'sidebar-arbre': '#22c55e',
};

interface Hit { zone: string; top: number; left: number; right: number; width: number; height: number; }

function DevZoneInspectorOverlay() {
  const [hit, setHit] = useState<Hit | null>(null);
  const elRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let raf = 0;

    const compute = () => {
      const el = elRef.current;
      if (!el || !el.isConnected) { setHit(null); return; }
      const r = el.getBoundingClientRect();
      setHit({ zone: el.dataset.devzone!, top: r.top, left: r.left, right: r.right, width: r.width, height: r.height });
    };
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(compute); };

    const onMove = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>('[data-devzone]') ?? null;
      elRef.current = el && el.dataset.devzone && ZONE_COLORS[el.dataset.devzone] ? el : null;
      schedule();
    };

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  if (!hit) return null;
  const color = ZONE_COLORS[hit.zone];
  const labelAbove = hit.top > 18;

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2147483000 }}>
      <div
        style={{
          position: 'fixed', top: hit.top, left: hit.left, width: hit.width, height: hit.height,
          boxSizing: 'border-box', outline: `2px solid ${color}`, outlineOffset: '-2px',
          background: `${color}14`,
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: labelAbove ? hit.top - 17 : hit.top + 2,
          right: Math.max(2, window.innerWidth - hit.right),
          background: color, color: '#fff', padding: '1px 6px', borderRadius: 3,
          font: '11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
          letterSpacing: '.04em', textTransform: 'uppercase', whiteSpace: 'nowrap',
          boxShadow: '0 1px 4px rgba(0,0,0,.4)',
        }}
      >
        {hit.zone}
      </div>
    </div>
  );
}

export function DevZoneInspector() {
  const devMode = useDevMode();
  if (!devMode) return null;

  const outlines = Object.entries(ZONE_COLORS)
    .map(
      ([zone, color]) =>
        `[data-devzone="${zone}"] { outline: 1px dashed ${color} !important; outline-offset: -1px; }`
    )
    .join('\n');

  return (
    <>
      <style>{outlines}</style>
      <DevZoneInspectorOverlay />
    </>
  );
}
