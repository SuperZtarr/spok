/*
 * Bandeau « saisie retrouvée » en haut de la fiche d'un élément (règle item-draft-local, 2026-11-12) : un brouillon
 * gardé dans le navigateur (lib/itemDraft.ts) attend une décision. « Reprendre » remet la saisie dans la fiche (à
 * enregistrer ensuite comme d'habitude) ; « Ignorer » efface le brouillon. Bloc de décision : la phrase d'explication
 * est visible (pas seulement en infobulle) ; avertissement si l'élément a été modifié depuis par ailleurs.
 * Props : savedAt (date du brouillon), changedSince, onResume / onDiscard, texts (fiche d'aide item-modal : explication,
 * avertissement, rappels des deux boutons). N'affiche rien d'autre : la logique de reprise est dans ItemEditModal.
 */
import { History } from 'lucide-react';
import { Button } from './ui/Button';
import { HelpHint } from '../help/HelpHint';

interface ItemDraftBannerProps {
  savedAt: number;
  changedSince: boolean;
  onResume: () => void;
  onDiscard: () => void;
  texts?: { explain?: string; changedSince?: string; resume?: string; discard?: string };
}

export function ItemDraftBanner({ savedAt, changedSince, onResume, onDiscard, texts }: ItemDraftBannerProps) {
  const when = new Date(savedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return (
    <div role="alert" data-tour="item-draft" className="mb-4 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-sm">
      <div className="flex items-start gap-2">
        <History className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-700 dark:text-amber-400" />
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-medium">Modifications non enregistrées du {when} retrouvées sur ce navigateur</p>
          {texts?.explain && <p className="text-muted-foreground">{texts.explain}</p>}
          {changedSince && texts?.changedSince && <p className="text-amber-800 dark:text-amber-300">{texts.changedSince}</p>}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <HelpHint text={texts?.resume}>
            <Button type="button" size="sm" onClick={onResume}>Reprendre</Button>
          </HelpHint>
          <HelpHint text={texts?.discard}>
            <Button type="button" size="sm" variant="bordered" onClick={onDiscard}>Ignorer</Button>
          </HelpHint>
        </div>
      </div>
    </div>
  );
}
