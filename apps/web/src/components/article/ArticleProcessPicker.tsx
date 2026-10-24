/*
 * Choix d'un processus à insérer dans un article (bouton « Processus » de la barre d'insertion, mode Composer) :
 * liste des processus proposables (articlesApi.processes : espaces lisibles hors mode admin ayant au moins un élément
 * placé dans la vue Process), portée « Cette communauté » (défaut, remise à chaque ouverture) ou « Partout ».
 * Pour chaque processus : « Tout le processus » ou un de ses couloirs. Le choix part en onPick(source) ; l'appelant
 * enchaîne l'aperçu et la confirmation (ArticleBatchConfirm).
 * Props : isOpen, onClose, onPick(ArticleBatchSource), spaceId / articleId (article composé).
 */
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Workflow } from 'lucide-react';
import type { ArticleBatchSource } from '@spok/shared';
import { Modal } from '../ui/Modal';
import { articlesApi } from '../../lib/api';
import { HelpHint } from '../../help/HelpHint';
import { pageHint } from '../../help/pageHint';

type Scope = 'community' | 'all';

export function ArticleProcessPicker({ isOpen, onClose, onPick, spaceId, articleId }: {
  isOpen: boolean;
  onClose: () => void;
  onPick: (source: ArticleBatchSource) => void;
  spaceId: string;
  articleId: string;
}) {
  const [scope, setScope] = useState<Scope>('community');
  useEffect(() => { if (isOpen) setScope('community'); }, [isOpen]);

  const { data, isFetching } = useQuery({
    queryKey: ['article-processes', spaceId, articleId, scope],
    queryFn: () => articlesApi.processes(spaceId, articleId, scope),
    enabled: isOpen,
  });
  const processes = data ?? [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter un processus" devName="ArticleProcessPicker">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">{pageHint('article', 'addProcess')}</p>
        <HelpHint text={pageHint('article', 'pickerScope')} className="inline-flex">
          <div className="flex items-center gap-2 text-xs">
            {([['community', 'Cette communauté'], ['all', 'Partout']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                aria-pressed={scope === value}
                className={`px-2.5 py-1 rounded-md border transition-colors ${scope === value ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border hover:bg-accent'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </HelpHint>
        <div className="max-h-[380px] overflow-y-auto border rounded-md divide-y">
          {!isFetching && processes.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">{pageHint('article', 'processEmpty')}</div>
          )}
          {processes.map((p) => (
            <div key={p.spaceId} className="px-3 py-2 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <Workflow className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium truncate flex-1">{p.spaceName}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[45%]">
                  {p.communityName ? `${p.communityName} · ` : ''}{p.nodeCount} élément{p.nodeCount > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-6">
                <button type="button" onClick={() => onPick({ kind: 'process', spaceId: p.spaceId })} className="text-xs px-2 py-1 rounded border border-primary/60 text-primary hover:bg-primary/10">
                  Tout le processus
                </button>
                {p.lanes.map((l) => (
                  <button key={l.id} type="button" onClick={() => onPick({ kind: 'process', spaceId: p.spaceId, laneId: l.id })} className="text-xs px-2 py-1 rounded border border-border hover:bg-accent truncate max-w-[14rem]">
                    {l.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
