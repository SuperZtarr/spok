/*
 * Question (type d'item QUESTION, 2026-11-08) : vue renvoyée par GET /spaces/:spaceId/items/:id/question.
 * L'issue est le statut de l'item (statuts réservés QUESTION_STATUS) ; le détail d'une question tranchée (option
 * retenue OU réponse écrite, précision, qui, quand) vient de la table questions. Les votes sont nominatifs ;
 * ils ne tranchent jamais : leadingOptionIds sert seulement à mettre l'option majoritaire en avant, unanimousOptionIds
 * à afficher le badge « Unanimité » (au moins 2 votants, tous sur l'option) — indication, jamais une issue.
 * Droits calculés par l'API pour le lecteur : canVote (membre pouvant contribuer, question ouverte),
 * canDecide (responsable de l'élément ; sur une copie de séance, l'animateur seul), canEditOptions.
 * Réponse liée à un élément (2026-11-12) : refItemId + refItem (titre, type, espace) si le lecteur peut le lire.
 */

export interface QuestionVoter {
  id: string;
  name: string;
}

/** Élément existant auquel une réponse renvoie (2026-11-12) — renvoyé seulement si le lecteur a accès à son espace */
export interface QuestionOptionRef {
  id: string;
  title: string;
  type: string;
  spaceId: string;
}

export interface QuestionOptionView {
  id: string;
  label: string;
  position: number;
  voters: QuestionVoter[];
  /** Identifiant de l'élément lié (connu de qui peut modifier les réponses, même sans accès à l'élément) */
  refItemId: string | null;
  /** Élément lié lisible par le lecteur, sinon null (la réponse s'affiche alors par son seul libellé) */
  refItem: QuestionOptionRef | null;
}

export interface QuestionOutcome {
  /** Option retenue (question tranchée) — exclusif avec answerText */
  chosenOptionId: string | null;
  /** Autre réponse écrite (question tranchée hors options) */
  answerText: string | null;
  /** Une ligne de précision, quelle que soit l'issue */
  note: string | null;
  decidedBy: QuestionVoter | null;
  decidedAt: string | null;
}

export interface QuestionView {
  itemId: string;
  /** Statut de l'item (question_open / _decided / _postponed / _no_conclusion ; null = ouverte) */
  status: string | null;
  /** Ouverte : les votes sont modifiables */
  open: boolean;
  /** Choix multiple : chaque votant peut cocher plusieurs options */
  multiple: boolean;
  options: QuestionOptionView[];
  outcome: QuestionOutcome;
  /** Nombre de personnes ayant voté (au moins une option) */
  voterCount: number;
  /** Options ayant le plus de voix (vide s'il n'y a aucun vote) */
  leadingOptionIds: string[];
  /** Options cochées par TOUS les votants, à partir de 2 votants (badge « Unanimité », indication seulement) */
  unanimousOptionIds: string[];
  /** Options cochées par le lecteur */
  myOptionIds: string[];
  canVote: boolean;
  canDecide: boolean;
  canEditOptions: boolean;
  /** Copie verrouillée d'une séance */
  locked: boolean;
}

/** Corps de PUT …/question/outcome */
export interface QuestionOutcomeInput {
  status: string;
  chosenOptionId?: string | null;
  answerText?: string | null;
  note?: string | null;
}

/** Corps de PUT …/question/options : liste complète, dans l'ordre (id absent = nouvelle option) */
export interface QuestionOptionsInput {
  multiple?: boolean;
  /** refItemId : élément lié (null ou absent = aucun) */
  options: Array<{ id?: string; label: string; refItemId?: string | null }>;
}
