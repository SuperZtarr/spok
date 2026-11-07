/* Aide utilisateur d'une séance de présentation : bandeau de l'espace de séance (LiveSessionBar), ses panneaux
   (Préparation, Fil, Présenter, Présentateurs, Invités) et la fenêtre « Préparer la séance » (NewSessionDialog).
   Écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? » du bandeau (PageHelpButton
   pageKey="live-session"), le tour et le mode Aide (data-help-zone="live-session:…") — registre help/pageHelp.ts.
   Texte court (`short`) des boutons : rappels lus par pageHint('live-session', …), affichés en tête des panneaux, dans la
   confirmation de « Terminer », en infobulle pour « Démarrer » seulement — vérifiés contre apps/api/src/routes/live-sessions.ts.
   Ces clés (agenda, timeline, present, presenters, invitees, start, end) ne doivent pas changer.
   « Créer la suite » s'explique dans sa fenêtre (live-window.help.ts, hints.suiteIntro).
   Décision Thomas 2026-10-28 : l'explication d'un bouton du bandeau est affichée DANS ce qu'il ouvre (panneau,
   confirmation, fenêtre), pas en infobulle au survol. Seul « Démarrer la séance », qui n'ouvre rien, a une infobulle. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  bar: {
    title: 'Bandeau de séance',
    short: 'Pilote la séance de cet espace.',
    text: 'Pilote la séance de cet espace : son état, la préparation, le fil, les rôles et les invités. Les boutons dépendent de votre rôle et de l\'état de la séance.',
    side: 'bottom',
  },
  panel: {
    title: 'Panneau de séance',
    short: 'Le contenu du bouton choisi.',
    text: 'Le contenu du bouton choisi dans le bandeau. Il se referme en recliquant sur ce bouton.',
    side: 'bottom',
  },
  status: {
    title: 'État',
    short: 'Préparée, en direct ou terminée.',
    text: 'Préparée, en direct ou terminée ; en direct, le nombre de personnes connectées.',
    target: '[data-tour="live-status"]',
    noZone: true,
    side: 'bottom',
  },
  agenda: {
    title: 'Préparation',
    short: 'Les éléments à présenter, dans l\'ordre. Chaque ligne est un lien vers l\'élément d\'origine : rien n\'est copié avant « Afficher ». L\'animateur réordonne et retire toutes les lignes, un présentateur seulement les siennes ; les participants ne voient que les éléments déjà présentés.',
    text: 'La liste ordonnée des éléments à présenter, à compléter et réordonner. Les participants n\'en voient que ce qui a déjà été présenté et ce qu\'ils ont ajouté ; l\'animateur peut afficher leurs lignes.',
    target: '[data-tour="live-agenda"]',
    noZone: true,
    side: 'bottom',
  },
  timeline: {
    title: 'Fil',
    short: 'Le journal de la séance, dans l\'ordre : éléments présentés et arrivées. Cliquez sur un élément pour ouvrir sa fiche.',
    text: 'Le journal de la séance : ce qui a été présenté, quand, et qui a rejoint.',
    target: '[data-tour="live-timeline"]',
    noZone: true,
    side: 'bottom',
  },
  present: {
    title: 'Présenter',
    short: 'Cherchez un élément de n\'importe quel espace auquel vous avez accès et affichez-le à tous. Il est copié, verrouillé, dans l\'espace de séance ; le dernier affiché remplace le précédent.',
    text: 'Présenter un élément le copie, verrouillé, dans l\'espace de séance : les participants voient la copie, jamais l\'espace d\'origine.',
    target: '[data-tour="live-present"]',
    noZone: true,
    side: 'bottom',
  },
  presenters: {
    title: 'Présentateurs',
    short: 'Membres de l\'espace parent, y compris ceux qui n\'ont pas encore rejoint. Cochés : ils peuvent ajouter des éléments à la préparation et les présenter ; décochés, ils perdent ce rôle (leurs lignes restent). Démarrer, terminer et inviter restent réservés à l\'animateur.',
    text: 'L\'animateur choisit, parmi les membres de l\'espace parent, qui peut préparer et présenter.',
    target: '[data-tour="live-presenters"]',
    noZone: true,
    side: 'bottom',
  },
  invitees: {
    title: 'Invités',
    short: 'Des membres de la communauté sans accès à l\'espace parent. Invités, ils sont notifiés et voient la séance (éléments présentés, fil, commentaires), jamais l\'espace parent. Les retirer leur enlève l\'accès.',
    text: 'Ouvrir la séance à des membres de la communauté qui n\'ont pas accès à l\'espace parent : ils voient la séance et rien d\'autre.',
    target: '[data-tour="live-invitees"]',
    noZone: true,
    side: 'bottom',
  },
  start: {
    title: 'Démarrer',
    short: 'Démarrer la séance : elle passe en direct pour tous. La fenêtre en direct s\'ouvre, la séance apparaît dans le bouton « en direct » de l\'en-tête des personnes conviées, et les présentations deviennent possibles. Pas de retour à « préparée ».',
    text: 'Passe la séance en direct : les présentations deviennent possibles.',
    target: '[data-tour="live-start"]',
    noZone: true,
    side: 'bottom',
  },
  end: {
    title: 'Terminer',
    short: 'Plus aucun élément ne pourra être présenté et la fenêtre en direct se fermera chez tous. L\'espace de séance, le fil et la préparation restent consultables. C\'est irréversible.',
    text: 'Termine la séance pour tous ; l\'espace de séance reste consultable. C\'est irréversible.',
    target: '[data-tour="live-end"]',
    noZone: true,
    side: 'bottom',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Séance',
  summary: 'Une séance présente en direct, à un groupe, des éléments venant de plusieurs espaces, et garde la trace de ce qui a été montré. Elle vit dans son propre espace, sous l\'espace qui l\'a lancée. Rôles : l\'animateur (qui a créé la séance) dirige tout ; les présentateurs préparent et présentent ; les participants regardent, commentent, réorganisent ce qui a été présenté et ajoutent des éléments à la préparation.',
  ...derived,
  hints: {
    ...derived.hints,
    // Phrase d'explication de la création
    newSessionIntro: 'Éléments de premier niveau de l\'espace, dans leur ordre, à ajouter à la préparation. Décochez ce que vous ne voulez pas présenter ; « avec ses sous-éléments » les ajoute juste après leur parent (sinon ils restent à révéler en séance). Vous pourrez compléter la préparation ensuite.',
  },
  tour: elementTourSteps('live-session', elements),
};
