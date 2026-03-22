/**
 * Helper centralisé pour les scripts SPOK.
 * Usage: import { ENV, prodPrisma } from './_env';
 */
import { PrismaClient } from '@spok/database';

export const ENV = {
  // Local
  LOCAL_DB_URL: 'postgresql://postgres:postgres@localhost:25432/spok?schema=public',
  LOCAL_ADMIN_ID: 'cmlup9ug40000n86xjf96ej3f',
  LOCAL_API: 'http://localhost:3001',
  LOCAL_ADMIN_EMAIL: 'admin@spok.app',
  LOCAL_ADMIN_PASSWORD: 'admin1234',

  // Production
  PROD_DB_URL: 'postgresql://postgres:GSpgpyKTewWFHHkmYtgsxwCmdbBIYiZW@ballast.proxy.rlwy.net:31323/railway',
  PROD_ADMIN_ID: 'cml3q8k60000012gz2ev4dz7r',
  PROD_API: 'https://api.spok.space',
  PROD_ADMIN_EMAIL: 'superztarr@gmail.com',
  PROD_ADMIN_PASSWORD: '219W@Rlhor',

  // R2 (partagé local/prod)
  R2_ACCOUNT_ID: 'a1017ff43a1c768ad17e5868c71f29af',
  R2_ACCESS_KEY_ID: 'f2de34370a2adaa9534b0ed72c2a7523',
  R2_SECRET_ACCESS_KEY: 'eec8dab88ebafa2da455fa174377108a7146cea59919484baa74bf92765aee89',
  R2_BUCKET: 'spok-images',
  R2_PUBLIC_URL: 'https://pub-bace6d857e1249a1bd472b9a1924e91b.r2.dev',

  // Communautés connues
  COMMUNITY_DOCUMENTATIONS: 'cmmtheuzn0005f03nqjf8p238',
  SPACE_DOC_INTERFACE: 'cmmthmtjw000if03nkcpdb7mh',
  SPACE_DOC_ARCHI: 'cmmthmtr7000mf03nkqrv7a3z',
  SPACE_DOC_MODALES: 'cmmts8ab200ajwbfkewwrj2b6',
  SPACE_DOC_PROJET: 'cmluq9mwu0003s9m9jv90v0lg',
} as const;

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
