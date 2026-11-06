/*
 * Navigation hors composant React : donne à du code sans hook (menu ⋮ construit par itemMenuGroups.ts) le navigate de
 * react-router, enregistré une fois par App. Ne pas l'utiliser dans un composant : useNavigate y suffit.
 */
import type { NavigateFunction, NavigateOptions } from 'react-router-dom';

let current: NavigateFunction | null = null;

export function setAppNavigate(navigate: NavigateFunction): void {
  current = navigate;
}

export function appNavigate(to: string, options?: NavigateOptions): void {
  current?.(to, options);
}
