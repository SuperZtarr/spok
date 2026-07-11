/* Dialogue de conflit d'édition : l'item a changé pendant l'édition (updatedAt), choix écraser/recharger. */
import { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { AlertTriangle } from 'lucide-react';

interface ConflictField {
  field: string;
  label: string;
  serverValue: unknown;
  clientValue: unknown;
}

interface ConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: ConflictField[];
  onResolve: (resolvedFields: Record<string, unknown>) => void;
  onKeepServer: () => void;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') {
    // Try to format dates
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      try {
        return new Date(value).toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return value;
      }
    }
    return value;
  }
  return String(value);
}

export function ConflictDialog({
  isOpen,
  onClose,
  conflicts,
  onResolve,
  onKeepServer,
}: ConflictDialogProps) {
  // 'server' or 'mine' per field
  const [choices, setChoices] = useState<Record<string, 'server' | 'mine'>>(() => {
    const initial: Record<string, 'server' | 'mine'> = {};
    for (const c of conflicts) {
      initial[c.field] = 'mine';
    }
    return initial;
  });

  const setAll = (choice: 'server' | 'mine') => {
    const newChoices: Record<string, 'server' | 'mine'> = {};
    for (const c of conflicts) {
      newChoices[c.field] = choice;
    }
    setChoices(newChoices);
  };

  const handleApply = () => {
    // If all choices are 'server', just keep server version
    const allServer = Object.values(choices).every((c) => c === 'server');
    if (allServer) {
      onKeepServer();
      return;
    }

    // Build resolved payload with fields where user chose 'mine'
    const resolved: Record<string, unknown> = {};
    for (const c of conflicts) {
      if (choices[c.field] === 'mine') {
        resolved[c.field] = c.clientValue;
      }
    }
    onResolve(resolved);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Conflit de modification">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Cet élément a été modifié par un autre utilisateur pendant votre édition.
            Choisissez pour chaque champ la valeur à conserver.
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="bordered" size="sm" onClick={() => setAll('server')}>
            Tout garder du serveur
          </Button>
          <Button variant="bordered" size="sm" onClick={() => setAll('mine')}>
            Tout garder les miennes
          </Button>
        </div>

        <div className="space-y-3">
          {conflicts.map((c) => (
            <div key={c.field} className="border rounded-lg p-3 space-y-2">
              <div className="text-sm font-medium">{c.label}</div>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`flex flex-col p-2 rounded-md border-2 cursor-pointer transition-all ${
                    choices[c.field] === 'server'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                      : 'border-border hover:border-muted-foreground/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={c.field}
                      checked={choices[c.field] === 'server'}
                      onChange={() => setChoices((prev) => ({ ...prev, [c.field]: 'server' }))}
                      className="w-3.5 h-3.5"
                    />
                    <span className="text-xs font-medium text-muted-foreground">Serveur</span>
                  </div>
                  <span className="text-sm mt-1 break-words">{formatValue(c.serverValue)}</span>
                </label>
                <label
                  className={`flex flex-col p-2 rounded-md border-2 cursor-pointer transition-all ${
                    choices[c.field] === 'mine'
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                      : 'border-border hover:border-muted-foreground/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={c.field}
                      checked={choices[c.field] === 'mine'}
                      onChange={() => setChoices((prev) => ({ ...prev, [c.field]: 'mine' }))}
                      className="w-3.5 h-3.5"
                    />
                    <span className="text-xs font-medium text-muted-foreground">La mienne</span>
                  </div>
                  <span className="text-sm mt-1 break-words">{formatValue(c.clientValue)}</span>
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-border">
          <Button variant="bordered" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleApply}>
            Appliquer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
