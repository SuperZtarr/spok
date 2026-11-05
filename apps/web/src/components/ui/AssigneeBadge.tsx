/*
 * Badge de l'assigné d'un élément : icône de personne et nom, tronqué s'il est long (nom complet au survol).
 * Rend rien si personne n'est assigné. Prop : item (membre SPOK ou nom saisi librement, via assigneeLabel).
 * Utilisé sur les lignes des vues Gantt et Liste ; à placer dans un conteneur flex, il ne rétrécit pas sous sa largeur.
 */
import { User } from 'lucide-react';
import { assigneeLabel } from '../../lib/assignee';

export function AssigneeBadge({ item }: { item: Parameters<typeof assigneeLabel>[0] }) {
  const name = assigneeLabel(item);
  if (!name) return null;
  return (
    <span className="inline-flex items-center gap-1 flex-shrink-0 max-w-[110px] text-xs text-muted-foreground" title={`Assigné à ${name}`}>
      <User className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
      <span className="truncate">{name}</span>
    </span>
  );
}
