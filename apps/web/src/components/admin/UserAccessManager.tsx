/*
 * UserAccessManager — accès d'un utilisateur aux communautés et aux espaces de groupe, pour l'administration :
 * deux blocs AccessColumnManager (Sans accès → Membre → Propriétaire), la gestion des membres « inversée »
 * (demande Thomas 2026-10-29). Seule implémentation, partagée par la fiche « Profil utilisateur » en mode admin
 * (UserProfileModal → AdminUserProfileModal, ouverte depuis la liste des utilisateurs) et par UserDetailModal.
 * - Ajout = membre (POST) ; Membre ↔ Propriétaire = PATCH (sans rétrograder les autres ; dernier propriétaire refusé,
 *   message de l'API affiché sous le bloc) ; retrait (DELETE) après confirmation.
 * - Colonne « Sans accès » : TOUTES les communautés et tous les espaces de groupe (pas la 1re page d'une liste).
 * Props : userId, userName (texte de la confirmation), user = détail admin déjà chargé (adhésions).
 * Textes des flèches : pages/help/admin-users.help.ts (hints access*).
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, FolderKanban } from 'lucide-react';
import type { CommunityRole, Role } from '@spok/shared';
import { adminApi } from '../../lib/api';
import { pageHint } from '../../help/pageHint';
import { ConfirmModal } from '../ConfirmModal';
import { AccessColumnManager, type AccessEntry } from './AccessColumnManager';

type Membership = { community: { id: string; name: string }; role: string };
type SpaceMembership = { space: { id: string; name: string; type: string }; role: string };

interface Props {
  userId: string;
  userName: string;
  user: { communityMemberships?: Membership[]; memberships?: SpaceMembership[] } | undefined;
}

type Kind = 'community' | 'space';

export function UserAccessManager({ userId, userName, user }: Props) {
  const queryClient = useQueryClient();
  const [accessError, setAccessError] = useState<{ kind: Kind; message: string } | null>(null);
  const [pendingRemove, setPendingRemove] = useState<{ kind: Kind; entry: AccessEntry } | null>(null);

  const { data: communitiesData } = useQuery({
    queryKey: ['admin', 'communities', 'all-for-access'],
    queryFn: () => adminApi.communities.list({ pageSize: 1000 }),
  });
  const { data: spacesData } = useQuery({
    queryKey: ['admin', 'spaces', 'all-groups-for-access'],
    queryFn: () => adminApi.spaces.list({ pageSize: 5000, type: 'GROUP' }),
  });

  const done = () => {
    setAccessError(null);
    queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  };
  const failed = (kind: Kind) => (e: unknown) => setAccessError({ kind, message: e instanceof Error ? e.message : 'Action impossible' });

  const addToCommunity = useMutation({
    mutationFn: (communityId: string) => adminApi.users.addToCommunity(userId, { communityId, role: 'MEMBER' as CommunityRole }),
    onSuccess: done, onError: failed('community'),
  });
  const removeFromCommunity = useMutation({
    mutationFn: (communityId: string) => adminApi.users.removeFromCommunity(userId, communityId),
    onSuccess: done, onError: failed('community'),
  });
  const setCommunityRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'OWNER' | 'MEMBER' }) => adminApi.users.setCommunityRole(userId, id, role),
    onSuccess: done, onError: failed('community'),
  });
  const addToSpace = useMutation({
    mutationFn: (spaceId: string) => adminApi.users.addToSpace(userId, { spaceId, role: 'MEMBER' as Role }),
    onSuccess: done, onError: failed('space'),
  });
  const removeFromSpace = useMutation({
    mutationFn: (spaceId: string) => adminApi.users.removeFromSpace(userId, spaceId),
    onSuccess: done, onError: failed('space'),
  });
  const setSpaceRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'OWNER' | 'MEMBER' }) => adminApi.users.setSpaceRole(userId, id, role),
    onSuccess: done, onError: failed('space'),
  });
  const busy = [addToCommunity, removeFromCommunity, setCommunityRole, addToSpace, removeFromSpace, setSpaceRole].some((m) => m.isPending);

  // Cartes : toutes les communautés / espaces de groupe avec le rôle de l'utilisateur (NONE = sans accès) ;
  // une adhésion hors des listes chargées est ajoutée pour ne jamais disparaître.
  const communityEntries = useMemo<AccessEntry[]>(() => {
    const roleOf = new Map((user?.communityMemberships ?? []).map((m) => [m.community.id, m.role as AccessEntry['role']]));
    const list: AccessEntry[] = (communitiesData?.data ?? []).map((c) => ({ id: c.id, name: c.name, role: roleOf.get(c.id) ?? 'NONE' }));
    const seen = new Set(list.map((e) => e.id));
    for (const m of user?.communityMemberships ?? []) {
      if (!seen.has(m.community.id)) list.push({ id: m.community.id, name: m.community.name, role: m.role as AccessEntry['role'] });
    }
    return list;
  }, [communitiesData, user]);

  const spaceEntries = useMemo<AccessEntry[]>(() => {
    const groupMemberships = (user?.memberships ?? []).filter((m) => m.space.type !== 'PERSONAL');
    const roleOf = new Map(groupMemberships.map((m) => [m.space.id, m.role as AccessEntry['role']]));
    const list: AccessEntry[] = (spacesData?.data ?? [])
      .filter((s) => s.type !== 'PERSONAL')
      .map((s) => ({ id: s.id, name: s.name, group: s.community?.name ?? 'Hors communauté', role: roleOf.get(s.id) ?? 'NONE' }));
    const seen = new Set(list.map((e) => e.id));
    for (const m of groupMemberships) {
      if (!seen.has(m.space.id)) list.push({ id: m.space.id, name: m.space.name, role: m.role as AccessEntry['role'] });
    }
    return list;
  }, [spacesData, user]);

  const hints = (add: string) => ({
    add: pageHint('admin-users', add),
    remove: pageHint('admin-users', 'accessRemove'),
    promote: pageHint('admin-users', 'accessPromote'),
    demote: pageHint('admin-users', 'accessDemote'),
  });

  return (
    <div className="space-y-6" data-tour="user-access">
      <AccessColumnManager
        title="Communautés"
        icon={Building2}
        entries={communityEntries}
        onAdd={(id) => addToCommunity.mutate(id)}
        onRemove={(entry) => setPendingRemove({ kind: 'community', entry })}
        onSetRole={(id, role) => setCommunityRole.mutate({ id, role })}
        busy={busy}
        error={accessError?.kind === 'community' ? accessError.message : null}
        hints={hints('accessAddCommunity')}
        hrefOf={(id) => `/communities/${id}/settings`}
      />
      <AccessColumnManager
        title="Espaces de groupe"
        icon={FolderKanban}
        entries={spaceEntries}
        onAdd={(id) => addToSpace.mutate(id)}
        onRemove={(entry) => setPendingRemove({ kind: 'space', entry })}
        onSetRole={(id, role) => setSpaceRole.mutate({ id, role })}
        busy={busy}
        error={accessError?.kind === 'space' ? accessError.message : null}
        hints={hints('accessAddSpace')}
        hrefOf={(id) => `/spaces/${id}/settings`}
      />
      <ConfirmModal
        isOpen={!!pendingRemove}
        onClose={() => setPendingRemove(null)}
        onConfirm={() => {
          if (!pendingRemove) return;
          if (pendingRemove.kind === 'community') removeFromCommunity.mutate(pendingRemove.entry.id);
          else removeFromSpace.mutate(pendingRemove.entry.id);
          setPendingRemove(null);
        }}
        title="Retirer l'accès"
        message={pendingRemove ? `${userName} ne sera plus membre de « ${pendingRemove.entry.name} ». ${pageHint('admin-users', 'accessRemove') ?? ''}` : ''}
        confirmLabel="Retirer"
        confirmVariant="destructive"
      />
    </div>
  );
}
