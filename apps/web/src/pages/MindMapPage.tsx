/* Carte mentale globale (/mindmap) : DashboardMindMapView, lecture seule pour la navigation. */
import { useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { spacesApi, communitiesApi } from '../lib/api';
import { DashboardMindMapView } from '../components/views/DashboardMindMapView';
import { Button } from '../components/ui/Button';
import { RotateCcw } from 'lucide-react';
import type { SpaceWithRole } from '@spok/shared';

export function MindMapPage() {
  const resetRef = useRef<(() => void) | null>(null);

  const { data: allSpaces } = useQuery({
    queryKey: ['spaces', 'all'],
    queryFn: () => spacesApi.list(),
  });

  const { data: communities } = useQuery({
    queryKey: ['communities'],
    queryFn: communitiesApi.list,
  });

  const { personalSpaces, communityGroups, independentSpaces } = useMemo(() => {
    if (!allSpaces) return { personalSpaces: [] as SpaceWithRole[], communityGroups: [] as { communityId: string; communityName: string; spaces: SpaceWithRole[] }[], independentSpaces: [] as SpaceWithRole[] };
    const personal = allSpaces.filter(s => s.type === 'PERSONAL');
    const independent = allSpaces.filter(s => s.type === 'GROUP' && !s.communityId);
    const byCommunity = new Map<string, { communityName: string; spaces: SpaceWithRole[] }>();
    for (const space of allSpaces) {
      if (space.type === 'GROUP' && space.communityId && space.community) {
        const existing = byCommunity.get(space.communityId);
        if (existing) existing.spaces.push(space);
        else byCommunity.set(space.communityId, { communityName: space.community.name, spaces: [space] });
      }
    }
    if (communities) {
      for (const c of communities) {
        if (!byCommunity.has(c.id)) byCommunity.set(c.id, { communityName: c.name, spaces: [] });
      }
    }
    const groups = Array.from(byCommunity.entries())
      .map(([communityId, { communityName, spaces }]) => ({ communityId, communityName, spaces }))
      .sort((a, b) => a.communityName.localeCompare(b.communityName));
    return { personalSpaces: personal, communityGroups: groups, independentSpaces: independent };
  }, [allSpaces, communities]);

  const handleMoveSpace = (spaceId: string, newParentId: string | null) => {
    spacesApi.update(spaceId, { parentId: newParentId });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-end px-4 py-2">
        <Button size="sm" variant="bordered" onClick={() => resetRef.current?.()}>
          <RotateCcw className="w-4 h-4 mr-1" />
          Reorganiser
        </Button>
      </div>
      <DashboardMindMapView
        communityGroups={communityGroups}
        personalSpaces={personalSpaces}
        independentSpaces={independentSpaces}
        onMoveSpace={handleMoveSpace}
        resetRef={resetRef}
      />
    </div>
  );
}
