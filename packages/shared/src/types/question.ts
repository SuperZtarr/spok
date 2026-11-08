/*
 * Question (type d'item QUESTION, 2026-11-08) : vue renvoyée par GET /spaces/:spaceId/items/:id/question.
 * L'issue est le statut de l'item (statuts réservés QUESTION_STATUS) ; le détail d'une question tranchée (option
 * retenue OU réponse écrite, précision, qui, quand) vient de la table questions. Les votes sont nominatifs ;
 * ils ne tranchent jamais : leadingOptionIds sert seulement à mettre l'option majoritaire en avant.
 * Droits calculés par l'API pour le lecteur : canVote (membre pouvant contribuer, question ouverte),
 * canDecide (responsable de l'élément ; sur une copie de séance, l'animateur seul), canEditOptions.
 */

export interface QuestionVoter {
  id: string;
  name: string;
}

export interface QuestionOptionView {
  id: string;
  label: string;
  position: number;
  voters: QuestionVoter[];
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
  options: Array<{ id?: string; label: string }>;
}
