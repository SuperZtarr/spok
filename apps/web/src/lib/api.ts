import type {
  AuthResponse,
  LoginInput,
  RegisterInput,
  ThemePreference,
  UpdatePreferencesInput,
  SpaceWithRole,
  CreateSpaceInput,
  Item,
  ItemWithRelations,
  CreateItemInput,
  UpdateItemInput,
  Tag,
  CreateTagInput,
  PaginatedResponse,
  ItemFilterParams,
  SpaceMember,
  CreateRelationInput,
  AdminUser,
  AdminUserDetail,
  CreateUserInput,
  UpdateUserInput,
  GlobalRole,
  Role,
  SpaceReferentiels,
  ReferentielsResponse,
  AuditLog,
  AuditLogFilters,
  AuditLogListResponse,
  Community,
  CommunityWithRole,
  CommunityMember,
  CreateCommunityInput,
  UpdateCommunityInput,
  InviteCommunityMemberInput,
  AdminCommunity,
  AdminCommunityDetail,
  CommunityRole,
  ContributionWithAuthor,
  CreateContributionInput,
  UpdateContributionInput,
  SunburstNode,
} from '@spok/shared';

// API URL is injected at build time via VITE_API_URL environment variable
const API_URL = import.meta.env.VITE_API_URL || '/api';

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Messages d'erreur explicites selon le code HTTP
 */
const HTTP_ERROR_MESSAGES: Record<number, string> = {
  400: 'Requête invalide. Vérifiez les données envoyées.',
  401: 'Non authentifié. Veuillez vous connecter.',
  403: 'Accès refusé. Vous n\'avez pas les permissions nécessaires.',
  404: 'Ressource non trouvée.',
  409: 'Conflit. Cette ressource existe déjà.',
  422: 'Données invalides. Vérifiez le format des champs.',
  429: 'Trop de requêtes. Veuillez patienter avant de réessayer.',
  500: 'Erreur serveur. Veuillez réessayer plus tard.',
  502: 'Le serveur API est inaccessible. Vérifiez qu\'il est démarré.',
  503: 'Service temporairement indisponible. Veuillez réessayer.',
  504: 'Le serveur API ne répond pas. Vérifiez la connexion.',
};

/**
 * Vérifie si la réponse est du JSON valide
 */
function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type');
  return contentType !== null && contentType.includes('application/json');
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const authStorage = localStorage.getItem('auth-storage');
  if (!authStorage) return false;

  try {
    const { state } = JSON.parse(authStorage);
    const refreshToken = state?.refreshToken;
    if (!refreshToken) return false;

    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    const newAccessToken = data.tokens.accessToken;
    const newRefreshToken = data.tokens.refreshToken;

    // Update localStorage
    localStorage.setItem('accessToken', newAccessToken);
    const newState = {
      ...state,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
    localStorage.setItem('auth-storage', JSON.stringify({ state: newState }));

    return true;
  } catch {
    return false;
  }
}

