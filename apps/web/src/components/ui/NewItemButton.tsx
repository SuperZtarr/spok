/*
 * Bouton « Nouveau » des en-têtes de vue (#view-header) — source unique de son style.
 * Bleu vif (décision Thomas 2026-09-28) pour qu'il ressorte sur la charte gris-bleu : ne pas le
 * repasser en bg-secondary ni recopier ses classes dans une vue.
 * Props : onClick (création d'item dans le contexte de la vue), className (ajustements de mise en
 * page uniquement, ex. flex-shrink-0 — pas de couleur).
 * Usage : `{canEdit && onNewItem && <NewItemButton onClick={onNewItem} />}` — la condition d'affichage
 * reste dans la vue.
 */
import { Plus } from 'lucide-react';

interface NewItemButtonProps {
  onClick: () => void;
  className?: string;
}

export function NewItemButton({ onClick, className }: NewItemButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Nouvel élément"
      className={`inline-flex items-center gap-1 h-7 px-2.5 rounded text-xs font-semibold bg-blue-600 text-white shadow-sm hover:bg-blue-700 transition-colors flex-shrink-0 ${className ?? ''}`}
    >
      <Plus className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Nouveau</span>
    </button>
  );
}
