/* Icône d'indice (mode dev uniquement) : affiche au survol les règles de gestion (businessRules.ts) liées à un bouton type/statut/priorité. Ne rend rien en prod ni si aucune règle ne matche. Tooltip en portail pour échapper à l'opacité du bouton parent (boutons non sélectionnés en opacity-60).
   Placement (2026-11-12) : côté qui a le plus de place, hauteur bornée à la fenêtre, défilable (reste ouvert au survol). */
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { ITEM_BUSINESS_RULES } from '../../lib/businessRules';

interface RuleHintProps {
  category: 'type' | 'status' | 'priority';
  value: string;
}

export function RuleHint({ category, value }: RuleHintProps) {
  const [hovered, setHovered] = useState(false);
  const [pos, setPos] = useState({ x: 0, top: 0, bottom: 0, below: false, maxH: 0 });
  const iconRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  if (!import.meta.env.DEV) return null;
  const rules = ITEM_BUSINESS_RULES.filter(
    (r) => r.category === category && r.appliesToValues.includes(value)
  );
  if (rules.length === 0) return null;

  // Côté qui a le plus de place (au-dessus / en dessous), hauteur bornée à cet espace : beaucoup de règles (Question)
  // débordaient hors de la fenêtre. Survoler l'infobulle la garde ouverte, pour la faire défiler.
  const handleEnter = () => {
    window.clearTimeout(closeTimer.current);
    const rect = iconRef.current?.getBoundingClientRect();
    if (rect) {
      const above = rect.top - 16;
      const below = window.innerHeight - rect.bottom - 16;
      const x = Math.min(Math.max(rect.left + rect.width / 2, 200), window.innerWidth - 200);
      setPos({ x, top: rect.top, bottom: rect.bottom, below: below > above, maxH: Math.max(above, below) });
    }
    setHovered(true);
  };
  const handleLeave = () => { closeTimer.current = window.setTimeout(() => setHovered(false), 150); };

  return (
    <span
      ref={iconRef}
      className="relative inline-flex items-center ml-1"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <Info className="w-3 h-3 text-indigo-400" />
      {hovered && createPortal(
        <div
          className="fixed z-[9999] w-max max-w-[380px] overflow-y-auto rounded-md border bg-card px-2 py-1 text-xs text-card-foreground shadow-lg"
          style={{
            left: pos.x, maxHeight: pos.maxH,
            ...(pos.below ? { top: pos.bottom + 8, transform: 'translateX(-50%)' } : { top: pos.top - 8, transform: 'translate(-50%, -100%)' }),
          }}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          onClick={(e) => e.stopPropagation()}
        >
          <ul className="list-disc pl-3 space-y-0.5">
            {rules.map((r) => (
              <li key={r.id}>{r.effect}</li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </span>
  );
}