function clearAuth() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('auth-storage');
  // Dispatch event to notify the app to logout
  window.dispatchEvent(new CustomEvent('auth:logout'));
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const token = localStorage.getItem('accessToken');

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  // Only set Content-Type: application/json when there is a body
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (networkError) {
    // Erreur réseau (pas de connexion, DNS, etc.)
    const message = `Impossible de contacter le serveur API (${API_URL}). ` +
      'Vérifiez que le serveur est démarré et accessible.';
    throw new ApiError(0, message, { originalError: String(networkError) }, 'NETWORK_ERROR');
  }

  if (!response.ok) {
    // Handle 401 Unauthorized - try to refresh token
    if (response.status === 401 && !isRetry && !endpoint.startsWith('/auth/')) {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = tryRefreshToken();
      }

      const refreshed = await refreshPromise;
      isRefreshing = false;
      refreshPromise = null;

      if (refreshed) {
        // Retry the original request with new token
        return fetchApi<T>(endpoint, options, true);
      } else {
        // Refresh failed, clear auth (ProtectedRoute will redirect)
        clearAuth();
        throw new ApiError(401, 'Session expirée. Veuillez vous reconnecter.', undefined, 'SESSION_EXPIRED');
      }
    }

    // Vérifier si la réponse est du JSON
    if (!isJsonResponse(response)) {
      // La réponse n'est pas du JSON - probablement le mauvais serveur (frontend au lieu de l'API)
      const text = await response.text().catch(() => '');
      const isHtmlResponse = text.includes('<!DOCTYPE html>') || text.includes('<html');

      if (isHtmlResponse) {
        const message = `L'API n'est pas accessible sur ${API_URL}. ` +
          'Le port semble être occupé par un autre service (probablement le frontend). ' +
          'Vérifiez que l\'API est bien démarrée sur le bon port.';
        throw new ApiError(response.status, message, { receivedHtml: true }, 'WRONG_SERVER');
      }

      const defaultMessage = HTTP_ERROR_MESSAGES[response.status] ||
        `Erreur ${response.status}: ${response.statusText}`;
      throw new ApiError(response.status, defaultMessage, { rawResponse: text });
    }

    // Parser l'erreur JSON du serveur
    const error = await response.json().catch(() => ({}));

    // Construire un message explicite
    let message = error.message || error.error || HTTP_ERROR_MESSAGES[response.status];

    // Ajouter des détails si disponibles
    if (error.details && typeof error.details === 'string') {
      message = `${message} (${error.details})`;
    }

    // Ajouter le champ en erreur pour les erreurs de validation
    if (error.field) {
      message = `${message} [Champ: ${error.field}]`;
    }

    throw new ApiError(
      response.status,
      message || `Erreur ${response.status}`,
      error,
      error.code
    );
  }

  // Vérifier que la réponse réussie est bien du JSON
  if (!isJsonResponse(response)) {
    const text = await response.text().catch(() => '');
    if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
      throw new ApiError(
        200,
        `L'API a retourné une page HTML au lieu de JSON. ` +
        `Vérifiez que l'API est bien démarrée sur ${API_URL}.`,
        { receivedHtml: true },
        'WRONG_SERVER'
      );
    }
  }

  return response.json();
}

// Auth
export const authApi = {
  register: (data: RegisterInput) =>
    fetchApi<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: LoginInput) =>
    fetchApi<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  refresh: (refreshToken: string) =>
    fetchApi<{ tokens: { accessToken: string; refreshToken: string } }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  me: () => fetchApi<{ id: string; email: string; name: string; globalRole: GlobalRole; themePreference: ThemePreference; avatarUrl?: string }>('/auth/me'),

  logout: (refreshToken: string) =>
    fetchApi<{ success: boolean }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
};

// User preferences & avatar
export const userApi = {
  getPreferences: () =>
    fetchApi<{ themePreference: ThemePreference }>('/user/preferences'),

  updatePreferences: (data: UpdatePreferencesInput) =>
    fetchApi<{ themePreference: ThemePreference }>('/user/preferences', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateProfile: (data: { name?: string; email?: string }) =>
    fetchApi<{ name: string; email: string; tokens?: { accessToken: string; refreshToken: string } }>('/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    fetchApi<{ success: boolean }>('/user/password', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  uploadAvatar: async (file: File): Promise<{ avatarUrl: string }> => {
    const token = localStorage.getItem('accessToken');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/user/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.message || 'Erreur upload avatar', error);
    }

    return response.json();
  },

  deleteAvatar: () =>
    fetchApi<{ success: boolean }>('/user/avatar', { method: 'DELETE' }),
};

