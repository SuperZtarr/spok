import { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Globe, Lock, Crown, User, FolderOpen, X, AlertTriangle, Search, ArrowRight, Clock, LogIn, LogOut } from 'lucide-react';
import { communitiesApi } from '../../lib/api';

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Crown; color: string }> = {
  OWNER: { label: 'Propriétaire', icon: Crown, color: 'text-amber-500' },
  MEMBER: { label: 'Membre', icon: User, color: 'text-foreground' },
};

type CreateStep = 'awareness' | 'form';

export interface CommunityListViewHandle {
  openCreate: () => void;
}

export const CommunityListView = forwardRef<CommunityListViewHandle>(function CommunityListView(_props, ref) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState<CreateStep>('awareness');
  const [searchExisting, setSearchExisting] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [wantPublic, setWantPublic] = useState(false);

  useImperativeHandle(ref, () => ({
    openCreate: () => setShowCreate(true),
  }));

  const { data: communities, isLoading } = useQuery({
    queryKey: ['communities'],
    queryFn: communitiesApi.list,
  });

  const { data: publicCommunities } = useQuery({
    queryKey: ['communities-public'],
    queryFn: communitiesApi.listPublic,
  });

  const filteredPublicCommunities = useMemo(() => {
    if (!publicCommunities || !searchExisting.trim()) return publicCommunities || [];
    const q = searchExisting.toLowerCase();
    return publicCommunities.filter(c =>
      c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
    );
  }, [publicCommunities, searchExisting]);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string; isPublic: boolean }) =>
      communitiesApi.create(data),
    onSuccess: (community) => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities-public'] });
      closeCreate();
      navigate(`/communities/${community.id}/settings`);
    },
  });

  const joinMutation = useMutation({
    mutationFn: (id: string) => communitiesApi.join(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities-public'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: (id: string) => communitiesApi.leave(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities-public'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
    },
  });

  // Public communities the user hasn't joined yet
  const joinableCommunities = useMemo(() => {
    if (!publicCommunities || !communities) return [];
    const myIds = new Set(communities.map(c => c.id));
    return publicCommunities.filter(c => !myIds.has(c.id));
  }, [publicCommunities, communities]);

  const closeCreate = () => {
    setShowCreate(false);
    setStep('awareness');
    setSearchExisting('');
    setNewName('');
    setNewDescription('');
    setWantPublic(false);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim() && newDescription.trim()) {
      createMutation.mutate({
        name: newName.trim(),
        description: newDescription.trim(),
        isPublic: wantPublic,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">Chargement...</div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Community cards */}
        {!communities || communities.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium">Aucune communauté</p>
              <p className="text-sm text-muted-foreground">Vous ne faites partie d'aucune communauté pour le moment.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-tour="communities-grid">
            {communities.map(community => {
              const config = ROLE_CONFIG[community.role || 'MEMBER'] || ROLE_CONFIG.MEMBER;
              const RoleIcon = config.icon;
              return (
                <Link
                  key={community.id}
                  to={`/communities/${community.id}`}
                  className="group relative border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-colors"
                >
                  {/* Cover */}
                  {community.coverUrl ? (
                    <div className="h-24 bg-cover bg-center" style={{ backgroundImage: `url(${community.coverUrl})` }} />
                  ) : (
                    <div className="h-24 bg-gradient-to-r from-primary/20 to-primary/5" />
                  )}

                  {/* Avatar overlay */}
                  <div className="absolute top-16 left-4">
                    {community.avatarUrl ? (
                      <img src={community.avatarUrl} alt="" className="w-12 h-12 rounded-xl border-4 border-background object-cover shadow" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl border-4 border-background bg-primary/10 flex items-center justify-center shadow">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                    )}
                  </div>

                  {/* Pending badge */}
                  {community.pendingPublic && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-full text-[10px] font-medium">
                      <Clock className="w-3 h-3" />
                      Publication en attente
                    </div>
                  )}

                  {/* Content */}
                  <div className="pt-8 px-4 pb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{community.name}</h3>
                      {community.isPublic ? (
                        <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                    {community.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{community.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {community.memberCount || 0} membre{(community.memberCount || 0) > 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <FolderOpen className="w-3.5 h-3.5" />
                        {community.spaceCount || 0} espace{(community.spaceCount || 0) > 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1 ml-auto">
                        <RoleIcon className={`w-3.5 h-3.5 ${config.color}`} />
                        {config.label}
                      </span>
                    </div>
                    {community.role === 'MEMBER' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (confirm(`Quitter la communauté "${community.name}" ?`)) {
                            leaveMutation.mutate(community.id);
                          }
                        }}
                        className="flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-destructive transition-colors"
                        disabled={leaveMutation.isPending}
                      >
                        <LogOut className="w-3 h-3" />
                        Quitter
                      </button>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Joinable public communities */}
        {joinableCommunities.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Communautés publiques à rejoindre
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {joinableCommunities.map(community => (
                <div
                  key={community.id}
                  className="border border-dashed border-border rounded-xl p-4 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{community.name}</h3>
                    <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  </div>
                  {community.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{community.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {community.memberCount} membre{community.memberCount > 1 ? 's' : ''} · {community.spaceCount} espace{community.spaceCount > 1 ? 's' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => joinMutation.mutate(community.id)}
                      disabled={joinMutation.isPending}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                    >
                      <LogIn className="w-3 h-3" />
                      Rejoindre
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create community modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeCreate}>
          <div
            className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">
                {step === 'awareness' ? 'Créer une communauté' : 'Informations'}
              </h2>
              <button onClick={closeCreate} className="p-1 rounded-md hover:bg-accent">
                <X className="w-5 h-5" />
              </button>
            </div>

            {step === 'awareness' ? (
              <div className="px-6 py-5 space-y-5">
                {/* Warning */}
                <div className="flex gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm space-y-2">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Créer une communauté est un engagement
                    </p>
                    <p className="text-amber-700 dark:text-amber-300">
                      Une communauté regroupe des personnes autour d'un sujet commun. En tant que créateur, vous en serez le propriétaire et devrez :
                    </p>
                    <ul className="list-disc pl-4 text-amber-700 dark:text-amber-300 space-y-1">
                      <li>Rédiger une description claire de son objet</li>
                      <li>Inviter et accueillir les membres</li>
                      <li>Organiser les espaces et le contenu</li>
                      <li>Administrer régulièrement (modération, mises à jour)</li>
                    </ul>
                  </div>
                </div>

                {/* Check existing communities */}
                <div className="space-y-3">
                  <p className="text-sm font-medium">
                    Vérifiez d'abord qu'elle n'existe pas déjà :
                  </p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      value={searchExisting}
                      onChange={(e) => setSearchExisting(e.target.value)}
                      placeholder="Rechercher parmi les communautés publiques..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                      autoFocus
                    />
                  </div>
                  {filteredPublicCommunities.length > 0 ? (
                    <div className="border border-border rounded-md divide-y divide-border max-h-48 overflow-y-auto">
                      {filteredPublicCommunities.map(c => (
                        <div key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <span className="font-medium truncate block">{c.name}</span>
                            {c.description && (
                              <span className="text-xs text-muted-foreground truncate block">{c.description}</span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                            {c.memberCount} membre{c.memberCount > 1 ? 's' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : searchExisting.trim() ? (
                    <p className="text-xs text-muted-foreground italic">Aucune communauté publique trouvée.</p>
                  ) : null}
                </div>

                {/* Continue button */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => { if (searchExisting.trim() && !newName) setNewName(searchExisting.trim()); setStep('form'); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                  >
                    Je comprends, continuer
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Nom <span className="text-destructive">*</span></label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex : Équipe Marketing, Club Photo..."
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Description <span className="text-destructive">*</span></label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Décrivez l'objet de cette communauté, ses membres cibles, ses objectifs..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                    required
                  />
                </div>

                {/* Visibility */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Visibilité</label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="visibility"
                        checked={!wantPublic}
                        onChange={() => setWantPublic(false)}
                        className="mt-0.5 accent-primary"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <Lock className="w-3.5 h-3.5" />
                          Privée
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Accessible uniquement sur invitation. Vous pourrez la rendre publique plus tard.
                        </p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="visibility"
                        checked={wantPublic}
                        onChange={() => setWantPublic(true)}
                        className="mt-0.5 accent-primary"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <Globe className="w-3.5 h-3.5" />
                          Publique
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Visible par tous, n'importe qui peut la rejoindre.
                        </p>
                      </div>
                    </label>
                  </div>
                  {wantPublic && (
                    <div className="flex gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
                      <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        La communauté sera créée en <strong>privé</strong> et une demande de publication sera envoyée à un administrateur pour validation.
                        Vous pourrez commencer à l'organiser immédiatement.
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('awareness')}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Retour
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={closeCreate}
                      className="px-3 py-2 text-sm border border-border rounded-md hover:bg-accent"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={!newName.trim() || !newDescription.trim() || createMutation.isPending}
                      className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                    >
                      {createMutation.isPending ? 'Création...' : 'Créer la communauté'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
