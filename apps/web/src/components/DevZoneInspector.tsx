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
 * Limite de modale : `Modal` n'a pas de portail, sa fiche reste dans le DOM de `contenu`. La remontée s'arrête donc au
 * panneau (`role="dialog"`) : sans zone plus précise, on encadre la modale avec son nom (`data-dev-name`, prop devName),
 * et le fond (`data-modal-root`) n'affiche rien. Jamais de zone de la page par-dessus une modale. Une modale maison sans
 * `role="dialog"` n'est pas couverte.
 *
 * Convention : ajouter une zone = poser `data-devzone="x"` sur l'élément + une couleur
 * dans ZONE_COLORS. Sous-zones nommées `<parent>-<enfant>` (ex. `sidebar-favoris`).
 * `contenu-barre-vue` : posé sur chaque `#view-header` (19 vues + SpacePage) — toute nouvelle vue
 * avec une barre d'en-tête doit le reprendre.
 * Ces zones servent aussi au mode Aide (textes : help/shellZones.ts) — renommer une zone = renommer son texte.
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
  // sous-zones de la barre d'espace
  'toolbar-vues': '#f59e0b',
  'toolbar-ordre': '#fb923c',
  'toolbar-filtre': '#c2410c',
  'toolbar-apercu': '#9a3412',
  'toolbar-actions': '#7c2d12',
  // sous-zones du contenu
  'contenu-barre-vue': '#0d9488', // #view-header de chaque vue (Nouveau, boutons de vue, aide, export)
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
  // modale de l'élément (ItemEditModal, ItemReadView)
  'item-chemin': '#64748b',
  'item-entete': '#7c3aed',
  'item-description': '#2563eb',
  'item-contributions': '#0891b2',
  'item-pilotage': '#059669',
  'item-type': '#65a30d',
  'item-statut': '#ca8a04',
  'item-dates': '#ea580c',
  'item-relations': '#9333ea',
  'item-tags': '#e11d48',
  'item-enfants': '#0d9488',
  'item-pied': '#475569',
  'item-lecture': '#4f46e5',
  'item-lecture-media': '#a21caf',
  'item-lecture-contenu': '#0369a1',
  'item-resume': '#57534e',
  'item-medias': '#b45309',
  'item-composer': '#be123c',
};

/** Couleur du cadre d'une modale survolée hors de toute zone */
const MODAL_COLOR = '#0f172a';
const LOOKUP = '[data-devzone],[role="dialog"],[data-modal-root]';

interface Hit { zone: string; top: number; left: number; right: number; width: number; height: number; }

/** Élément à encadrer sous le curseur et son nom : zone connue la plus proche, sinon modale, sans sortir de la modale. */
export function findDevTarget(target: Element | null): { el: HTMLElement; name: string } | null {
  const el = target?.closest<HTMLElement>(LOOKUP) ?? null;
  if (!el) return null;
  if (el.dataset.devzone) return ZONE_COLORS[el.dataset.devzone] ? { el, name: el.dataset.devzone } : null;
  if (el.getAttribute('role') === 'dialog') return { el, name: el.dataset.devName ?? 'modale' };
  return null; // fond de la modale
}

function DevZoneInspectorOverlay() {
  const [hit, setHit] = useState<Hit | null>(null);
  const targetRef = useRef<{ el: HTMLElement; name: string } | null>(null);

  useEffect(() => {
    let raf = 0;

    const compute = () => {
      const t = targetRef.current;
      if (!t || !t.el.isConnected) { setHit(null); return; }
      const r = t.el.getBoundingClientRect();
      setHit({ zone: t.name, top: r.top, left: r.left, right: r.right, width: r.width, height: r.height });
    };
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(compute); };

    const onMove = (e: MouseEvent) => {
      targetRef.current = findDevTarget(e.target as Element | null);
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
  const color = ZONE_COLORS[hit.zone] ?? MODAL_COLOR;
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
