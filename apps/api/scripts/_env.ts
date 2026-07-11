/**
 * Helper centralisé pour les scripts SPOK.
 * Usage: import { ENV, prodPrisma, localPrisma } from './_env';
 * Les secrets (URLs DB, credentials) viennent du .env racine (gitignoré) — AUCUN secret en dur ici :
 * ce fichier est tracké sur un repo public (fuite corrigée le 2026-07-11, credentials rotés).
 * Clés .env requises : PROD_DATABASE_URL, SPOK_EMAIL, SPOK_PASSWORD (+ DATABASE_URL pour le local).
 */
import { PrismaClient } from '@spok/database';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Charge le .env racine (parse manuel, pas de dépendance dotenv)
const rootEnvPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env');
if (fs.existsSync(rootEnvPath)) {
  for (const line of fs.readFileSync(rootEnvPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=["']?([^"'\r\n]*)["']?/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Variable ${key} absente — la définir dans le .env racine`);
  return v;
}

export const ENV = {
  // Local
  LOCAL_DB_URL: process.env.DATABASE_URL || 'postgresql://spok:spok@localhost:5433/spok?schema=public',
  LOCAL_ADMIN_ID: 'cmlup9ug40000n86xjf96ej3f',
  LOCAL_API: 'http://localhost:3001',
  LOCAL_ADMIN_EMAIL: 'admin@spok.app',
  LOCAL_ADMIN_PASSWORD: 'admin1234',

  // Production — secrets lus depuis .env
  get PROD_DB_URL() { return required('PROD_DATABASE_URL'); },
  PROD_ADMIN_ID: 'cml3q8k60000012gz2ev4dz7r',
  PROD_API: 'https://api.spok.space',
  get PROD_ADMIN_EMAIL() { return required('SPOK_EMAIL'); },
  get PROD_ADMIN_PASSWORD() { return required('SPOK_PASSWORD'); },

  // R2 — secrets lus depuis .env
  get R2_ACCOUNT_ID() { return required('R2_ACCOUNT_ID'); },
  get R2_ACCESS_KEY_ID() { return required('R2_ACCESS_KEY_ID'); },
  get R2_SECRET_ACCESS_KEY() { return required('R2_SECRET_ACCESS_KEY'); },
  R2_BUCKET: 'spok-images',
  get R2_PUBLIC_URL() { return required('R2_PUBLIC_URL'); },

  // Communautés connues
  COMMUNITY_DOCUMENTATIONS: 'cmmtheuzn0005f03nqjf8p238',
  SPACE_DOC_INTERFACE: 'cmmthmtjw000if03nkcpdb7mh',
  SPACE_DOC_ARCHI: 'cmmthmtr7000mf03nkqrv7a3z',
  SPACE_DOC_MODALES: 'cmmts8ab200ajwbfkewwrj2b6',
  SPACE_DOC_PROJET: 'cmluq9mwu0003s9m9jv90v0lg',
};

/** Detect si on tourne en prod (via DATABASE_URL ou --prod flag) */
export const isProd = process.env.DATABASE_URL?.includes('railway') || process.argv.includes('--prod');

/** Admin ID selon l'environnement */
export const ADMIN_ID = isProd ? ENV.PROD_ADMIN_ID : ENV.LOCAL_ADMIN_ID;

/** Crée un PrismaClient pointant vers la prod */
export function prodPrisma() {
  return new PrismaClient({ datasources: { db: { url: ENV.PROD_DB_URL } } });
}

/** Crée un PrismaClient pointant vers le local */
export function localPrisma() {
  return new PrismaClient({ datasources: { db: { url: ENV.LOCAL_DB_URL } } });
}
