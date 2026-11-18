/*
 * Fenêtre « Champs à exporter » : avant un export de données (CSV, Excel, PDF données), l'utilisateur coche les champs
 * et les range dans l'ordre des colonnes (glisser-déposer via @dnd-kit, ou flèches ↑/↓ au clavier). Pré-remplie avec
 * le dernier choix fait dans l'espace ; le choix est enregistré au moment de l'export (useExportFields, par utilisateur
 * et par espace). Liste des champs : registre shared EXPORT_FIELD_REGISTRY — jamais de liste locale.
 * Usage : ne pas l'appeler depuis une vue — passer l'option `fieldsExport` à ExportDropdownButton, qui seul utilise
 * useExportFieldsDialog (`ask(format, run)` + rendu de `dialog`). L'espace est lu dans la route (/spaces/:spaceId).
 * JSON, PNG, SVG et PDF visuels ne passent pas par cette fenêtre (export complet ou image).
 * Aide : fiche components/help/export-fields.help.ts (« ? », tour, zones export-fields:*, rappels pageHint).
 */
import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EXPORT_FIELD_IDS, getExportFieldLabel, type ExportFieldId } from '@spok/shared';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { PageHelpButton } from '../help/PageHelpButton';
import { HelpHint } from '../help/HelpHint';
import { pageHint } from '../help/pageHint';
import { useExportFields } from '../hooks/useExportFields';

/** Ordre de la fenêtre : champs cochés dans l'ordre choisi, puis les autres dans l'ordre du registre. */
function initialOrder(checked: ExportFieldId[]): ExportFieldId[] {
  return [...checked, ...EXPORT_FIELD_IDS.filter(id => !checked.includes(id))];
}

interface RowProps {
  id: ExportFieldId;
  index: number;
  count: number;
  checked: boolean;
  onToggle: () => void;
  onMove: (delta: number) => void;
}

function FieldRow({ id, index, count, checked, onToggle, onMove }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const label = getExportFieldLabel(id);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 px-2 py-1 text-sm bg-background ${isDragging ? 'opacity-60 shadow' : ''}`}
    >
      <button type="button" className="cursor-grab text-muted-foreground hover:text-foreground" aria-label={`Déplacer ${label}`} {...attributes} {...listeners}>
        <GripVertical className="w-4 h-4" />
      </button>
      <label className="flex items-center gap-2 flex-1 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={onToggle} />
        <span className={checked ? '' : 'text-muted-foreground'}>{label}</span>
      </label>
      <button type="button" className="p-0.5 rounded hover:bg-accent disabled:opacity-30" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Monter ${label}`}>
        <ArrowUp className="w-3.5 h-3.5" />
      </button>
      <button type="button" className="p-0.5 rounded hover:bg-accent disabled:opacity-30" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Descendre ${label}`}>
        <ArrowDown className="w-3.5 h-3.5" />
      </button>
    </li>
  );
}

interface ExportFieldsModalProps {
  isOpen: boolean;
  formatLabel: string;
  initial: ExportFieldId[];
  onCancel: () => void;
  onConfirm: (fields: ExportFieldId[]) => void;
}

export function ExportFieldsModal({ isOpen, formatLabel, initial, onCancel, onConfirm }: ExportFieldsModalProps) {
  const [order, setOrder] = useState<ExportFieldId[]>(() => initialOrder(initial));
  const [checked, setChecked] = useState<Set<ExportFieldId>>(() => new Set(initial));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const toggle = (id: ExportFieldId) => setChecked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const move = (index: number, delta: number) => setOrder(prev => arrayMove(prev, index, index + delta));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setOrder(prev => arrayMove(prev, prev.indexOf(e.active.id as ExportFieldId), prev.indexOf(e.over!.id as ExportFieldId)));
  };
  const selected = order.filter(id => checked.has(id));

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Champs à exporter" size="small" devName="ExportFieldsModal">
      <div className="flex justify-end -mt-2 mb-1"><PageHelpButton pageKey="export-fields" /></div>
      <p className="text-xs text-muted-foreground mb-2">{pageHint('export-fields', 'remembered')}</p>
      <div className="flex gap-2 mb-2 text-xs" data-help-zone="export-fields:selection">
        <button type="button" className="underline text-muted-foreground hover:text-foreground" onClick={() => setChecked(new Set(EXPORT_FIELD_IDS))}>Tout cocher</button>
        <HelpHint text={pageHint('export-fields', 'reset')}>
          <button type="button" className="underline text-muted-foreground hover:text-foreground" onClick={() => { setOrder([...EXPORT_FIELD_IDS]); setChecked(new Set(EXPORT_FIELD_IDS)); }}>Rétablir par défaut</button>
        </HelpHint>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ul className="border rounded-md divide-y max-h-[50vh] overflow-y-auto" data-tour="export-fields-list" data-help-zone="export-fields:ordre">
            {order.map((id, i) => (
              <FieldRow key={id} id={id} index={i} count={order.length} checked={checked.has(id)} onToggle={() => toggle(id)} onMove={d => move(i, d)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {selected.length === 0 && <p className="text-xs text-red-500 mt-2">{pageHint('export-fields', 'noneChecked')}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" onClick={onCancel}>Annuler</Button>
        <HelpHint text={pageHint('export-fields', 'confirm')}>
          <Button data-tour="export-fields-confirm" data-help-zone="export-fields:exporter" disabled={selected.length === 0} onClick={() => onConfirm(selected)}>
            Exporter ({formatLabel})
          </Button>
        </HelpHint>
      </div>
    </Modal>
  );
}

/**
 * Branche la fenêtre sur un menu d'export : `ask(formatLabel, run)` ouvre la fenêtre ; à la validation, le choix est
 * mémorisé pour l'espace puis `run(fields)` lance l'export. Rendre `dialog` dans le composant appelant.
 */
export function useExportFieldsDialog() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const { fields, saveFields } = useExportFields(spaceId);
  const [pending, setPending] = useState<{ formatLabel: string; run: (f: ExportFieldId[]) => unknown } | null>(null);
  const ask = useCallback((formatLabel: string, run: (f: ExportFieldId[]) => unknown) => setPending({ formatLabel, run }), []);
  const dialog = pending ? (
    <ExportFieldsModal
      isOpen
      formatLabel={pending.formatLabel}
      initial={fields}
      onCancel={() => setPending(null)}
      onConfirm={selected => {
        saveFields(selected);
        const run = pending.run;
        setPending(null);
        run(selected);
      }}
    />
  ) : null;
  return { ask, dialog };
}
