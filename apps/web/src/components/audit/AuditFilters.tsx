/* Filtres du journal d'audit : entité, action, utilisateur, période. */
import { useState } from 'react';
import type { AuditAction, AuditEntity, AuditLogFilters } from '@spok/shared';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Filter, X } from 'lucide-react';

interface AuditFiltersProps {
  filters: AuditLogFilters;
  onFiltersChange: (filters: AuditLogFilters) => void;
}

const ACTION_OPTIONS: { value: AuditAction | ''; label: string }[] = [
  { value: '', label: 'Toutes les actions' },
  { value: 'CREATE', label: 'Création' },
  { value: 'UPDATE', label: 'Modification' },
  { value: 'DELETE', label: 'Suppression' },
  { value: 'MOVE', label: 'Déplacement' },
  { value: 'BULK_MOVE', label: 'Déplacement en masse' },
  { value: 'ADD_RELATION', label: 'Ajout relation' },
  { value: 'DELETE_RELATION', label: 'Suppression relation' },
];

const ENTITY_OPTIONS: { value: AuditEntity | ''; label: string }[] = [
  { value: '', label: 'Toutes les entités' },
  { value: 'Item', label: 'Élément' },
  { value: 'ItemRelation', label: 'Relation' },
];

export function AuditFilters({ filters, onFiltersChange }: AuditFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters =
    filters.action || filters.entity || filters.entityId || filters.from || filters.to;

  const clearFilters = () => {
    onFiltersChange({
      page: 1,
      pageSize: filters.pageSize,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant={showFilters ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filtres
          {hasActiveFilters && (
            <span className="ml-2 bg-primary-foreground text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs">
              !
            </span>
          )}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" />
            Effacer
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="bg-muted/50 p-4 rounded-lg space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Action</label>
              <Select
                value={filters.action || ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    action: (e.target.value as AuditAction) || undefined,
                    page: 1,
                  })
                }
                options={ACTION_OPTIONS}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Entité</label>
              <Select
                value={filters.entity || ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    entity: (e.target.value as AuditEntity) || undefined,
                    page: 1,
                  })
                }
                options={ENTITY_OPTIONS}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Du</label>
              <Input
                type="datetime-local"
                value={filters.from?.slice(0, 16) || ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    from: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                    page: 1,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Au</label>
              <Input
                type="datetime-local"
                value={filters.to?.slice(0, 16) || ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    to: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                    page: 1,
                  })
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
