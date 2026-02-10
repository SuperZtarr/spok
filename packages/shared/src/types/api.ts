export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface ItemFilterParams extends PaginationParams {
  type?: string;
  status?: string;
  parentId?: string | null;
  search?: string;
}

export interface ConflictField {
  field: string;
  label: string;
  serverValue: unknown;
  clientValue: unknown;
}

export interface ConflictErrorResponse {
  statusCode: 409;
  code: 'CONFLICT_DETECTED';
  message: string;
  serverUpdatedAt: string;
  conflicts: ConflictField[];
}
