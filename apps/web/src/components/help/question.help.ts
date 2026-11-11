/* Aide utilisateur du bloc « Question » (QuestionPanel : fiche d'un élément Question et fenêtre en direct d'une séance),
   écrite en éléments d'aide (help/elements.ts) — registre help/pageHelp.ts, clé 'question'.
   Étapes numérotées (2026-11-11) : éléments « 1. Réponses possibles », « 2. Votes », « 3. Issue », comme le bloc.
   hints : rappels fonctionnels de chaque action à effet (voter, retenir, noter une issue, rouvrir, enregistrer les
   réponses ; statusDecided = bouton « Tranchée » du champ Statut, QuestionStatusField),
   vérifiés dans apps/api/src/routes/item-question.ts ; fields : phrases à lire avant d'agir (en ligne visible). */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  options: {
    title: '1. Réponses possibles',
    short: 'Les réponses proposées, préparées à l\'avance.',
    text: 'Le titre de l\'élément est la question ; ses réponses possibles se préparent en premier, dès que le type Question est choisi (la fiche s\'enregistre d\'elle-même). Qui peut modifier la question les ajoute, les corrige ou les réordonne, puis clique « Enregistrer les réponses » : une réponse corrigée garde ses votes. « Choix multiple » permet à chacun de cocher plusieurs réponses.',
    side: 'top',
    changes: [
      { id: 'question-type', kind: 'new', text: 'Nouveau type Question : options préparées, votes des membres et issue notée en un clic, y compris en séance.', date: '2026-11-08' },
      { id: 'question-steps', kind: 'evolution', text: 'Question plus simple : la fiche s\'enregistre dès le choix du type, le bloc suit trois étapes (réponses possibles, votes, issue), « Retenir » sur chaque réponse, et le statut se choisit aussi dans la fiche. La Question rejoint l\'Article dans le groupe « Compositions ».', date: '2026-11-11' },
    ],
  },
  vote: {
    title: '2. Votes',
    short: 'Chaque membre choisit sa réponse ; le responsable en retient une.',
    text: 'Chaque membre qui peut contribuer choisit une réponse (ou plusieurs en choix multiple) et la change tant que la question est ouverte. Le décompte est nominatif ; la réponse en tête est mise en avant, avec un badge « Unanimité » si tous les votants (au moins deux) l\'ont choisie. Chacun peut revoir son vote pour converger. Une autre réponse s\'écrit en commentaire. Un visiteur voit le décompte sans voter. Le responsable de la question tranche avec « Retenir » sur la ligne de la réponse choisie.',
    side: 'top',
  },
  issue: {
    title: '3. Issue',
    short: 'Ce qui a été conclu.',
    text: 'L\'issue est le statut de la question : Ouverte, Tranchée (réponse retenue ou autre réponse écrite), Reportée ou Sans conclusion, avec une ligne de précision possible. Le même statut se choisit dans le champ Statut de la fiche complète. Les votes ne tranchent jamais : l\'issue est notée par le responsable de la question, ou en séance par l\'animateur.',
    side: 'top',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Question',
  summary: 'Une question préparée à l\'avance avec ses options de réponse : les membres votent, puis son responsable (en séance, l\'animateur) note l\'issue.',
  ...derived,
  hints: {
    ...derived.hints,
    vote: 'Enregistre votre choix, visible par tous avec votre nom. Vous pouvez le changer tant que la question est ouverte ; il est figé dès qu\'une issue est notée. Il ne tranche pas la question.',
    voteClear: 'Retire votre vote.',
    unanimous: 'Tous les votants (au moins deux) ont choisi cette option. C’est une indication : la question n’est pas tranchée pour autant, l’issue reste à noter.',
    decide: 'Note la question « Tranchée » avec cette réponse comme réponse retenue. Les votes sont figés. Réversible : « Ouverte » efface l\'issue.',
    statusDecided: 'Une question se tranche en retenant une réponse : ce bouton amène aux votes, où « Retenir » note la réponse choisie (ou écrivez une autre réponse dans l\'issue).',
    decideOther: 'Note la question « Tranchée » avec la réponse écrite ici, hors des options. Les votes sont figés.',
    postpone: 'Note la question « Reportée » : les votes sont figés. En séance, elle sera reprise dans la préparation de la suite, et rouverte quand on la présentera de nouveau.',
    noConclusion: 'Note la question « Sans conclusion » : une issue normale quand l\'échange n\'aboutit pas. Les votes sont figés.',
    reopen: 'Remet la question « Ouverte » : l\'issue et sa précision sont effacées, les votes redeviennent modifiables.',
    note: 'Enregistre la ligne de précision avec l\'issue actuelle.',
    saveOptions: 'Enregistre la liste des réponses possibles. Une réponse retirée perd ses votes ; passer en choix unique ne garde que le dernier vote de chacun.',
    liveCopy: 'En séance, l\'issue notée par l\'animateur est aussi reportée sur la question d\'origine s\'il peut la modifier.',
  },
  fields: {
    otherAnswer: 'Autre réponse : une réponse qui n\'est pas parmi les options.',
    comment: 'Une réponse qui n\'est pas dans la liste ? Écrivez-la en commentaire de la question.',
    frozen: 'Question close : les votes sont figés.',
    unsaved: 'Enregistrement de la question…',
    noOptions: 'Aucune réponse possible pour le moment.',
  },
  tour: [
    {
      popover: {
        title: 'Question',
        description: 'Une question préparée à l\'avance : on y répond en votant, puis on note ce qui a été conclu.',
      },
    },
    ...elementTourSteps('question', elements),
  ],
};
