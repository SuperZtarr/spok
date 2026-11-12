/*
 * Modèles de réponse d'une Question (2026-11-12, demande Thomas) : jeux de réponses possibles courants, proposés à
 * l'étape « 1. Réponses possibles » (QuestionPanel → OptionsEditor) tant que la question est ouverte et sans aucun vote.
 * Un modèle REMPLACE toutes les réponses possibles (changer de modèle, corriger un mauvais clic), en choix unique, et
 * les enregistre ; elles restent modifiables ensuite. Règle de gestion : 'question-templates' (lib/businessRules.ts).
 * Ne jamais proposer un modèle dès qu'un vote existe : remplacer les réponses ferait perdre ces votes.
 * Pour ajouter un modèle : une entrée ici (id stable, libellé du bouton, réponses dans l'ordre d'affichage).
 */

export interface QuestionTemplate {
  id: string;
  /** Libellé du bouton */
  label: string;
  /** Réponses possibles créées, dans l'ordre */
  options: string[];
}

export const QUESTION_TEMPLATES: QuestionTemplate[] = [
  { id: 'yes-no', label: 'Oui / Non / NSP', options: ['Oui', 'Non', 'Ne sait pas'] },
  {
    id: 'agreement',
    label: 'Échelle d\'accord',
    options: ['Complètement d\'accord', 'Plutôt d\'accord', 'Plutôt pas d\'accord', 'Pas du tout d\'accord', 'Ne sait pas'],
  },
  { id: 'go-nogo', label: 'Go / No-go', options: ['Go', 'No-go'] },
];
