/* Registre des sortes de contenus d'un élément (référentiel unique, 2026-11-25) : ordre d'affichage, libellés et règle
 * de valeur de chaque sorte. Tout le reste en dérive (types/itemContent.ts : ItemContentKind, ITEM_CONTENT_KINDS ;
 * libellés de l'export, du MCP, de l'historique, de la zone Contenus, des pastilles et des vignettes). L'enum Prisma
 * ItemContentKind reste la source des valeurs stockées : un test API vérifie qu'ils correspondent.
 * Coordonnées (PHONE, EMAIL, ADDRESS — décision Thomas 2026-11-25) : valeur en clair dans la colonne `value`, affichées
 * en ligne compacte (compact), jamais en couverture ni en aperçu. Ne jamais recopier ces libellés ailleurs. */

export const ITEM_CONTENT_KIND_DEFS = [
  { id: 'IMAGE', label: 'Images', singular: 'Image', lower: 'image', lowerPlural: 'images', compact: false },
  { id: 'FILE', label: 'Fichiers', singular: 'Fichier', lower: 'fichier', lowerPlural: 'fichiers', compact: false },
  { id: 'LINK', label: 'Liens', singular: 'Lien', lower: 'lien', lowerPlural: 'liens', compact: false },
  { id: 'PHONE', label: 'Téléphones', singular: 'Téléphone', lower: 'téléphone', lowerPlural: 'téléphones', compact: true },
  { id: 'EMAIL', label: 'E-mails', singular: 'E-mail', lower: 'e-mail', lowerPlural: 'e-mails', compact: true },
  { id: 'ADDRESS', label: 'Adresses', singular: 'Adresse', lower: 'adresse', lowerPlural: 'adresses', compact: true },
  { id: 'DIAGRAM', label: 'Schémas', singular: 'Schéma', lower: 'schéma', lowerPlural: 'schémas', compact: false },
] as const;

export type ItemContentKindDef = (typeof ITEM_CONTENT_KIND_DEFS)[number];

/** Sortes dont la valeur est une coordonnée en clair (colonne `value`) */
export const CONTACT_CONTENT_KINDS = ['PHONE', 'EMAIL', 'ADDRESS'] as const;
export type ContactContentKind = (typeof CONTACT_CONTENT_KINDS)[number];

/** Règles de valeur des coordonnées (API et formulaire) */
export const CONTACT_VALUE_MAX: Record<ContactContentKind, number> = { PHONE: 40, EMAIL: 254, ADDRESS: 500 };
export const PHONE_PATTERN = /^[+0-9 ().-]{3,40}$/;

/** Définition d'une sorte (libellés) — undefined pour une valeur inconnue */
export function itemContentKindDef(kind: string): ItemContentKindDef | undefined {
  return ITEM_CONTENT_KIND_DEFS.find((d) => d.id === kind);
}

/** Lien cliquable d'une coordonnée : tel: (sans espaces), mailto:, carte OpenStreetMap ; null si vide */
export function contactHref(kind: string, value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  if (kind === 'PHONE') return `tel:${v.replace(/[\s().-]/g, '')}`;
  if (kind === 'EMAIL') return `mailto:${v}`;
  if (kind === 'ADDRESS') return `https://www.openstreetmap.org/search?query=${encodeURIComponent(v.replace(/\s*\n\s*/g, ', '))}`;
  return null;
}
