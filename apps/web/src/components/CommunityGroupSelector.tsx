/*
 * Sélecteur du groupe de communautés affiché (2026-11-27) : liste « Toutes · <vos groupes> · Non classées », avec le
 * nombre de communautés de chacun, et un bouton qui ouvre la gestion des groupes (CommunityGroupsModal).
 * Le groupe actif vit dans stores/communityGroupFilter (partagé sidebar ↔ /communities) ; le filtrage lui-même est fait
 * par l'appelant avec lib/communityGroupFilter.filterCommunitiesByGroup.
 * Props : communityIds (communautés de l'écran, pour les compteurs), className.
 * Aide : fiche components/help/community-groups.help.ts, zone community-groups:selecteur (annonce de la nouveauté).
 * Visiteur anonyme : rien n'est rendu (les groupes sont propres à un compte).
 */
import { useMemo, useState } from 'react';
import { FolderCog } from 'lucide-react';
import { useCommunityGroups } from '../hooks/useCommunityGroups';
import { useCommunityGroupFilterStore } from '../stores/communityGroupFilter';
import { resolveActiveGroup } from '../lib/communityGroupFilter';
import { HelpHint } from '../help/HelpHint';
import { pageHint } from '../help/pageHint';
import { CommunityGroupsModal } from './CommunityGroupsModal';

interface CommunityGroupSelectorProps {
  communityIds: string[];
  className?: string;
}

export function CommunityGroupSelector({ communityIds, className = '' }: CommunityGroupSelectorProps) {
  const { groups, enabled } = useCommunityGroups();
  const active = useCommunityGroupFilterStore((s) => s.active);
  const setActive = useCommunityGroupFilterStore((s) => s.setActive);
  const [manageOpen, setManageOpen] = useState(false);

  const counts = useMemo(() => {
    const visible = new Set(communityIds);
    const perGroup = new Map(groups.map((g) => [g.id, g.communityIds.filter((id) => visible.has(id)).length]));
    const grouped = new Set(groups.flatMap((g) => g.communityIds));
    return { perGroup, ungrouped: communityIds.filter((id) => !grouped.has(id)).length };
  }, [groups, communityIds]);

  if (!enabled) return null;
  const resolved = resolveActiveGroup(active, groups);

  return (
    <div className={`flex items-center gap-1 ${className}`} data-help-zone="community-groups:selecteur">
      <select
        value={resolved}
        onChange={(e) => setActive(e.target.value)}
        aria-label="Groupe de communautés affiché"
        className="flex-1 min-w-0 h-7 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="all">Toutes les communautés ({communityIds.length})</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>{g.name} ({counts.perGroup.get(g.id) ?? 0})</option>
        ))}
        {groups.length > 0 && <option value="ungrouped">Non classées ({counts.ungrouped})</option>}
      </select>
      <HelpHint text={pageHint('community-groups', 'groupes')}>
        <button
          type="button"
          onClick={() => setManageOpen(true)}
          aria-label="Gérer les groupes de communautés"
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex-shrink-0"
        >
          <FolderCog className="w-4 h-4" />
        </button>
      </HelpHint>
      <CommunityGroupsModal isOpen={manageOpen} onClose={() => setManageOpen(false)} />
    </div>
  );
}
