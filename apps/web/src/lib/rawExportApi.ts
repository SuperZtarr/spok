/* Appels de l'export brut réimportable (« Données brutes », routes API routes/raw-export.ts, registre shared rawExport.ts).
   Module à part de lib/api.ts parce que l'export renvoie le texte du fichier (JSON ou XML), pas un JSON à interpréter :
   jeton via getValidAccessToken (refresh proactif) et en-tête du mode admin, comme les autres flux hors fetchApi.
   - fetchRawExport(spaceId, format) : texte du fichier (l'espace et ses sous-espaces lisibles) ;
   - rawImport(body) : aperçu (dryRun: true) ou import ; erreur → ApiError avec le message de l'API (lisible). */
import type { RawExportFileFormat, RawImportReport } from '@spok/shared';
import { ApiError, LIVE_API_URL as API_URL, adminModeHeaders, getValidAccessToken } from './api';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getValidAccessToken();
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...adminModeHeaders() };
}

async function failure(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => ({} as { message?: string }));
  return new ApiError(response.status, body.message || `Erreur ${response.status}`, body);
}

export async function fetchRawExport(spaceId: string, format: RawExportFileFormat): Promise<string> {
  const response = await fetch(`${API_URL}/spaces/${encodeURIComponent(spaceId)}/raw-export?format=${format}`, { headers: await authHeaders() });
  if (!response.ok) throw await failure(response);
  return response.text();
}

export interface RawImportRequest {
  format: RawExportFileFormat;
  content: string;
  communityId?: string;
  parentSpaceId?: string;
  dryRun: boolean;
}

export async function rawImport(body: RawImportRequest): Promise<RawImportReport> {
  const response = await fetch(`${API_URL}/spaces/raw-import`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await failure(response);
  return response.json();
}