// User Tasks (global across spaces)
export interface GlobalTaskFilters {
  type?: string;
  status?: string;
  priority?: string;
  spaceId?: string;
  search?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  noDueDate?: boolean;
  sortBy?: 'dueDate' | 'status' | 'spaceName' | 'createdAt' | 'priority' | 'title';
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface GlobalTask {
  id: string;
  title: string;
  type: string;
  status: string | null;
  priority: number | null;
  dueDate: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  spaceId: string;
  createdById: string;
  parentId: string | null;
  description: string | null;
  spaceName: string;
  createdByName: string;
  space: { id: string; name: string };
  createdBy: { id: string; name: string };
  parent: { id: string; title: string } | null;
  tags: { id: string; name: string; color: string | null }[];
}

export const userTasksApi = {
  list: (params?: GlobalTaskFilters) => {
    const sp = new URLSearchParams();
    if (params?.type) sp.set('type', params.type);
    if (params?.status) sp.set('status', params.status);
    if (params?.priority) sp.set('priority', params.priority);
    if (params?.spaceId) sp.set('spaceId', params.spaceId);
    if (params?.search) sp.set('search', params.search);
    if (params?.dueDateFrom) sp.set('dueDateFrom', params.dueDateFrom);
    if (params?.dueDateTo) sp.set('dueDateTo', params.dueDateTo);
    if (params?.noDueDate) sp.set('noDueDate', 'true');
    if (params?.sortBy) sp.set('sortBy', params.sortBy);
    if (params?.sortDir) sp.set('sortDir', params.sortDir);
    if (params?.page) sp.set('page', params.page.toString());
    if (params?.pageSize) sp.set('pageSize', params.pageSize.toString());
    const query = sp.toString();
    return fetchApi<PaginatedResponse<GlobalTask>>(`/user/tasks${query ? `?${query}` : ''}`);
  },
};

// Spaces
export const spacesApi = {
  list: (communityId?: string, parentId?: string) => {
    const params = new URLSearchParams();
    if (communityId !== undefined) params.set('communityId', communityId);
    if (parentId !== undefined) params.set('parentId', parentId);
    const query = params.toString();
    return fetchApi<SpaceWithRole[]>(`/spaces${query ? `?${query}` : ''}`);
  },

  get: (id: string) => fetchApi<SpaceWithRole & { itemCount: number }>(`/spaces/${id}`),

  create: (data: CreateSpaceInput) =>
    fetchApi<SpaceWithRole>('/spaces', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { name?: string; communityId?: string | null; parentId?: string | null }) =>
    fetchApi<SpaceWithRole>(`/spaces/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/spaces/${id}`, {
      method: 'DELETE',
    }),

  join: (id: string) =>
    fetchApi<{ success: boolean }>(`/spaces/${id}/join`, {
      method: 'POST',
    }),

  leave: (id: string) =>
    fetchApi<{ success: boolean }>(`/spaces/${id}/leave`, {
      method: 'POST',
    }),

  getMembers: (id: string) => fetchApi<SpaceMember[]>(`/spaces/${id}/members`),

  invite: (id: string, data: { email: string; role: string }) =>
    fetchApi<SpaceMember>(`/spaces/${id}/invite`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  uploadAvatar: async (id: string, file: File): Promise<{ avatarUrl: string }> => {
    const token = localStorage.getItem('accessToken');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/spaces/${id}/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.message || 'Erreur upload avatar', error);
    }

    return response.json();
  },

  deleteAvatar: (id: string) =>
    fetchApi<{ success: boolean }>(`/spaces/${id}/avatar`, { method: 'DELETE' }),

  uploadCover: async (id: string, file: File): Promise<{ coverUrl: string }> => {
    const token = localStorage.getItem('accessToken');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/spaces/${id}/cover`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.message || 'Erreur upload couverture', error);
    }

    return response.json();
  },

  deleteCover: (id: string) =>
    fetchApi<{ success: boolean }>(`/spaces/${id}/cover`, { method: 'DELETE' }),
};

// Communities
export const communitiesApi = {
  list: () => fetchApi<CommunityWithRole[]>('/communities'),

  get: (id: string) => fetchApi<CommunityWithRole>(`/communities/${id}`),

  update: (id: string, data: UpdateCommunityInput) =>
    fetchApi<CommunityWithRole>(`/communities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/communities/${id}`, {
      method: 'DELETE',
    }),

  getMembers: (id: string) => fetchApi<CommunityMember[]>(`/communities/${id}/members`),

  invite: (id: string, data: InviteCommunityMemberInput) =>
    fetchApi<CommunityMember>(`/communities/${id}/invite`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeMember: (id: string, memberId: string) =>
    fetchApi<{ success: boolean }>(`/communities/${id}/members/${memberId}`, {
      method: 'DELETE',
    }),

  updateMemberRole: (id: string, memberId: string, role: CommunityRole) =>
    fetchApi<CommunityMember>(`/communities/${id}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  listPublic: () =>
    fetchApi<Array<Community & { memberCount: number; spaceCount: number }>>('/communities/public'),

  join: (id: string) =>
    fetchApi<{ success: boolean }>(`/communities/${id}/join`, {
      method: 'POST',
    }),

  leave: (id: string) =>
    fetchApi<{ success: boolean }>(`/communities/${id}/leave`, {
      method: 'POST',
    }),

  uploadAvatar: async (id: string, file: File): Promise<{ avatarUrl: string }> => {
    const token = localStorage.getItem('accessToken');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/communities/${id}/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.message || 'Erreur upload avatar', error);
    }

