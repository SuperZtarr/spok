/**
 * Rattrapage de l'aperçu des fichiers (2026-11-11) : calcule previewUrl (page 1) et excerpt (début du texte) des
 * contenus FILE envoyés avant l'aperçu, comme le fait l'envoi (utils/filePreview.ts → storeFilePreview).
 * Candidats : contenus FILE sans previewUrl ni excerpt, au format couvert (PDF, docx/xlsx/pptx, texte brut) et dont
 * le fichier est dans le stockage actif (R2, ou dossier local en dev). Lecture du fichier par son adresse publique
 * (R2) ou sur disque (mode local). Un fichier sans aperçu possible reste tel quel — rejouable, il sera retenté.
 * Sans --apply : bilan seulement. --prod : base de prod (via _env.ts) ET R2 configuré dans le .env racine (sinon
 * arrêt), à lancer APRÈS le déploiement du schéma, sur demande explicite de Thomas.
 * --check (prioritaire sur --apply) : diagnostic — calcule l'aperçu de chaque candidat sans rien envoyer ni écrire et
 * affiche par fichier : format, taille, durée, image obtenue, longueur de l'extrait, erreur. Lecture seule, même en prod.
 * Avec --apply, la cause d'un aperçu manqué (calcul, délai, envoi de l'image) est affichée (2026-11-11).
 * Exécuter : npx tsx apps/api/scripts/backfill-file-previews.ts [--prod] [--check | --apply]
 */
import { readFile } from 'node:fs/promises';
import { prodPrisma, localPrisma, isProd } from './_env';
import { isR2Configured, isR2Url, isLocalStorageMode, localPathForKey, LOCAL_UPLOADS_URL } from '../src/utils/r2.js';
import { buildFilePreview, storeFilePreview } from '../src/utils/filePreview.js';

const prisma = isProd ? prodPrisma() : localPrisma();
const apply = process.argv.includes('--apply');
const checkOnly = process.argv.includes('--check');
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

/** --check : calcule l'aperçu de chaque candidat SANS rien envoyer ni écrire, une ligne par fichier (diagnostic) */
async function check(candidates: Row[]) {
  let ok = 0;
  for (const r of candidates) {
    const ext = ((r.name ?? r.url ?? '').split(/[?#]/)[0].split('.').pop() ?? '?').toLowerCase();
    const t0 = Date.now();
    try {
      const buffer = await readStored(r.url!);
      const p = await buildFilePreview(buffer, r.mimeType, r.name ?? r.url);
      if (p.image) ok += 1;
      console.log(`  ${r.id} ${ext} ${Math.round(buffer.length / 1024)} Ko ${Date.now() - t0} ms — image ${p.image ? `${Math.round(p.image.length / 1024)} Ko` : 'non'}, extrait ${p.excerpt ? `${p.excerpt.length} car.` : 'non'}${p.error ? ` — ERREUR ${p.error}` : ''}`);
    } catch (e) {
      console.log(`  ${r.id} ${ext} — LECTURE EN ÉCHEC ${(e as Error).message}`);
    }
  }
  console.log(`Images calculables : ${ok}/${candidates.length} (rien n'a été envoyé ni écrit)`);
}

async function main() {
  if (isProd && !checkOnly && !isR2Configured()) throw new Error('--prod : variables R2_* absentes du .env racine — arrêt');
  const rows: Row[] = await prisma.itemContent.findMany({
    where: { kind: 'FILE', previewUrl: null, excerpt: null, url: { not: null } },
    select: { id: true, itemId: true, url: true, name: true, mimeType: true },
  });
  const candidates = rows.filter((r) => isR2Url(r.url) && (COVERED.test(r.name ?? '') || COVERED.test(r.url ?? '')
    || r.mimeType === 'application/pdf'));
  const mode = checkOnly ? 'CONTRÔLE (--check : calcul seul, rien n\'est envoyé ni écrit)' : apply ? 'RATTRAPAGE' : 'BILAN (sans --apply, rien n\'est écrit)';
  console.log(`[${isProd ? 'PROD' : 'local'}] ${mode}`);
  console.log(`  Fichiers sans aperçu : ${rows.length} — au format couvert et dans le stockage : ${candidates.length}`);
  if (checkOnly) return check(candidates);
  if (!apply) return;

  let images = 0; let excerpts = 0; let failed = 0;
  for (const [i, r] of candidates.entries()) {
    try {
      const buffer = await readStored(r.url!);
      const { previewUrl, excerpt, error } = await storeFilePreview(buffer, r.mimeType, r.name ?? r.url, r.itemId);
      if (previewUrl || excerpt) await prisma.itemContent.update({ where: { id: r.id }, data: { previewUrl, excerpt } });
      if (previewUrl) images += 1;
      if (excerpt) excerpts += 1;
      if (error) console.warn(`  ${r.id} (${r.name ?? r.url}) : ${error}`);
    } catch (e) {
      failed += 1;
      console.warn(`  ${r.id} (${r.name ?? r.url}) : ${(e as Error).message}`);
    }
    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${candidates.length}`);
  }
  console.log(`Aperçus : ${images} image(s), ${excerpts} extrait(s), ${failed} lecture(s) en échec`);
}

main().finally(() => prisma.$disconnect());
