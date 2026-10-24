/*
 * Confirmation d'un ajout groupé dans un article (grappe ou processus, mode Composer) : affiche l'aperçu de l'API
 * (POST …/article/batch/preview) — nombre d'éléments ajoutés, motifs des éléments sautés, avertissement « moins
 * visible » — et désactive l'ajout si rien n'est à ajouter ou si la limite de 100 est dépassée.
 * Props : isOpen, preview (null pendant le chargement), isLoading, isPending (insertion en cours), onClose, onConfirm.
 * L'appelant envoie confirmLessVisible = preview.lessVisible. Textes : pages/help/article.help.ts (batch*).
 */
import type { ArticleBatchPreview } from '@spok/shared';
import { Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { HelpHint } from '../../help/HelpHint';
import { pageHint } from '../../help/pageHint';

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export function ArticleBatchConfirm({ isOpen, preview, isLoading, isPending, onClose, onConfirm }: {
  isOpen: boolean;
  preview: ArticleBatchPreview | null;
  isLoading: boolean;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const skipped = preview
    ? [
        preview.skipped.present ? plural(preview.skipped.present, 'déjà présent', 'déjà présents') : null,
        preview.skipped.unreadable ? plural(preview.skipped.unreadable, 'illisible', 'illisibles') : null,
        preview.skipped.articles ? plural(preview.skipped.articles, 'article', 'articles') : null,
      ].filter(Boolean)
    : [];
  const blocked = !preview || preview.count === 0 || preview.tooMany;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter plusieurs éléments" devName="ArticleBatchConfirm" size="small">
      <div className="space-y-3 text-sm">
        {isLoading || !preview ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {preview.tooMany ? (
              <p className="text-destructive">{pageHint('article', 'batchTooMany')}</p>
            ) : preview.count === 0 ? (
              <p className="text-muted-foreground">{pageHint('article', 'batchEmpty')}</p>
            ) : (
              <p className="font-medium">{plural(preview.count, 'élément sera ajouté', 'éléments seront ajoutés')} à cet endroit.</p>
            )}
            {skipped.length > 0 && (
              <HelpHint text={pageHint('article', 'batchSkipped')} className="inline-flex">
                <p className="text-xs text-muted-foreground">Sautés : {skipped.join(', ')}</p>
              </HelpHint>
            )}
            {preview.lessVisible && !blocked && (
              <p className="text-xs rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">{pageHint('article', 'batchLessVisible')}</p>
            )}
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="bordered" onClick={onClose}>Annuler</Button>
          <HelpHint text={pageHint('article', 'batchConfirm')}>
            <Button onClick={onConfirm} disabled={blocked || isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ajouter
            </Button>
          </HelpHint>
        </div>
      </div>
    </Modal>
  );
}
