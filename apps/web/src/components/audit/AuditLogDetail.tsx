import { useState } from 'react';
import type { AuditLog, AuditAction } from '@spok/shared';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { X, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';

interface AuditLogDetailProps {
  log: AuditLog;
  isOpen: boolean;
  onClose: () => void;
  onRestore: (log: AuditLog) => void;
  isRestoring?: boolean;
}

const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
  MOVE: 'Déplacement',
  BULK_MOVE: 'Déplacement en masse',
  ADD_RELATION: 'Ajout relation',
  UPDATE_RELATION: 'Modification relation',
  DELETE_RELATION: 'Suppression relation',
  BACKUP: 'Sauvegarde',
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'non défini';
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString();
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function canRestore(action: AuditAction): boolean {
  return ['UPDATE', 'DELETE', 'MOVE', 'DELETE_RELATION'].includes(action);
}

interface DiffViewProps {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

function DiffView({ before, after }: DiffViewProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const allKeys = new Set([
    ...(before ? Object.keys(before) : []),
    ...(after ? Object.keys(after) : []),
  ]);

  const changedKeys = Array.from(allKeys).filter((key) => {
    const beforeVal = before?.[key];
    const afterVal = after?.[key];
    return JSON.stringify(beforeVal) !== JSON.stringify(afterVal);
  });

  const toggleKey = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (changedKeys.length === 0) {
    return <p className="text-muted-foreground italic">Aucun changement détecté</p>;
  }

  return (
    <div className="space-y-2">
      {changedKeys.map((key) => {
        const beforeVal = before?.[key];
        const afterVal = after?.[key];
        const isExpanded = expandedKeys.has(key);
        const isComplex =
          typeof beforeVal === 'object' ||
          typeof afterVal === 'object' ||
          (typeof beforeVal === 'string' && beforeVal.length > 50) ||
          (typeof afterVal === 'string' && afterVal.length > 50);

        return (
          <div key={key} className="border rounded-lg overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center gap-2 p-3 bg-muted/50 hover:bg-muted text-left"
              onClick={() => toggleKey(key)}
            >
              {isComplex ? (
                isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )
              ) : (
                <div className="w-4" />
              )}
              <span className="font-mono text-sm font-medium">{key}</span>
            </button>

            {(isExpanded || !isComplex) && (
              <div className="p-3 space-y-2">
                {before && key in before && (
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-red-50 text-red-700 shrink-0">
                      Avant
                    </Badge>
                    <pre className="text-sm font-mono whitespace-pre-wrap break-all flex-1 bg-red-50 p-2 rounded">
                      {formatValue(beforeVal)}
                    </pre>
                  </div>
                )}
                {after && key in after && (
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 shrink-0">
                      Après
                    </Badge>
                    <pre className="text-sm font-mono whitespace-pre-wrap break-all flex-1 bg-green-50 p-2 rounded">
                      {formatValue(afterVal)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AuditLogDetail({
  log,
  isOpen,
  onClose,
  onRestore,
  isRestoring,
}: AuditLogDetailProps) {
  if (!isOpen) return null;

  const changes = log.changes as { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Détails de l'audit</h2>
            <p className="text-sm text-muted-foreground">{formatDate(log.createdAt)}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-6">
          {/* Meta info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Action</label>
              <p className="font-medium">{ACTION_LABELS[log.action]}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Entité</label>
              <p className="font-medium">{log.entity === 'Item' ? 'Élément' : 'Relation'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">ID de l'entité</label>
              <p className="font-mono text-sm">{log.entityId}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Utilisateur</label>
              <p className="font-medium">{log.user?.name || 'Inconnu'}</p>
              {log.user?.email && (
                <p className="text-sm text-muted-foreground">{log.user.email}</p>
              )}
            </div>
          </div>

          {/* Changes */}
          <div>
            <h3 className="font-medium mb-3">Changements</h3>
            {changes ? (
              <DiffView before={changes.before} after={changes.after} />
            ) : (
              <p className="text-muted-foreground italic">Aucun détail disponible</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="bordered" onClick={onClose}>
            Fermer
          </Button>
          {canRestore(log.action) && (
            <Button onClick={() => onRestore(log)} disabled={isRestoring}>
              <RotateCcw className="w-4 h-4 mr-2" />
              {isRestoring ? 'Restauration...' : 'Restaurer'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
