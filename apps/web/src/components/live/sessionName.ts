/*
 * Nom d'une séance : « Séance » + date AAAA-MM-JJ — demande Thomas 2026-10-15. Depuis 2026-10-28 la date est
 * celle PRÉVUE pour la séance, choisie dans « Préparer la séance » / « Créer la suite » (aujourd'hui par défaut,
 * todayLocal) : sessionNameFor(date). La date ne sert qu'au nom (pas de champ en base). Le serveur (UTC) ajoute
 * « (n) » si déjà pris et utilise defaultSessionName s'il ne reçoit aucun nom. Les séances antérieures gardent leur nom.
 */
export const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const sessionNameFor = (date: string) => `Séance ${date}`;

export const defaultSessionName = () => sessionNameFor(todayLocal());
