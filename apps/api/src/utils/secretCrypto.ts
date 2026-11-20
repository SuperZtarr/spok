/*
 * Chiffrement des données sécurisées d'un élément (2026-11-20) — AES-256-GCM, clé serveur.
 * - Clé : variable SECRETS_ENCRYPTION_KEY = 32 octets en base64 (posée par Thomas dans Railway, service API).
 *   Absente ou invalide → isSecretsConfigured() faux : les routes refusent d'écrire ou de révéler (503), rien n'est
 *   jamais enregistré en clair. Lue à chaque appel (pas de copie en mémoire du module).
 * - Format : "v1:<iv b64>:<tag b64>:<données b64>", iv aléatoire de 12 octets.
 * - aad = id de la donnée : un chiffré recopié sur une autre ligne ne se déchiffre pas.
 * - Les erreurs ne contiennent jamais la valeur ni la clé.
 * Usage réservé à routes/item-secrets.ts et utils/itemSecrets.ts.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const PREFIX = 'v1';

function key(): Buffer | null {
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw) return null;
  const buf = Buffer.from(raw.trim(), 'base64');
  return buf.length === 32 ? buf : null;
}

/** La clé de chiffrement est posée et valide */
export function isSecretsConfigured(): boolean {
  return key() !== null;
}

export function encryptSecret(plain: string, aad: string): string {
  const k = key();
  if (!k) throw new Error('Données sécurisées non configurées');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', k, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [PREFIX, iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

export function decryptSecret(blob: string, aad: string): string {
  const k = key();
  if (!k) throw new Error('Données sécurisées non configurées');
  const parts = blob.split(':');
  if (parts.length !== 4 || parts[0] !== PREFIX) throw new Error('Donnée sécurisée illisible');
  try {
    const decipher = createDecipheriv('aes-256-gcm', k, Buffer.from(parts[1], 'base64'));
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(Buffer.from(parts[2], 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64')), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Donnée sécurisée illisible');
  }
}
