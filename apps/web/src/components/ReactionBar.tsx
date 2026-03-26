import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SmilePlus } from 'lucide-react';
import { itemsApi } from '../lib/api';
import type { ReactionSummary } from '@spok/shared';
import { DEFAULT_REACTION_TYPES } from '@spok/shared';

interface ReactionBarProps {
  spaceId: string;
  itemId: string;
  contributionId?: string;
  summary: ReactionSummary[];
  onReacted?: (reactionType: string) => void;
  label?: string;
}

export function ReactionBar({ spaceId, itemId, contributionId, summary, onReacted, label }: ReactionBarProps) {
  const queryClient = useQueryClient();
  const [localSummary, setLocalSummary] = useState<ReactionSummary[]>(summary);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    const handle = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showPicker]);

  // Sync from props when they change
  if (summary !== localSummary && JSON.stringify(summary) !== JSON.stringify(localSummary)) {
    setLocalSummary(summary);
  }

  const reactMutation = useMutation({
    mutationFn: (reactionType: string) =>
      contributionId
        ? itemsApi.reactToContribution(spaceId, itemId, contributionId, reactionType)
        : itemsApi.react(spaceId, itemId, reactionType),
    onSuccess: (data) => {
      setLocalSummary(data.summary);
      queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] });
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
      removeMutation.mutate();
    } else {
      reactMutation.mutate(typeId);
      onReacted?.(typeId);
    }
    // Defer unmount so stopPropagation can take effect
    setTimeout(() => setShowPicker(false), 0);
  };

  // Get reaction config by id
  const getReactionConfig = (typeId: string) => {
    return DEFAULT_REACTION_TYPES.find(r => r.id === typeId) || { id: typeId, label: typeId, emoji: '👍' };
  };

  const userReaction = localSummary.find(s => s.userReacted);

  return (
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
          className={`inline-flex items-center gap-1.5 border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors ${
            label ? 'px-2.5 py-1 rounded-md text-xs' : 'justify-center w-6 h-6 rounded-full'
          }`}
          title="Ajouter une réaction"
        >
          <SmilePlus className="w-3.5 h-3.5" />
          {label && <span>{label}</span>}
        </button>

        {/* Picker dropdown */}
        {showPicker && (
          <div className="absolute bottom-full left-0 mb-1 bg-card border border-border rounded-lg shadow-lg p-1 flex gap-0.5 z-50" onClick={(e) => e.stopPropagation()}>
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
  );
}
