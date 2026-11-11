/* ElementHelp — petit « ? » accolé à une section d'écran (titre de bloc, bouton), qui explique cette seule fonction
   (décision Thomas 2026-11-12 : le « ? » global de la fiche élément listait toutes les fonctions d'un bloc, illisible).
   La bulle montre toujours l'explication complète du fonctionnement actuel (`text` de l'élément d'aide) ; une nouveauté
   ou évolution pas encore traitée s'y ajoute avec son badge, et l'ouvrir la traite (comme l'étape du tutoriel).
   Props : page (clé du registre PAGE_HELP), element (clé dans `elements` de la fiche — contrôlée par
   help/coverage.test.ts pour les fiches qui posent ces « ? »), className (bouton).
   Règles : ne jamais écrire le texte ici, il vient de la fiche ; à poser seulement dans une section affichée (une section
   absente n'a pas de « ? ») ; bouton type="button" (souvent dans un <form>). Ne rend rien si l'élément manque. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X } from 'lucide-react';
import { PAGE_HELP, type PageHelpKey } from './pageHelp';
import type { HelpChange, HelpEntry } from './types';
import { isPublished } from './elements';
import { placeHint } from './HelpHint';
import { NEWS_BADGE_CLASS, NEWS_TEXTS } from './newsTexts';
import { useHelpAnnouncementsStore } from '../stores/helpAnnouncements';

interface ElementHelpProps {
  page: PageHelpKey;
  element: string;
  className?: string;
}

export function ElementHelp({ page, element, className }: ElementHelpProps) {
  const help = (PAGE_HELP[page] as HelpEntry).elements?.[element];
  const buttonRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Nouveautés figées à l'ouverture : les traiter ne doit pas les faire disparaître de la bulle ouverte
  const [pending, setPending] = useState<HelpChange[]>([]);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !bubbleRef.current) { setPlace(null); return; }
    const r = buttonRef.current.getBoundingClientRect();
    const { width, height } = bubbleRef.current.getBoundingClientRect();
    setPlace(placeHint({ top: r.top, bottom: r.bottom, left: r.left, width: r.width }, width, height, window.innerWidth, window.innerHeight));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (bubbleRef.current?.contains(e.target as Node) || buttonRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    // Échap en capture sur window : ferme la bulle sans fermer la modale qui la contient
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  if (!help) return null;

  const toggle = () => {
    if (open) { setOpen(false); return; }
    const { loaded, handled, markHandled } = useHelpAnnouncementsStore.getState();
    const fresh = loaded ? (help.changes ?? []).filter((c) => isPublished(c) && !handled.includes(c.id)) : [];
    setPending(fresh);
    fresh.forEach((c) => markHandled(c.id));
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        ref={buttonRef}
        onClick={toggle}
        aria-label={`Aide : ${help.title}`}
        aria-expanded={open}
        className={className ?? 'inline-flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-accent transition-colors flex-shrink-0'}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && createPortal(
        <div
          ref={bubbleRef}
          role="dialog"
          aria-label={help.title}
          className="fixed z-[10000] w-[300px] max-w-[calc(100vw-16px)] max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-card shadow-lg px-3.5 py-3 text-sm"
          style={{ left: place?.left ?? 0, top: place?.top ?? 0, visibility: place ? 'visible' : 'hidden' }}
        >
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="font-semibold text-foreground">{help.title}</h3>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed">{help.text}</p>
          {pending.map((change) => (
            <p key={change.id} className="mt-2 text-xs text-foreground/80 leading-relaxed">
              <span className={NEWS_BADGE_CLASS}>{NEWS_TEXTS.kind[change.kind]}</span> {change.text}
            </p>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
