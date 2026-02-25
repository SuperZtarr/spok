import { Link2, Ban, ArrowLeft, Copy, Cog, FlaskConical } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Item } from '@spok/shared';

// Relation type options (same as MindMap)
export const RELATION_TYPES: { id: string; label: string; Icon: LucideIcon; description: string; color: string }[] = [
  { id: 'relates', label: 'Est lié à', Icon: Link2, description: 'Lien simple entre deux éléments', color: 'text-purple-500' },
  { id: 'blocks', label: 'Bloque', Icon: Ban, description: 'A doit être terminé avant B', color: 'text-red-500' },
  { id: 'depends', label: 'Dépend de', Icon: ArrowLeft, description: 'A nécessite B pour avancer', color: 'text-orange-500' },
  { id: 'duplicates', label: 'Duplique', Icon: Copy, description: 'A est un doublon de B', color: 'text-gray-500' },
  { id: 'implements', label: 'Implémente', Icon: Cog, description: 'A réalise/concrétise B', color: 'text-blue-500' },
  { id: 'tests', label: 'Teste', Icon: FlaskConical, description: 'A valide le bon fonctionnement de B', color: 'text-green-500' },
];

// Format date for display
export function formatDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface PortalGroup {
  spaceId: string;
  spaceName: string;
  items: Item[];
}