    return response.json();
  },

  deleteAvatar: (id: string) =>
    fetchApi<{ success: boolean }>(`/communities/${id}/avatar`, { method: 'DELETE' }),

  uploadCover: async (id: string, file: File): Promise<{ coverUrl: string }> => {
    const token = localStorage.getItem('accessToken');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/communities/${id}/cover`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.message || 'Erreur upload couverture', error);
    }

    return response.json();
  },

  deleteCover: (id: string) =>
    fetchApi<{ success: boolean }>(`/communities/${id}/cover`, { method: 'DELETE' }),
};

// Items
export const itemsApi = {
  list: (spaceId: string, params?: ItemFilterParams & { include?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString());
    if (params?.type) searchParams.set('type', params.type);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.parentId !== undefined) searchParams.set('parentId', params.parentId || '');
    if (params?.search) searchParams.set('search', params.search);
    if (params?.include) searchParams.set('include', params.include);

    const query = searchParams.toString();
    return fetchApi<PaginatedResponse<Item>>(`/spaces/${spaceId}/items${query ? `?${query}` : ''}`);
  },

  get: (spaceId: string, id: string) =>
    fetchApi<ItemWithRelations>(`/spaces/${spaceId}/items/${id}`),

  create: (spaceId: string, data: CreateItemInput) =>
    fetchApi<Item>(`/spaces/${spaceId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (spaceId: string, id: string, data: UpdateItemInput) =>
    fetchApi<Item>(`/spaces/${spaceId}/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (spaceId: string, id: string, options?: { deleteChildren?: boolean }) =>
    fetchApi<{ success: boolean }>(`/spaces/${spaceId}/items/${id}${options?.deleteChildren ? '?deleteChildren=true' : ''}`, {
      method: 'DELETE',
    }),

  createRelation: (spaceId: string, id: string, data: CreateRelationInput) =>
    fetchApi<{ id: string }>(`/spaces/${spaceId}/items/${id}/relations`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteRelation: (spaceId: string, itemId: string, relationId: string) =>
    fetchApi<{ success: boolean }>(`/spaces/${spaceId}/items/${itemId}/relations/${relationId}`, {
      method: 'DELETE',
    }),

  move: (spaceId: string, id: string, data: { parentId?: string | null; position: number }) =>
    fetchApi<{ success: boolean }>(`/spaces/${spaceId}/items/${id}/move`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  bulkMove: (
    spaceId: string,
    data: { itemIds: string[]; targetSpaceId: string; includeChildren?: boolean }
  ) =>
    fetchApi<{ success: boolean; movedCount: number; targetSpaceId: string }>(
      `/spaces/${spaceId}/items/bulk-move`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  bulkDuplicate: (
    spaceId: string,
    data: { itemIds: string[]; targetSpaceId: string; includeChildren?: boolean }
  ) =>
    fetchApi<{ success: boolean; duplicatedCount: number; targetSpaceId: string }>(
      `/spaces/${spaceId}/items/bulk-duplicate`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  // Contributions
  listContributions: (spaceId: string, itemId: string) =>
    fetchApi<ContributionWithAuthor[]>(`/spaces/${spaceId}/items/${itemId}/contributions`),

  createContribution: (spaceId: string, itemId: string, data: CreateContributionInput) =>
    fetchApi<ContributionWithAuthor>(`/spaces/${spaceId}/items/${itemId}/contributions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateContribution: (spaceId: string, itemId: string, contributionId: string, data: UpdateContributionInput) =>
    fetchApi<ContributionWithAuthor>(`/spaces/${spaceId}/items/${itemId}/contributions/${contributionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteContribution: (spaceId: string, itemId: string, contributionId: string) =>
    fetchApi<{ success: boolean }>(`/spaces/${spaceId}/items/${itemId}/contributions/${contributionId}`, {
      method: 'DELETE',
    }),

  uploadImage: async (spaceId: string, itemId: string, file: File): Promise<Item> => {
    const token = localStorage.getItem('accessToken');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/spaces/${spaceId}/items/${itemId}/image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.message || 'Erreur upload image', error);
    }

    return response.json();
  },

  uploadDocument: async (spaceId: string, itemId: string, file: File): Promise<Item> => {
    const token = localStorage.getItem('accessToken');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/spaces/${spaceId}/items/${itemId}/document`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.message || 'Erreur upload document', error);
    }

    return response.json();
  },
};

