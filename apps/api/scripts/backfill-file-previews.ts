/**
 * Rattrapage de l'aperçu des fichiers (2026-11-11) : calcule previewUrl (page 1) et excerpt (début du texte) des
 * contenus FILE envoyés avant l'aperçu, comme le fait l'envoi (utils/filePreview.ts → storeFilePreview).
 * Candidats : contenus FILE sans previewUrl ni excerpt, au format couvert (PDF, docx/xlsx/pptx, texte brut) et dont
 * le fichier est dans le stockage actif (R2, ou dossier local en dev). Lecture du fichier par son adresse publique
 * (R2) ou sur disque (mode local). Un fichier sans aperçu possible reste tel quel — rejouable, il sera retenté.
 * Sans --apply : bilan seulement. --prod : base de prod (via _env.ts) ET R2 configuré dans le .env racine (sinon
 * arrêt), à lancer APRÈS le déploiement du schéma, sur demande explicite de Thomas.
 * Exécuter : npx tsx apps/api/scripts/backfill-file-previews.ts [--prod] [--apply]
 */
import { readFile } from 'node:fs/promises';
import { prodPrisma, localPrisma, isProd } from './_env';
import { isR2Configured, isR2Url, isLocalStorageMode, localPathForKey, LOCAL_UPLOADS_URL } from '../src/utils/r2.js';
import { storeFilePreview } from '../src/utils/filePreview.js';

const prisma = isProd ? prodPrisma() : localPrisma();
const apply = process.argv.includes('--apply');
const COVERED = /\.(pdf|docx|docm|xlsx|xlsm|pptx|pptm|txt|md|markdown|csv|tsv|log)$/i;

type Row = { id: string; itemId: string; url: string | null; name: string | null; mimeType: string | null };

/** Contenu du fichier : disque en mode local, sinon adresse publique R2 */
async function readStored(url: string): Promise<Buffer> {
  if (isLocalStorageMode() && url.startsWith(`${LOCAL_UPLOADS_URL}/`)) {
    const file = localPathForKey(url.slice(LOCAL_UPLOADS_URL.length + 1).split('?')[0]);
    if (!file) throw new Error('chemin local invalide');
    return readFile(file);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  if (isProd && !isR2Configured()) throw new Error('--prod : variables R2_* absentes du .env racine — arrêt');
  const rows: Row[] = await prisma.itemContent.findMany({
    where: { kind: 'FILE', previewUrl: null, excerpt: null, url: { not: null } },
    select: { id: true, itemId: true, url: true, name: true, mimeType: true },
  });
  const candidates = rows.filter((r) => isR2Url(r.url) && (COVERED.test(r.name ?? '') || COVERED.test(r.url ?? '')
    || r.mimeType === 'application/pdf'));
  console.log(`[${isProd ? 'PROD' : 'local'}] ${apply ? 'RATTRAPAGE' : 'BILAN (sans --apply, rien n\'est écrit)'}`);
  console.log(`  Fichiers sans aperçu : ${rows.length} — au format couvert et dans le stockage : ${candidates.length}`);
  if (!apply) return;

  let images = 0; let excerpts = 0; let failed = 0;
  for (const [i, r] of candidates.entries()) {
    try {
      const buffer = await readStored(r.url!);
      const { previewUrl, excerpt } = await storeFilePreview(buffer, r.mimeType, r.name ?? r.url, r.itemId);
      if (previewUrl || excerpt) await prisma.itemContent.update({ where: { id: r.id }, data: { previewUrl, excerpt } });
      if (previewUrl) images += 1;
      if (excerpt) excerpts += 1;
    } catch (e) {
      failed += 1;
      console.warn(`  ${r.id} (${r.name ?? r.url}) : ${(e as Error).message}`);
    }
    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${candidates.length}`);
  }
  console.log(`Aperçus : ${images} image(s), ${excerpts} extrait(s), ${failed} lecture(s) en échec`);
}

main().finally(() => prisma.$disconnect());
