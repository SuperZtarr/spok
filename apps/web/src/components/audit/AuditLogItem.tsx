import type { AuditLog, AuditAction } from '@spok/shared';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  Plus,
  Pencil,
  Trash2,
  Move,
  Link2,
  Unlink,
  ArrowRightLeft,
  Eye,
  RotateCcw,
  DatabaseBackup,
} from 'lucide-react';

interface AuditLogItemProps {
  log: AuditLog;
  onViewDetails: (log: AuditLog) => void;
  onRestore: (log: AuditLog) => void;
  isRestoring?: boolean;
}

const ACTION_CONFIG: Record<
  AuditAction,
  { label: string; icon: React.ElementType; color: string }
> = {
  CREATE: { label: 'Création', icon: Plus, color: 'bg-green-100 text-green-800' },
  UPDATE: { label: 'Modification', icon: Pencil, color: 'bg-blue-100 text-blue-800' },
  DELETE: { label: 'Suppression', icon: Trash2, color: 'bg-red-100 text-red-800' },
  MOVE: { label: 'Déplacement', icon: Move, color: 'bg-purple-100 text-purple-800' },
  BULK_MOVE: { label: 'Déplacement en masse', icon: ArrowRightLeft, color: 'bg-purple-100 text-purple-800' },
  ADD_RELATION: { label: 'Ajout relation', icon: Link2, color: 'bg-teal-100 text-teal-800' },
  UPDATE_RELATION: { label: 'Modification relation', icon: Pencil, color: 'bg-teal-100 text-teal-800' },
  DELETE_RELATION: { label: 'Suppression relation', icon: Unlink, color: 'bg-orange-100 text-orange-800' },
  BACKUP: { label: 'Sauvegarde', icon: DatabaseBackup, color: 'bg-gray-100 text-gray-800' },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getItemTitle(log: AuditLog): string {
  const changes = log.changes;
  if (changes?.after && typeof changes.after === 'object' && 'title' in changes.after) {
    return changes.after.title as string;
  }
  if (changes?.before && typeof changes.before === 'object' && 'title' in changes.before) {
    return changes.before.title as string;
  }
  return log.entityId;
}

function canRestore(action: AuditAction): boolean {
  return ['UPDATE', 'DELETE', 'MOVE', 'DELETE_RELATION'].includes(action);
}

export function AuditLogItem({ log, onViewDetails, onRestore, isRestoring }: AuditLogItemProps) {
  const config = ACTION_CONFIG[log.action];
  const Icon = config.icon;
  const title = log.entity === 'Item' ? getItemTitle(log) : `Relation ${log.entityId.slice(0, 8)}...`;

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-muted/50 rounded-lg transition-colors group">
      <div className={`p-2 rounded-lg ${config.color}`}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{title}</span>
          <Badge variant="secondary" className="text-xs">
            {log.entity === 'Item' ? 'Élément' : 'Relation'}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          {config.label} par {log.user?.name || 'Utilisateur inconnu'}
        </div>
      </div>

      <div className="text-sm text-muted-foreground whitespace-nowrap">
        {formatDate(log.createdAt)}
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" onClick={() => onViewDetails(log)} title="Voir les détails">
          <Eye className="w-4 h-4" />
        </Button>
        {canRestore(log.action) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRestore(log)}
            disabled={isRestoring}
            title="Restaurer"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