// Tags
export const tagsApi = {
  list: (spaceId: string) => fetchApi<(Tag & { itemCount: number })[]>(`/spaces/${spaceId}/tags`),

  create: (spaceId: string, data: CreateTagInput) =>
    fetchApi<Tag>(`/spaces/${spaceId}/tags`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (spaceId: string, id: string, data: Partial<CreateTagInput>) =>
    fetchApi<Tag>(`/spaces/${spaceId}/tags/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (spaceId: string, id: string) =>
    fetchApi<{ success: boolean }>(`/spaces/${spaceId}/tags/${id}`, {
      method: 'DELETE',
    }),
};

// Search
interface SearchResults {
  items: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    spaceId: string;
    spaceName: string;
    createdAt: string;
    description: string | null;
  }>;
  contributions: Array<{
    id: string;
    content: string | null;
    itemId: string;
    itemTitle: string;
    spaceId: string;
    spaceName: string;
    authorName: string;
    createdAt: string;
  }>;
  totalItems: number;
  totalContributions: number;
}

export const searchApi = {
  search: (q: string, page?: number, pageSize?: number) =>
    fetchApi<SearchResults>(
      `/search?q=${encodeURIComponent(q)}&page=${page || 1}&pageSize=${pageSize || 20}`
    ),
};

// Health check (no auth required)
export const healthApi = {
  check: async (): Promise<{
    status: string;
    database: string;
    databaseError?: string;
    timestamp: string;
    env?: string;
  }> => {
    try {
      const response = await fetch(`${API_URL}/health`);

      // Vérifier si on reçoit du JSON
      if (!isJsonResponse(response)) {
        const text = await response.text().catch(() => '');
        if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
          throw new ApiError(
            0,
            `L'API n'est pas disponible sur ${API_URL}. ` +
              'Le serveur retourne une page HTML au lieu de JSON. ' +
              'Vérifiez que l\'API Fastify est démarrée (pnpm dev:api).',
            { receivedHtml: true },
            'WRONG_SERVER'
          );
        }
        throw new ApiError(0, 'Réponse invalide du serveur', { rawResponse: text });
      }

      return response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      // Erreur réseau
      throw new ApiError(
        0,
        `Impossible de contacter l'API sur ${API_URL}. ` +
          'Le serveur est-il démarré ? Essayez: pnpm dev:api',
        { originalError: String(error) },
        'NETWORK_ERROR'
      );
    }
  },
};

// Admin - Users
interface AdminUsersListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  anomaly?: string;
}

