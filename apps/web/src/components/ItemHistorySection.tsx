/*
 * Section « Historique » de la fiche d'un élément (règle item-history-members, décision Thomas 2026-11-12) : qui a
 * changé quoi et quand (statut, dates, tags, assigné, contenus, relations…), lu par toute personne connectée qui peut
 * lire l'élément. Repliée par défaut : l'historique n'est chargé qu'à l'ouverture (useItemHistory), 30 entrées puis
 * « Plus ». Lignes déjà libellées par l'API (routes/item-history.ts) : ce composant ne fait que les mettre en page.
 * Props : spaceId, itemId, version (updatedAt de l'élément, relit après chaque enregistrement), hints (textes de la fiche
 * d'aide item-modal : rappel du bouton, état vide). Lecture seule : la restauration reste à l'admin (historique de l'espace).
 * Ne pas l'afficher à un visiteur anonyme (l'API refuse).
 */
import { useState } from 'react';
import { History, ChevronDown, ChevronRight } from 'lucide-react';
import type { ItemHistoryLine } from '@spok/shared';
import { useItemHistory } from '../hooks/useItemHistory';
import { HelpHint } from '../help/HelpHint';
import { ElementHelp } from '../help/ElementHelp';

interface ItemHistorySectionProps {
  spaceId: string;
  itemId: string;
  version?: string;
  hints?: { toggle?: string; empty?: string };
}

/** Texte d'une ligne : « Statut : À faire → En cours », « Tag ajouté : bug », « Description modifiée » */
export function historyLineText(line: ItemHistoryLine): string {
  const v = (x: string | null | undefined) => x ?? '—';
  const hasBefore = line.before !== undefined;
  const hasAfter = line.after !== undefined;
  if (hasBefore && hasAfter) return `${line.label} : ${v(line.before)} → ${v(line.after)}`;
  if (hasAfter) return `${line.label} : ${v(line.after)}`;
  if (hasBefore) return `${line.label} : ${v(line.before)}`;
  return line.label;
}

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function ItemHistorySection({ spaceId, itemId, version, hints }: ItemHistorySectionProps) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useItemHistory(spaceId, itemId, version, open);
  const entries = data?.pages.flatMap((p) => p.entries) ?? [];

  return (
    <div className="space-y-2" data-tour="item-history" data-devzone="item-historique">
      <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <HelpHint text={hints?.toggle}>
          <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 hover:text-foreground transition-colors" aria-expanded={open}>
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <History className="w-4 h-4" />
            Historique
          </button>
        </HelpHint>
        <ElementHelp page="item-modal" element="historique" />
      </h2>
      {open && (
        <div className="pl-6 space-y-2 text-xs">
          {isLoading && <p className="text-muted-foreground">Chargement…</p>}
          {isError && <p className="text-destructive">Historique indisponible. Réessayez plus tard.</p>}
          {!isLoading && !isError && entries.length === 0 && <p className="text-muted-foreground">{hints?.empty}</p>}
          {entries.map((entry) => (
            <div key={entry.id} className="border-l-2 border-border pl-2" data-testid="history-entry">
              <div className="text-muted-foreground">
                {formatWhen(entry.createdAt)} · <span className="font-medium">{entry.user?.name ?? 'Utilisateur supprimé'}</span>
                {entry.viaMcp && <span> · via MCP</span>}
              </div>
              <ul className="text-foreground">
                {entry.lines.map((line, i) => <li key={i}>{historyLineText(line)}</li>)}
              </ul>
            </div>
          ))}
          {hasNextPage && (
            <button type="button" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="text-primary hover:underline">
              {isFetchingNextPage ? 'Chargement…' : 'Plus'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
