/*
 * Carte mentale globale (/mindmap) : DashboardMindMapView — navigation (clic) et rangement des espaces (glisser-déposer).
 * handleMoveSpace attend la réponse du PATCH, recharge espaces/communautés (la carte se redessine d'après la base)
 * et affiche l'échec dans un bandeau (pas de système de toast dans l'appli) ; la vue remet alors le nœud en place.
 */
import { useRef, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { spacesApi, communitiesApi } from '../lib/api';
import { DashboardMindMapView, type SpaceMove } from '../components/views/DashboardMindMapView';
import { Button } from '../components/ui/Button';
import { RotateCcw, AlertTriangle, X } from 'lucide-react';
import type { SpaceWithRole } from '@spok/shared';
import { PageHelpButton } from '../help/PageHelpButton';

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

  const queryClient = useQueryClient();
  const [moveError, setMoveError] = useState<string | null>(null);

  const handleMoveSpace = async ({ spaceId, ...data }: SpaceMove) => {
    setMoveError(null);
    try {
      await spacesApi.update(spaceId, data);
    } catch (err: any) {
      const name = allSpaces?.find(s => s.id === spaceId)?.name ?? 'cet espace';
      setMoveError(err?.statusCode === 403
        ? `Déplacement de « ${name} » refusé : il faut être propriétaire de l'espace, avoir accès en écriture à l'espace de destination et être membre de la communauté visée.`
        : `Déplacement de « ${name} » impossible : ${err?.message || 'erreur inconnue'}`);
      throw err;
    } finally {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-end gap-2 px-4 py-2">
        {moveError && (
          <div role="alert" className="mr-auto flex items-start gap-2 px-3 py-1.5 text-sm rounded-md border border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{moveError}</span>
            <button type="button" onClick={() => setMoveError(null)} aria-label="Fermer le message" className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <Button size="sm" variant="bordered" data-tour="global-mindmap-reset" onClick={() => resetRef.current?.()}>
          <RotateCcw className="w-4 h-4 mr-1" />
          Réorganiser
        </Button>
        <PageHelpButton pageKey="global-mindmap" />
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
