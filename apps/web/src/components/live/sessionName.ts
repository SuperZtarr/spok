/* Nom par défaut d'une séance : date locale du jour (AAAA-MM-JJ) — le serveur (UTC) ajoute « (n) » si déjà pris. */
export const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
