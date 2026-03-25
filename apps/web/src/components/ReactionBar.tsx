import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SmilePlus, Send, X } from 'lucide-react';
import { itemsApi } from '../lib/api';
import type { ReactionSummary } from '@spok/shared';
import { DEFAULT_REACTION_TYPES } from '@spok/shared';
import { RichTextEditor } from './ui/RichTextEditor';
import { Button } from './ui/button';

interface ReactionBarProps {
  spaceId: string;
  itemId: string;
  contributionId?: string;
  summary: ReactionSummary[];
  mentionableItems?: Array<{ id: string; title: string; type: string }>;
}

export function ReactionBar({ spaceId, itemId, contributionId, summary, mentionableItems }: ReactionBarProps) {
  const queryClient = useQueryClient();
  const [localSummary, setLocalSummary] = useState<ReactionSummary[]>(summary);
  const [showPicker, setShowPicker] = useState(false);
  const [pendingReaction, setPendingReaction] = useState<string | null>(null);
  const [commentHtml, setCommentHtml] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

  // Sync from props when they change
  if (summary !== localSummary && JSON.stringify(summary) !== JSON.stringify(localSummary)) {
    setLocalSummary(summary);
  }

  const reactMutation = useMutation({
    mutationFn: ({ reactionType, content }: { reactionType: string; content?: string }) =>
      contributionId
        ? itemsApi.reactToContribution(spaceId, itemId, contributionId, reactionType, content)
        : itemsApi.react(spaceId, itemId, reactionType, content),
    onSuccess: (data) => {
      setLocalSummary(data.summary);
      queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] });
      setPendingReaction(null);
      setCommentHtml('');
    },
  });

  const removeMutation = useMutation({
    mutationFn: () =>
      contributionId
        ? itemsApi.removeContributionReaction(spaceId, itemId, contributionId)
        : itemsApi.removeReaction(spaceId, itemId),
    onSuccess: (data) => {
      setLocalSummary(data.summary);
      queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] });
    },
  });

  const handleClick = (typeId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    const existing = localSummary.find(s => s.type === typeId && s.userReacted);
    if (existing) {
      // Toggle off: remove immediately
      removeMutation.mutate();
    } else {
      // Show comment form for both items and contributions
      setPendingReaction(typeId);
      setCommentHtml('');
    }
    setTimeout(() => setShowPicker(false), 0);
  };

  const isContentEmpty = (html: string) => {
    const stripped = html.replace(/<[^>]*>/g, '').trim();
    return !stripped;
  };

  const handleSubmitReaction = (e?: React.MouseEvent | React.FormEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (!pendingReaction) return;
    reactMutation.mutate({
      reactionType: pendingReaction,
      content: isContentEmpty(commentHtml) ? undefined : commentHtml,
    });
  };

  const handleCancelReaction = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPendingReaction(null);
    setCommentHtml('');
  };

  // Get reaction config by id
  const getReactionConfig = (typeId: string) => {
    return DEFAULT_REACTION_TYPES.find(r => r.id === typeId) || { id: typeId, label: typeId, emoji: '👍' };
  };

  const userReaction = localSummary.find(s => s.userReacted);
  const pendingConfig = pendingReaction ? getReactionConfig(pendingReaction) : null;

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1 flex-wrap relative">
        {/* Existing reactions with counts */}
        {localSummary.map(s => {
          const config = getReactionConfig(s.type);
          return (
            <button
              type="button"
              key={s.type}
              onClick={(e) => handleClick(s.type, e)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                s.userReacted
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
              }`}
              title={`${config.label}${s.userReacted ? ' (votre vote)' : ''}`}
            >
              <span>{config.emoji}</span>
              <span>{s.count}</span>
            </button>
          );
        })}

        {/* Add reaction button */}
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowPicker(!showPicker); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-xs font-medium shadow-sm"
            title="Ajouter une réaction"
          >
            <SmilePlus className="w-3.5 h-3.5" />
            <span>{contributionId ? 'Réagissez à ce commentaire' : 'Réagissez à cet élément'}</span>
          </button>

          {/* Picker dropdown */}
          {showPicker && (
            <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg p-1 flex gap-0.5 z-[60]" onClick={(e) => e.stopPropagation()}>
              {DEFAULT_REACTION_TYPES.map(rt => {
                const isActive = userReaction?.type === rt.id;
                return (
                  <button
                    type="button"
                    key={rt.id}
                    onClick={(e) => handleClick(rt.id, e)}
                    className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md transition-colors text-xs ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-accent text-foreground'
                    }`}
                    title={rt.label}
                  >
                    <span className="text-base">{rt.emoji}</span>
                    <span className="text-[10px] text-muted-foreground">{rt.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Inline rich text form when a reaction is pending */}
      {pendingReaction && pendingConfig && (
        <div className="p-3 bg-muted/50 border border-border rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{pendingConfig.emoji}</span>
            <span className="text-sm font-medium">{pendingConfig.label}</span>
            <span className="text-xs text-muted-foreground">— commentaire optionnel</span>
          </div>
          <RichTextEditor
            content={commentHtml}
            onChange={setCommentHtml}
            placeholder="Ajouter un commentaire..."
            spaceId={spaceId}
            mentionableItems={mentionableItems}
            minHeight={80}
            defaultMaxHeight={150}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={handleSubmitReaction} disabled={reactMutation.isPending}>
              <Send className="w-3.5 h-3.5 mr-1" />
              {reactMutation.isPending ? 'Envoi...' : 'Valider'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleCancelReaction}>
              <X className="w-3.5 h-3.5 mr-1" />
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