interface AdminUsersListResponse {
  data: AdminUser[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// Admin - Spaces
interface AdminSpacesListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: 'PERSONAL' | 'GROUP';
  anomaly?: string;
}

interface AdminSpace {
  id: string;
  name: string;
  type: 'PERSONAL' | 'GROUP';
  communityId: string | null;
  community: { id: string; name: string } | null;
  parentId: string | null;
  parent: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  itemCount: number;
  owner: { id: string; name: string; email: string } | null;
}

interface AdminSpaceDetail extends AdminSpace {
  members: AdminSpaceMember[];
}

interface AdminSpaceMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

interface AdminSpacesListResponse {
  data: AdminSpace[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// Admin - Communities
interface AdminCommunitiesListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

interface AdminCommunitiesListResponse {
  data: AdminCommunity[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const adminApi = {
  users: {
    list: (params?: AdminUsersListParams) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString());
      if (params?.search) searchParams.set('search', params.search);
      if (params?.anomaly) searchParams.set('anomaly', params.anomaly);
      const query = searchParams.toString();
      return fetchApi<AdminUsersListResponse>(`/admin/users${query ? `?${query}` : ''}`);
    },

    get: (id: string) => fetchApi<AdminUserDetail>(`/admin/users/${id}`),

    create: (data: CreateUserInput) =>
      fetchApi<AdminUser>('/admin/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: UpdateUserInput) =>
      fetchApi<AdminUser>(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      fetchApi<{ success: boolean }>(`/admin/users/${id}`, {
        method: 'DELETE',
      }),

    addToCommunity: (userId: string, data: { communityId: string; role: CommunityRole }) =>
      fetchApi<{ id: string; role: string; joinedAt: string; community: { id: string; name: string } }>(
        `/admin/users/${userId}/communities`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      ),

    removeFromCommunity: (userId: string, communityId: string) =>
      fetchApi<{ success: boolean }>(`/admin/users/${userId}/communities/${communityId}`, {
        method: 'DELETE',
      }),

    addToSpace: (userId: string, data: { spaceId: string; role: Role }) =>
      fetchApi<{ id: string; role: string; joinedAt: string; space: { id: string; name: string; type: string } }>(
        `/admin/users/${userId}/spaces`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      ),

    removeFromSpace: (userId: string, spaceId: string) =>
      fetchApi<{ success: boolean }>(`/admin/users/${userId}/spaces/${spaceId}`, {
        method: 'DELETE',
      }),
  },

  spaces: {
    list: (params?: AdminSpacesListParams) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString());
      if (params?.search) searchParams.set('search', params.search);
      if (params?.type) searchParams.set('type', params.type);
      if (params?.anomaly) searchParams.set('anomaly', params.anomaly);
      const query = searchParams.toString();
      return fetchApi<AdminSpacesListResponse>(`/admin/spaces${query ? `?${query}` : ''}`);
    },

    get: (id: string) => fetchApi<AdminSpaceDetail>(`/admin/spaces/${id}`),

    update: (id: string, data: { name?: string; type?: 'PERSONAL' | 'GROUP'; communityId?: string | null; parentId?: string | null }) =>
      fetchApi<AdminSpace>(`/admin/spaces/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      fetchApi<{ success: boolean }>(`/admin/spaces/${id}`, {
        method: 'DELETE',
      }),

    getMembers: (id: string) => fetchApi<AdminSpaceMember[]>(`/admin/spaces/${id}/members`),

    addMember: (id: string, data: { userId: string; role: string }) =>
      fetchApi<AdminSpaceMember>(`/admin/spaces/${id}/members`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateMember: (spaceId: string, memberId: string, data: { role: string }) =>
      fetchApi<AdminSpaceMember>(`/admin/spaces/${spaceId}/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    removeMember: (spaceId: string, memberId: string) =>
      fetchApi<{ success: boolean }>(`/admin/spaces/${spaceId}/members/${memberId}`, {
        method: 'DELETE',
      }),
  },

  communities: {
    list: (params?: AdminCommunitiesListParams) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString());
      if (params?.search) searchParams.set('search', params.search);
      const query = searchParams.toString();
      return fetchApi<AdminCommunitiesListResponse>(`/admin/communities${query ? `?${query}` : ''}`);
    },

    get: (id: string) => fetchApi<AdminCommunityDetail>(`/admin/communities/${id}`),

    create: (data: CreateCommunityInput & { ownerEmail?: string }) =>
      fetchApi<AdminCommunity>('/admin/communities', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: UpdateCommunityInput) =>
      fetchApi<AdminCommunity>(`/admin/communities/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      fetchApi<{ success: boolean }>(`/admin/communities/${id}`, {
        method: 'DELETE',
      }),

    addMember: (id: string, data: { email: string; role: CommunityRole }) =>
      fetchApi<CommunityMember>(`/admin/communities/${id}/members`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  tests: {
    run: () =>
      fetchApi<{
        tests: Array<{
          key: string;
          label: string;
          group: string;
          status: 'pass' | 'fail' | 'warning';
          message: string;
          count: number;
          durationMs: number;
        }>;
        summary: { total: number; passed: number; failed: number; warnings: number };
        totalDurationMs: number;
        executedAt: string;
      }>('/admin/tests'),
  },

  referentiels: {
    summary: () =>
      fetchApi<{
        defaults: {
          statuses: Array<{
            id: string;
            label: string;
            color: string;
            borderColor: string;
            order: number;
            visible: boolean;
          }>;
          typeLabels: Record<string, {
            label: string;
            labelShort: string;
            color: string;
            bgHover: string;
            visible: boolean;
            order: number;
          }>;
        };
        customizedSpaces: Array<{
          id: string;
          name: string;
          type: string;
          customStatusCount: number;
          customTypeCount: number;
        }>;
        totalSpaces: number;
        customizedCount: number;
      }>('/admin/referentiels'),
  },

  stats: {
    get: (period: string) =>
      fetchApi<{
        totals: { items: number; contributions: number; users: number; spaces: number };
        timeSeries: Array<{ date: string; itemsCreated: number; itemsModified: number; contributions: number }>;
        byType: Array<{ type: string; count: number }>;
        topSpaces: Array<{ spaceId: string; spaceName: string; itemCount: number; contributionCount: number }>;
      }>(`/admin/stats?period=${period}`),
  },

  anomalies: {
    summary: () =>
      fetchApi<{
        categories: Array<{
          key: string;
          label: string;
          group: string;
          severity: 'error' | 'warning' | 'info';
          count: number;
        }>;
        totalAnomalies: number;
        checkedAt: string;
      }>('/admin/anomalies'),

    detail: (category: string, params?: { page?: number; pageSize?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString());
      const query = searchParams.toString();
      return fetchApi<{
        category: string;
        severity: 'error' | 'warning' | 'info';
        items: Array<{
          id: string;
          title: string;
          spaceId?: string | null;
          spaceName?: string | null;
          detail?: string;
        }>;
        pagination: {
          page: number;
          pageSize: number;
          total: number;
          totalPages: number;
        };
      }>(`/admin/anomalies/${category}${query ? `?${query}` : ''}`);
    },
  },
};

// Referentiels
export const referentielsApi = {
  get: (spaceId: string) =>
    fetchApi<ReferentielsResponse>(`/spaces/${spaceId}/referentiels`),

  update: (spaceId: string, data: Partial<SpaceReferentiels>) =>
    fetchApi<ReferentielsResponse>(`/spaces/${spaceId}/referentiels`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  reset: (spaceId: string) =>
    fetchApi<ReferentielsResponse>(`/spaces/${spaceId}/referentiels/reset`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  checkStatusUsage: (spaceId: string, statusId: string) =>
    fetchApi<{ statusId: string; itemCount: number; isUsed: boolean }>(
      `/spaces/${spaceId}/referentiels/check-status-usage/${statusId}`
    ),
};

// Audit Logs
export const auditLogsApi = {
  list: (spaceId: string, params?: AuditLogFilters) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString());
    if (params?.entity) searchParams.set('entity', params.entity);
    if (params?.action) searchParams.set('action', params.action);
    if (params?.entityId) searchParams.set('entityId', params.entityId);
    if (params?.userId) searchParams.set('userId', params.userId);
    if (params?.from) searchParams.set('from', params.from);
    if (params?.to) searchParams.set('to', params.to);

    const query = searchParams.toString();
    return fetchApi<AuditLogListResponse>(`/spaces/${spaceId}/audit-logs${query ? `?${query}` : ''}`);
  },

  get: (spaceId: string, logId: string) =>
    fetchApi<AuditLog>(`/spaces/${spaceId}/audit-logs/${logId}`),

  restore: (spaceId: string, logId: string) =>
    fetchApi<{ success: boolean; restored: unknown; message: string }>(
      `/spaces/${spaceId}/audit-logs/${logId}/restore`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    ),
};

// Graph
export const graphApi = {
  space: (spaceId: string, linkTypes: string[]) =>
    fetchApi<{ nodes: any[]; links: any[] }>(`/spaces/${spaceId}/graph?linkTypes=${linkTypes.join(',')}`),

  community: (communityId: string, linkTypes: string[]) =>
    fetchApi<{ nodes: any[]; links: any[] }>(`/communities/${communityId}/graph?linkTypes=${linkTypes.join(',')}`),

  global: (linkTypes: string[], communityIds?: string[]) => {
    const params = new URLSearchParams({ linkTypes: linkTypes.join(',') });
    if (communityIds && communityIds.length > 0) {
      params.set('communityIds', communityIds.join(','));
    }
    return fetchApi<{ nodes: any[]; links: any[] }>(`/graph/global?${params.toString()}`);
  },

  sunburst: (communityIds?: string[], spaceId?: string) => {
    const params = new URLSearchParams();
    if (communityIds && communityIds.length > 0) {
      params.set('communityIds', communityIds.join(','));
    }
    if (spaceId) {
      params.set('spaceId', spaceId);
    }
    const query = params.toString();
    return fetchApi<SunburstNode>(`/graph/sunburst${query ? `?${query}` : ''}`);
  },
};

export function isConflictError(error: unknown): error is ApiError & { details: { code: 'CONFLICT_DETECTED'; conflicts: Array<{ field: string; label: string; serverValue: unknown; clientValue: unknown }>; serverUpdatedAt: string } } {
  return error instanceof ApiError && error.statusCode === 409 && (error.details as any)?.code === 'CONFLICT_DETECTED';
}

export { ApiError };
