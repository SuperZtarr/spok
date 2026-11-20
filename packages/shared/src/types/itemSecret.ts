/* Données sécurisées d'un élément (décision Thomas 2026-11-20) : mots de passe, codes, clés rangés à côté de l'adresse
 * ou de l'élément qu'ils ouvrent. Table à part item_secrets, jamais lue hors de routes/item-secrets.ts et
 * utils/itemSecrets.ts (test de garde secrets-leak.test.ts) : aucune liste, recherche, export ni aperçu ne peut la voir.
 * - Libellé en clair (cherchable dans la fiche), identifiant et valeur chiffrés côté API (AES-256-GCM).
 * - Visibilité par donnée : PRIVATE (« moi seul », défaut) ou SPACE (« membres de l'espace »).
 * - ItemSecretSummary = ce que renvoie la liste (jamais de valeur) ; ItemSecretRevealed = seule réponse portant la
 *   valeur (POST …/reveal), à ne jamais mettre en cache ni journaliser.
 * Plafond propre (ITEM_SECRETS_MAX), distinct des ITEM_CONTENTS_MAX contenus. */

export type ItemSecretVisibility = 'PRIVATE' | 'SPACE';

/** Visibilités dans l'ordre du sélecteur, avec leur libellé (source unique) */
export const ITEM_SECRET_VISIBILITIES: readonly { id: ItemSecretVisibility; label: string }[] = [
  { id: 'PRIVATE', label: 'Moi seul' },
  { id: 'SPACE', label: "Membres de l'espace" },
];

/** Nombre maximal de données sécurisées par élément */
export const ITEM_SECRETS_MAX = 10;

/** Longueurs maximales des champs (caractères) */
export const ITEM_SECRET_LIMITS = { label: 120, login: 255, value: 4000 } as const;

export interface ItemSecretSummary {
  id: string;
  itemId: string;
  label: string;
  /** Un identifiant est enregistré (sa valeur n'est donnée qu'à la révélation) */
  hasLogin: boolean;
  visibility: ItemSecretVisibility;
  position: number;
  createdById: string;
  createdByName: string | null;
  /** Le lecteur peut afficher / copier la valeur */
  canReveal: boolean;
  /** Le lecteur peut modifier (auteur seul) */
  canEdit: boolean;
  /** Le lecteur peut supprimer (auteur ou mode admin) */
  canDelete: boolean;
  revealCount: number;
  lastRevealedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItemSecretRevealed {
  login: string | null;
  value: string;
}
