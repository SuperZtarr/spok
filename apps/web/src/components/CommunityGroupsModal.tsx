/*
 * Modale « Groupes de communautés » (2026-11-27) : gestion des groupes personnels (créer, renommer, réordonner,
 * supprimer) et rangement de chaque communauté visible dans un groupe (une seule par utilisateur, ou aucune).
 * Ouverte par le bouton du sélecteur (CommunityGroupSelector) et par « Ranger dans un groupe… » d'une carte de
 * communauté (focusCommunityId : la recherche est préremplie avec son nom).
 * Rendue en portail sur document.body : le sélecteur vit aussi dans la sidebar, dont le transform piégerait une
 * modale sans portail (cf. Layout.tsx). Données : hooks/useCommunityGroups + liste des communautés de la sidebar
 * (queryKey ['communities', userId], cache partagé, aucun appel en plus).
 * Aide : fiche components/help/community-groups.help.ts (« ? », zones groupes / ranger, rappels supprimer et ranger).
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Search, Trash2 } from 'lucide-react';
import { communitiesApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { useCommunityGroups } from '../hooks/useCommunityGroups';
import { groupIdOfCommunity } from '../lib/communityGroupFilter';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { PageHelpButton } from '../help/PageHelpButton';
import { HelpHint } from '../help/HelpHint';
import { pageHint } from '../help/pageHint';

interface CommunityGroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  focusCommunityId?: string;
}

export function CommunityGroupsModal({ isOpen, onClose, focusCommunityId }: CommunityGroupsModalProps) {
  const user = useAuthStore((s) => s.user);
  const { groups, create, rename, reorder, remove, assign } = useCommunityGroups();
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});

  const { data: communities = [] } = useQuery({
    queryKey: ['communities', user?.id || 'public'],
    queryFn: communitiesApi.list,
    enabled: isOpen && !!user,
    staleTime: Infinity,
  });

  // Chaque ouverture repart des noms enregistrés ; la recherche vise la communauté demandée, s'il y en a une
  useEffect(() => {
    if (!isOpen) return;
    setNewName('');
    setNames({});
    setSearch(focusCommunityId ? communities.find((c) => c.id === focusCommunityId)?.name ?? '' : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, focusCommunityId]);

  const sortedCommunities = useMemo(() => {
    const q = search.trim().toLowerCase();
    return communities
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
  }, [communities, search]);

  if (!isOpen) return null;

  const addGroup = () => {
    const name = newName.trim();
    if (!name) return;
    create.mutate(name, { onSuccess: () => setNewName('') });
  };

  const commitName = (id: string, current: string) => {
    const name = names[id]?.trim();
    if (name && name !== current) rename.mutate({ id, name });
    else setNames((n) => { const next = { ...n }; delete next[id]; return next; });
  };

  const move = (index: number, delta: number) => {
    const ids = groups.map((g) => g.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  };

  return createPortal(
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="large"
      devName="CommunityGroupsModal"
      title={
        <span className="flex items-center gap-3">
          Groupes de communautés
          <PageHelpButton pageKey="community-groups" />
        </span>
      }
    >
      <div className="space-y-6">
        <section data-help-zone="community-groups:groupes" data-tour="community-groups-list">
          <h3 className="text-sm font-semibold mb-2">Vos groupes</h3>
          <div className="space-y-1.5">
            {groups.map((g, index) => (
              <div key={g.id} className="flex items-center gap-1.5">
                <input
                  value={names[g.id] ?? g.name}
                  onChange={(e) => setNames((n) => ({ ...n, [g.id]: e.target.value }))}
                  onBlur={() => commitName(g.id, g.name)}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  maxLength={60}
                  aria-label={`Nom du groupe ${g.name}`}
                  className="flex-1 min-w-0 h-8 px-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-xs text-muted-foreground w-24 text-right flex-shrink-0">
                  {g.communityIds.length} communauté{g.communityIds.length > 1 ? 's' : ''}
                </span>
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Monter le groupe"
                  className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent disabled:opacity-30">
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === groups.length - 1} aria-label="Descendre le groupe"
                  className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent disabled:opacity-30">
                  <ArrowDown className="w-4 h-4" />
                </button>
                <HelpHint text={pageHint('community-groups', 'supprimer')}>
                  <button type="button" onClick={() => remove.mutate(g.id)} aria-label={`Supprimer le groupe ${g.name}`}
                    data-tour="community-group-delete"
                    className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </HelpHint>
              </div>
            ))}
            {groups.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun groupe pour l'instant : créez-en un, puis rangez-y vos communautés.</p>
            )}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addGroup(); }}
              placeholder="Nom du nouveau groupe (ex. Pro, Perso, Archives)"
              maxLength={60}
              autoFocus
              className="flex-1 min-w-0 h-8 px-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button onClick={addGroup} disabled={!newName.trim() || create.isPending}>
              <Plus className="w-4 h-4 mr-1" /> Ajouter
            </Button>
          </div>
        </section>

        <section data-help-zone="community-groups:ranger" data-tour="community-groups-assign">
          <h3 className="text-sm font-semibold mb-1">Ranger les communautés</h3>
          <p className="text-xs text-muted-foreground mb-2">{pageHint('community-groups', 'ranger')}</p>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une communauté..."
              className="w-full h-8 pl-8 pr-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="max-h-[40vh] overflow-y-auto divide-y divide-border/50">
            {sortedCommunities.map((c) => (
              <div key={c.id} className="flex items-center gap-2 py-1.5">
                <span className="flex-1 min-w-0 truncate text-sm">{c.name}</span>
                <select
                  value={groupIdOfCommunity(c.id, groups) ?? ''}
                  onChange={(e) => assign.mutate({ communityId: c.id, groupId: e.target.value || null })}
                  disabled={groups.length === 0}
                  aria-label={`Groupe de la communauté ${c.name}`}
                  className="w-48 h-8 px-2 text-sm rounded-md border border-border bg-background disabled:opacity-50"
                >
                  <option value="">Aucun groupe</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            ))}
            {sortedCommunities.length === 0 && <p className="text-sm text-muted-foreground py-2">Aucune communauté trouvée.</p>}
          </div>
        </section>
      </div>
    </Modal>,
    document.body,
  );
}
