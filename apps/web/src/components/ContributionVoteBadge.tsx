/*
 * Vote de l'auteur d'une contribution (règle contribution-vote-kept, 2026-11-12) : emoji + libellé du type de réaction
 * (DEFAULT_REACTION_TYPES) avec lequel la contribution a été écrite. Figé à la création, il qualifie chaque contribution
 * (constructive, trollage…) indépendamment des compteurs de réactions, qui eux ne gardent que le dernier vote.
 * Props : type (id du vote ; null/absent → rien n'est rendu, cas des anciennes contributions), pending (étiquette
 * « Votre vote : … » au-dessus du champ de saisie), hint (rappel HelpHint, texte lu dans la fiche d'aide item-modal).
 * Usage : ItemEditModal (ligne auteur de chaque contribution, et champ de saisie). Ne pas y mettre d'action : affichage seul.
 */
import { DEFAULT_REACTION_TYPES } from '@spok/shared';
import { HelpHint } from '../help/HelpHint';

interface ContributionVoteBadgeProps {
  type: string | null | undefined;
  pending?: boolean;
  hint?: string;
}

/** Emoji et libellé d'un vote ; type inconnu (référentiel modifié) : l'id brut, sans emoji */
export function voteLabel(type: string): { emoji: string; label: string } {
  const config = DEFAULT_REACTION_TYPES.find((r) => r.id === type);
  return config ? { emoji: config.emoji, label: config.label } : { emoji: '', label: type };
}

export function ContributionVoteBadge({ type, pending = false, hint }: ContributionVoteBadgeProps) {
  if (!type) return null;
  const { emoji, label } = voteLabel(type);
  return (
    <HelpHint text={hint}>
      <span
        data-testid="contribution-vote"
        className={pending
          ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border border-primary/40 bg-primary/5 text-foreground'
          : 'inline-flex items-center gap-1 text-xs text-muted-foreground'}
      >
        {pending && <span className="text-muted-foreground">Votre vote :</span>}
        {emoji && <span>{emoji}</span>}
        <span>{label}</span>
      </span>
    </HelpHint>
  );
}
