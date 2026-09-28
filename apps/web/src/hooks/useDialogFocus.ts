/*
 * useDialogFocus — gestion du focus d'une modale (règle validée par Thomas le 2026-09-28).
 * - Ouverture : si aucun élément de la modale n'a déjà le focus (ex. champ en autoFocus), focus sur
 *   l'élément marqué `data-autofocus`, sinon sur le panneau lui-même (tabIndex -1, jamais sur un champ
 *   par défaut : une frappe ne doit rien modifier sans intention). Focus rendu visible (focusVisible).
 * - Tab / Maj+Tab tournent dans la modale ; avec des modales empilées, seule celle du dessus capte Tab.
 * - Fermeture : le focus revient sur l'élément qui l'avait avant l'ouverture (s'il existe encore).
 * Params : panelRef = conteneur de la modale (pas le fond), isOpen = état d'ouverture.
 * Usage : `Modal.tsx` l'applique à toutes ses modales ; une modale faite main l'appelle sur son panneau.
 * Choix du focus par défaut : `autoFocus` sur un champ (création, recherche) ou `data-autofocus` sur un
 * bouton (confirmation : Annuler si destructive, action principale sinon). Rien = le panneau.
 */
import { useEffect, type RefObject } from 'react';

/** Modales ouvertes, de la plus ancienne à celle du dessus. */
const dialogStack: HTMLElement[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

function isVisible(el: HTMLElement): boolean {
  const check = (el as HTMLElement & { checkVisibility?: () => boolean }).checkVisibility;
  return typeof check === 'function' ? check.call(el) : true;
}

function focusables(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible);
}

function focusVisibly(el: HTMLElement) {
  // focusVisible : contour affiché même si l'ouverture vient d'un clic souris (Chrome 134+, Firefox 104+)
  el.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
}

export function useDialogFocus(panelRef: RefObject<HTMLElement | null>, isOpen: boolean): void {
  useEffect(() => {
    const panel = panelRef.current;
    if (!isOpen || !panel) return;

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogStack.push(panel);
    if (!panel.hasAttribute('tabindex')) panel.tabIndex = -1;

    if (!panel.contains(document.activeElement)) {
      const target = panel.querySelector<HTMLElement>('[data-autofocus]');
      if (target) focusVisibly(target);
      // Cible absente ou non focalisable (bouton désactivé) → le panneau
      if (document.activeElement !== target) focusVisibly(panel);
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || dialogStack[dialogStack.length - 1] !== panel) return;
      const items = focusables(panel);
      if (items.length === 0) { e.preventDefault(); panel.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !panel.contains(active) || active === panel;
      if (e.shiftKey && (outside || active === first)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (outside || active === last)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const idx = dialogStack.lastIndexOf(panel);
      if (idx !== -1) dialogStack.splice(idx, 1);
      if (previous && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [isOpen, panelRef]);
}
