/*
 * NewFeatureOverlay — zone allumée d'une nouveauté (pilote Kanban, 2026-11-07). Monté une fois dans Layout.
 * Dès qu'une annonce non traitée (usePendingAnnouncements) a sa zone à l'écran : cadre, badge clignotant en haut à droite
 * et carte avec « C'est noté » (NEWS_TEXTS.ignore) et Expliquez-moi. Une annonce à la fois, avec « 1 sur 2 » s'il y en a plusieurs sur l'écran.
 * NON BLOQUANT, contrairement au mode Aide : le cadre laisse passer les clics et l'écran reste utilisable. S'efface
 * pendant le mode Aide et un tutoriel. z-40 : sous les modales (z-50), pour ne pas allumer une zone recouverte ; une zone
 * située DANS une modale passe au-dessus (z-[60]).
 * L'annonce compte comme traitée sur « C'est noté » ou Compris, pas sur Expliquez-moi : quitter l'écran sans répondre ne la
 * perd pas. Textes : help/newsTexts.ts, fiche home (hints), éléments d'aide. Aucune prop.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHelpAnnouncementsStore } from '../stores/helpAnnouncements';
import { useHelpModeStore } from '../stores/helpMode';
import { usePendingAnnouncements, type Announcement } from './announcements';
import { cardPosition } from './HelpModeOverlay';
import { HelpHint } from './HelpHint';
import { NEWS_BADGE_CLASS, NEWS_TEXTS, NEWS_ZONE_CLASS } from './newsTexts';
import { pageHint } from './pageHint';

interface Shown { announcement: Announcement; rect: DOMRect; index: number; total: number; inModal: boolean }

const CARD_W = 280;
const CARD_MARGIN = 8;
const REFRESH_MS = 500;
/** Modale ui/Modal, ou modale faite main (Déplacer, Dupliquer) */
const MODAL_SELECTOR = '[data-modal-root], .fixed.inset-0';

const inViewport = (r: DOMRect) => r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;

/** Première annonce dont la zone est visible, avec sa position et le nombre d'annonces présentes sur l'écran. */
function findShown(pending: Announcement[]): Shown | null {
  const present = pending.filter((announcement) => document.querySelector(announcement.selector));
  for (const [index, announcement] of present.entries()) {
    const element = document.querySelector(announcement.selector)!;
    const rect = element.getBoundingClientRect();
    if (inViewport(rect)) return { announcement, rect, index, total: present.length, inModal: !!element.closest(MODAL_SELECTOR) };
  }
  return null;
}

export function NewFeatureOverlay() {
  const pending = usePendingAnnouncements();
  const helpMode = useHelpModeStore((state) => state.active);
  const markHandled = useHelpAnnouncementsStore((state) => state.markHandled);
  const [shown, setShown] = useState<Shown | null>(null);
  const [explainedId, setExplainedId] = useState<string | null>(null);

  useEffect(() => {
    if (pending.length === 0 || helpMode) { setShown(null); return; }
    const refresh = () => setShown(document.querySelector('.driver-popover') ? null : findShown(pending));
    refresh();
    // La zone apparaît au chargement de la vue, sans événement à écouter
    const tick = window.setInterval(refresh, REFRESH_MS);
    window.addEventListener('scroll', refresh, true);
    window.addEventListener('resize', refresh);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener('scroll', refresh, true);
      window.removeEventListener('resize', refresh);
    };
  }, [pending, helpMode]);

  if (!shown) return null;
  const { announcement, rect, index, total, inModal } = shown;
  const layer = inModal ? 'z-[60]' : 'z-40';
  const explained = explainedId === announcement.id;
  const pos = cardPosition(rect, CARD_MARGIN);
  const close = () => { setExplainedId(null); markHandled(announcement.id); };

  return createPortal(
    <>
      <div aria-hidden className={`fixed ${layer} pointer-events-none rounded border-2 ${NEWS_ZONE_CLASS}`}
        style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}>
        <span className={`absolute -top-3 right-1 ${NEWS_BADGE_CLASS}`}>
          {NEWS_TEXTS.kind[announcement.kind]}
        </span>
      </div>
      <div role="dialog" aria-label={NEWS_TEXTS.kind[announcement.kind]} aria-live="polite"
        className={`fixed ${layer} rounded-lg border border-violet-500 bg-card p-3 text-xs shadow-xl overflow-y-auto`}
        style={{ top: pos.top, left: pos.left, width: CARD_W, maxHeight: window.innerHeight - pos.top - CARD_MARGIN }}>
        <p className="mb-1 text-sm font-semibold text-foreground">{announcement.title}</p>
        <p className="leading-relaxed text-muted-foreground">{announcement.text}</p>
        {explained && <p className="mt-2 leading-relaxed text-foreground">{announcement.explanation}</p>}
        <div className="mt-3 flex items-center gap-2">
          {explained ? (
            <button type="button" onClick={close} className="h-9 rounded-md bg-primary px-3 font-medium text-primary-foreground">
              {NEWS_TEXTS.done}
            </button>
          ) : (
            <>
              <HelpHint text={pageHint('home', 'newsIgnore')}>
                <button type="button" onClick={close} className="h-9 rounded-md border border-input px-3 hover:bg-accent">
                  {NEWS_TEXTS.ignore}
                </button>
              </HelpHint>
              <button type="button" onClick={() => setExplainedId(announcement.id)} className="h-9 rounded-md bg-primary px-3 font-medium text-primary-foreground">
                {NEWS_TEXTS.explain}
              </button>
            </>
          )}
          {total > 1 && <span className="ml-auto text-muted-foreground">{index + 1} sur {total}</span>}
        </div>
      </div>
    </>,
    document.body,
  );
}
