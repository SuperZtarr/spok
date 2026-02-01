import type {
  AuthResponse,
  LoginInput,
  RegisterInput,
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
} from '@spok/shared';

const API_URL = import.meta.env.VITE_API_URL || '/api';

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
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
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

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
        throw new ApiError(401, 'Session expirée. Veuillez vous reconnecter.');
      }
    }

    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new ApiError(response.status, error.message || 'An error occurred');
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

  me: () => fetchApi<{ id: string; email: string; name: string }>('/auth/me'),

  logout: (refreshToken: string) =>
    fetchApi<{ success: boolean }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
};

// Spaces
export const spacesApi = {
  list: () => fetchApi<SpaceWithRole[]>('/spaces'),

  get: (id: string) => fetchApi<SpaceWithRole & { itemCount: number }>(`/spaces/${id}`),

  create: (data: CreateSpaceInput) =>
    fetchApi<SpaceWithRole>('/spaces', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { name?: string }) =>
    fetchApi<SpaceWithRole>(`/spaces/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/spaces/${id}`, {
      method: 'DELETE',
    }),

  getMembers: (id: string) => fetchApi<SpaceMember[]>(`/spaces/${id}/members`),

  invite: (id: string, data: { email: string; role: string }) =>
    fetchApi<SpaceMember>(`/spaces/${id}/invite`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Items
export const itemsApi = {
  list: (spaceId: string, params?: ItemFilterParams) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString());
    if (params?.type) searchParams.set('type', params.type);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.parentId !== undefined) searchParams.set('parentId', params.parentId || '');
    if (params?.search) searchParams.set('search', params.search);

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

  delete: (spaceId: string, id: string) =>
    fetchApi<{ success: boolean }>(`/spaces/${spaceId}/items/${id}`, {
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

export { ApiError };
