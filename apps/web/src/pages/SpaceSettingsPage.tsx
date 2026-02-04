import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RotateCcw, Save, Loader2, Building2 } from 'lucide-react';
import { useReferentiels, useUpdateReferentiels, useResetReferentiels, useCheckStatusUsage } from '../hooks/useReferentiels';
import { useSpace, useUpdateSpace } from '../hooks/useSpaces';
import { communitiesApi } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { StatusManager } from '../components/settings/StatusManager';
import { TypeLabelsManager } from '../components/settings/TypeLabelsManager';
import type { StatusConfig, TypeLabelConfig } from '@spok/shared';

export function SpaceSettingsPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();

  const { data: space, isLoading: spaceLoading } = useSpace(spaceId!);
  const { data: referentielsData, isLoading: referentielsLoading } = useReferentiels(spaceId!);
  const updateMutation = useUpdateReferentiels(spaceId!);
  const resetMutation = useResetReferentiels(spaceId!);
  const checkUsageMutation = useCheckStatusUsage(spaceId!);
  const updateSpaceMutation = useUpdateSpace(spaceId!);

  // Fetch communities user belongs to
  const { data: communities } = useQuery({
    queryKey: ['communities'],
    queryFn: () => communitiesApi.list(),
  });

  const [localStatuses, setLocalStatuses] = useState<StatusConfig[] | null>(null);
  const [localTypeLabels, setLocalTypeLabels] = useState<Record<string, TypeLabelConfig> | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Space info state
  const [editName, setEditName] = useState('');
  const [editCommunityId, setEditCommunityId] = useState<string>('');

  // Initialize local state when data loads
  useEffect(() => {
    if (referentielsData && localStatuses === null) {
      setLocalStatuses(referentielsData.referentiels.statuses);
      setLocalTypeLabels(referentielsData.referentiels.typeLabels);
    }
  }, [referentielsData, localStatuses]);

  // Initialize space info state
  useEffect(() => {
    if (space && !editName) {
      setEditName(space.name);
      setEditCommunityId(space.communityId || '');
    }
  }, [space, editName]);

  const handleStatusesChange = (statuses: StatusConfig[]) => {
    setLocalStatuses(statuses);
    setHasChanges(true);
  };

  const handleTypeLabelsChange = (typeLabels: Record<string, TypeLabelConfig>) => {
    setLocalTypeLabels(typeLabels);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!localStatuses || !localTypeLabels) return;

    await updateMutation.mutateAsync({
      statuses: localStatuses,
      typeLabels: localTypeLabels,
    });
    setHasChanges(false);
  };

  const handleReset = async () => {
    if (!confirm('Réinitialiser tous les paramètres aux valeurs par défaut ?')) return;

    const result = await resetMutation.mutateAsync();
    setLocalStatuses(result.referentiels.statuses);
    setLocalTypeLabels(result.referentiels.typeLabels);
    setHasChanges(false);
  };

  const handleCheckUsage = async (statusId: string) => {
    const result = await checkUsageMutation.mutateAsync(statusId);
    return result;
  };

  const handleSaveSpaceInfo = async () => {
    if (!space) return;

    const updates: { name?: string; communityId?: string | null } = {};
    if (editName !== space.name) updates.name = editName;
    const newCommunityId = editCommunityId || null;
    if (newCommunityId !== space.communityId) updates.communityId = newCommunityId;

    if (Object.keys(updates).length > 0) {
      await updateSpaceMutation.mutateAsync(updates);
    }
  };

  const hasSpaceInfoChanges = space && (
    editName !== space.name ||
    (editCommunityId || null) !== space.communityId
  );

  const communityOptions = [
    { value: '', label: 'Aucune communauté' },
    ...(communities?.map((c) => ({ value: c.id, label: c.name })) || []),
  ];

  // Check permissions
  const canEdit = space?.role === 'OWNER' || space?.role === 'ADMIN';

  if (spaceLoading || referentielsLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            Vous n'avez pas les permissions pour modifier les paramètres de cet espace.
          </p>
          <Link
            to={`/spaces/${spaceId}`}
            className="text-yellow-700 underline hover:text-yellow-900 mt-2 inline-block"
          >
            Retour à l'espace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/spaces/${spaceId}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Paramètres de l'espace</h1>
            <p className="text-muted-foreground">{space?.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={resetMutation.isPending}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Réinitialiser
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Enregistrer
          </Button>
        </div>
      </div>

      {/* Info banner */}
      {referentielsData?.isDefault && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 text-sm">
            Cet espace utilise actuellement les paramètres par défaut.
            Les modifications seront sauvegardées spécifiquement pour cet espace.
          </p>
        </div>
      )}

      {/* Unsaved changes warning */}
      {hasChanges && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 text-sm">
            Vous avez des modifications non enregistrées.
          </p>
        </div>
      )}

      {/* Settings sections */}
      <div className="space-y-8">
        {/* General info */}
        {space?.type === 'GROUP' && (
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Informations générales
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nom de l'espace</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nom de l'espace"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Communauté</label>
                <Select
                  value={editCommunityId}
                  onChange={(e) => setEditCommunityId(e.target.value)}
                  options={communityOptions}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Rattacher cet espace à une communauté dont vous êtes membre
                </p>
              </div>
              {hasSpaceInfoChanges && (
                <Button
                  onClick={handleSaveSpaceInfo}
                  disabled={updateSpaceMutation.isPending}
                  size="sm"
                >
                  {updateSpaceMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Enregistrer les modifications
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Statuses */}
        <div className="bg-card border rounded-lg p-6">
          {localStatuses && (
            <StatusManager
              statuses={localStatuses}
              onChange={handleStatusesChange}
              onCheckUsage={handleCheckUsage}
            />
          )}
        </div>

        {/* Type Labels */}
        <div className="bg-card border rounded-lg p-6">
          {localTypeLabels && (
            <TypeLabelsManager
              typeLabels={localTypeLabels}
              onChange={handleTypeLabelsChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}
