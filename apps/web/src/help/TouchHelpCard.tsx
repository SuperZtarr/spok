/* Carte de première visite sur écran tactile : annonce comment lire ce que fait un bouton (appui long, mode Aide), pour
   que l'utilisateur n'ait pas à découvrir ces gestes par hasard (consigne Thomas 2026-11-06). Sans survol, c'est le seul
   moment où l'application peut les présenter d'elle-même.
   Montée dans Layout pour un utilisateur connecté, hors fenêtre de bienvenue. Une fois par appareil : le geste dépend
   de l'appareil, d'où localStorage. Marquée vue seulement sur un choix explicite : une page quittée sans répondre
   ne la fait pas perdre. Aucune prop. Textes : help/touch.ts. Non bloquante : l'écran reste utilisable derrière. */
import { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { useHelpModeStore } from '../stores/helpMode';
import { isTouchDevice, TOUCH_HELP } from './touch';

export const TOUCH_HELP_SEEN_KEY = 'spok-touch-help-seen';
/** Laisse la page s'installer et la fenêtre de bienvenue se déclarer : elle démonte la carte avant son affichage */
const APPEAR_DELAY_MS = 1500;

export function TouchHelpCard() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isTouchDevice() || localStorage.getItem(TOUCH_HELP_SEEN_KEY)) return;
    const timer = window.setTimeout(() => setVisible(true), APPEAR_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const close = () => {
    localStorage.setItem(TOUCH_HELP_SEEN_KEY, 'true');
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label={TOUCH_HELP.cardTitle}
      data-help-mode-ui
      className="fixed inset-x-4 bottom-4 z-[10000] rounded-lg border border-primary/40 bg-card shadow-xl p-4 text-sm"
    >
      <p className="flex items-center gap-2 font-semibold text-foreground mb-1">
        <HelpCircle className="w-4 h-4 text-primary flex-shrink-0" />
        {TOUCH_HELP.cardTitle}
      </p>
      <p className="text-muted-foreground leading-relaxed mb-3">{TOUCH_HELP.cardText}</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={close} className="h-9 px-3 rounded-md border border-input hover:bg-accent">
          {TOUCH_HELP.cardDismiss}
        </button>
        <button
          type="button"
          onClick={() => { close(); useHelpModeStore.getState().enter(); }}
          className="h-9 px-3 rounded-md bg-primary text-primary-foreground font-medium"
        >
          {TOUCH_HELP.cardTry}
        </button>
      </div>
    </div>
  );
}
