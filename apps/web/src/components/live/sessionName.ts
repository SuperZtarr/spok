/*
 * Nom par défaut d'une séance (nouvelle séance et « Créer la suite ») : « Séance » + date locale du jour
 * (AAAA-MM-JJ) — demande Thomas 2026-10-15. Le serveur (UTC) ajoute « (n) » si déjà pris et utilise le même
 * format s'il ne reçoit aucun nom. Les séances antérieures gardent leur nom (date seule).
 */
export const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const defaultSessionName = () => `Séance ${todayLocal()}`;
