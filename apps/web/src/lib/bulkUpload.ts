/*
 * Orchestration de l'import en masse de fichiers (vues Images et Documents), indépendante de React et de l'API.
 * Pour chaque fichier : prepare (réduction d'image) → validateUploadFile → createItem (titre = nom sans
 * extension) → upload ; si l'envoi échoue, l'item créé est supprimé pour ne pas laisser d'item vide.
 * Parallélisme borné (concurrency, 3 par défaut) ; onProgress(done, total) après chaque fichier, réussi ou non.
 * Les dépendances (deps) sont injectées : useBulkUpload les branche sur itemsApi, les tests sur des simulacres.
 */
import { validateUploadFile, titleFromFileName, type UploadKind } from './uploadRules';

export interface BulkUploadDeps {
  prepare: (file: File) => Promise<File>;
  createItem: (title: string) => Promise<string>;
  upload: (itemId: string, file: File) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
}

export interface BulkUploadFailure {
  name: string;
  reason: string;
}

export interface BulkUploadResult {
  succeeded: number;
  failures: BulkUploadFailure[];
}

export interface BulkUploadOptions {
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
}

function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Erreur inconnue';
}

export async function runBulkUpload(
  files: File[],
  kind: UploadKind,
  deps: BulkUploadDeps,
  { concurrency = 3, onProgress }: BulkUploadOptions = {},
): Promise<BulkUploadResult> {
  const failures: BulkUploadFailure[] = [];
  let succeeded = 0;
  let done = 0;
  let next = 0;

  const processOne = async (original: File) => {
    let itemId: string | null = null;
    try {
      const file = await deps.prepare(original);
      const invalid = validateUploadFile(file, kind);
      if (invalid) {
        failures.push({ name: original.name, reason: invalid });
        return;
      }
      itemId = await deps.createItem(titleFromFileName(original.name));
      await deps.upload(itemId, file);
      succeeded++;
    } catch (err) {
      failures.push({ name: original.name, reason: errorMessage(err) });
      if (itemId) await deps.deleteItem(itemId).catch(() => {});
    } finally {
      done++;
      onProgress?.(done, files.length);
    }
  };

  const worker = async () => {
    while (next < files.length) {
      const file = files[next++];
      await processOne(file);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  return { succeeded, failures };
}
