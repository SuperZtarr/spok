/* Icône d'indice (mode dev uniquement) : affiche au survol les règles de gestion (businessRules.ts) liées à un bouton type/statut/priorité. Ne rend rien en prod ni si aucune règle ne matche. Tooltip en portail pour échapper à l'opacité du bouton parent (boutons non sélectionnés en opacity-60). */
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
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const iconRef = useRef<HTMLSpanElement>(null);

  if (!import.meta.env.DEV) return null;
  const rules = ITEM_BUSINESS_RULES.filter(
    (r) => r.category === category && r.appliesToValues.includes(value)
  );
  if (rules.length === 0) return null;

  const handleEnter = () => {
    const rect = iconRef.current?.getBoundingClientRect();
    if (rect) setPos({ x: rect.left + rect.width / 2, y: rect.top });
    setHovered(true);
  };

  return (
    <span
      ref={iconRef}
      className="relative inline-flex items-center ml-1"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setHovered(false)}
    >
      <Info className="w-3 h-3 text-indigo-400" />
      {hovered && createPortal(
        <div
          className="fixed z-[9999] max-w-[240px] rounded-md border bg-card px-2 py-1 text-xs text-card-foreground shadow-lg pointer-events-none"
          style={{ left: pos.x, top: pos.y - 8, transform: 'translate(-50%, -100%)' }}
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
