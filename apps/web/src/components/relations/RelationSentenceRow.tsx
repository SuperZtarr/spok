/*
 * RelationSentenceRow — une option de type de relation lue comme une phrase : [Item A] verbe [Item B], chaque item
 * en pastille couleur de son statut, bordée de la couleur du type (source unique constants/relationTypes.ts),
 * suivie de l'explication détaillée du type (« Bloque : Contrainte dure — B ne peut démarrer avant la fin de A »).
 * Présentation retenue pour toutes les modales de relation (décision Thomas 2026-10-20 : phrases du PERT
 * + explications détaillées de l'ancienne grille).
 * Props : typeId, titres et statuts des deux items, statusOptions (référentiel de statuts de l'espace).
 * Usage : dans RelationCreateDialog / RelationEditDialog uniquement.
 */
import type { StatusConfig } from '@spok/shared';
import { getRelationMeta, isOfficialRelationType } from '../../constants/relationTypes';

function ItemChip({ name, status, statusOptions, borderColor }: {
  name: string;
  status?: string | null;
  statusOptions: StatusConfig[];
  borderColor: string;
}) {
  const statusColor = statusOptions.find((s) => s.id === (status ?? 'undefined'))?.color ?? 'bg-gray-100 text-gray-700';
  return (
    <span
      className={`block w-full rounded px-2 py-0.5 text-xs font-semibold break-words ${statusColor}`}
      style={{ border: `1.5px solid ${borderColor}` }}
    >
      {name}
    </span>
  );
}

export interface RelationEnd {
  title: string;
  status?: string | null;
}

export function RelationSentenceRow({ typeId, source, target, statusOptions }: {
  typeId: string;
  source: RelationEnd;
  target: RelationEnd;
  statusOptions: StatusConfig[];
}) {
  const meta = getRelationMeta(typeId);
  const verb = isOfficialRelationType(typeId) ? meta.verb : '→';
  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0 text-left">
      <div className="flex items-center gap-2">
        <div className="w-[42%] flex-shrink-0"><ItemChip name={source.title} status={source.status} statusOptions={statusOptions} borderColor={meta.hex} /></div>
        <div className="w-[20%] flex-shrink-0 text-center">
          <span className="text-xs font-bold text-foreground whitespace-nowrap">{verb}</span>
        </div>
        <div className="flex-1 min-w-0"><ItemChip name={target.title} status={target.status} statusOptions={statusOptions} borderColor={meta.hex} /></div>
      </div>
      <span className="text-[11px] text-muted-foreground">{meta.label} : {meta.description}</span>
    </div>
  );
}
