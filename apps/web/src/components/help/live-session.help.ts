/* Aide utilisateur d'une séance de présentation : bandeau de l'espace de séance (LiveSessionBar), ses panneaux
   (Préparation, Fil, Présenter, Présentateurs, Invités) et la fenêtre « Préparer la séance » (NewSessionDialog).
   Lue par le « ? » du bandeau (PageHelpButton pageKey="live-session") et son tour — registre help/pageHelp.ts.
   hints : rappels fonctionnels lus par pageHint('live-session', …) — affichés en tête des panneaux, dans la
   confirmation de « Terminer », en infobulle pour « Démarrer » seulement — vérifiés contre apps/api/src/routes/live-sessions.ts.
   « Créer la suite » s'explique dans sa fenêtre (live-window.help.ts, hints.suiteIntro).
   zones : mode Aide (data-help-zone="live-session:…"). La fenêtre en direct a sa propre fiche (live-window.help.ts). */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Séance',
  summary: 'Une séance présente en direct, à un groupe, des éléments venant de plusieurs espaces, et garde la trace de ce qui a été montré. Elle vit dans son propre espace, sous l\'espace qui l\'a lancée.',
  tips: [
    'Rôles : l\'animateur (qui a créé la séance) dirige tout ; les présentateurs préparent et présentent ; les participants regardent, commentent et réorganisent ce qui a été présenté',
    'Cycle : préparée → en direct (« Démarrer la séance ») → terminée (« Terminer »)',
    'Préparation : la liste des éléments à présenter, dans l\'ordre ; les participants n\'en voient que ce qui a déjà été présenté',
    'Présenter un élément le copie, verrouillé, dans l\'espace de séance : les participants voient la copie, jamais l\'espace d\'origine',
    'Invités : des membres de la communauté sans accès à l\'espace parent, qui voient la séance et rien d\'autre',
  ],
  tour: [
    {
      popover: {
        title: 'Séance',
        description: 'Ce bandeau pilote la séance : son état, la préparation, le fil, les présentateurs et les invités.',
      },
    },
    {
      element: '[data-tour="live-status"]',
      popover: { title: 'État', description: 'Préparée, en direct ou terminée ; en direct, le nombre de personnes connectées.', side: 'bottom' },
    },
    {
      element: '[data-tour="live-agenda"]',
      popover: { title: 'Préparation', description: 'La liste ordonnée des éléments à présenter, à compléter et réordonner.', side: 'bottom' },
    },
    {
      element: '[data-tour="live-timeline"]',
      popover: { title: 'Fil', description: 'Le journal de la séance : ce qui a été présenté, quand, et qui a rejoint.', side: 'bottom' },
    },
    {
      element: '[data-tour="live-presenters"]',
      popover: { title: 'Présentateurs', description: 'L\'animateur choisit, parmi les membres de l\'espace parent, qui peut préparer et présenter.', side: 'bottom' },
    },
    {
      element: '[data-tour="live-invitees"]',
      popover: { title: 'Invités', description: 'Ouvrir la séance à des membres de la communauté qui n\'ont pas accès à l\'espace parent.', side: 'bottom' },
    },
    {
      element: '[data-tour="live-start"]',
      popover: { title: 'Démarrer', description: 'Passe la séance en direct : les présentations deviennent possibles.', side: 'bottom' },
    },
  ],
  // Décision Thomas 2026-10-28 : l'explication d'un bouton du bandeau est affichée DANS ce qu'il ouvre (panneau,
  // confirmation, fenêtre), pas en infobulle au survol. Seul « Démarrer la séance », qui n'ouvre rien, a une infobulle.
  hints: {
    // En tête des panneaux du bandeau
    agenda: 'Les éléments à présenter, dans l\'ordre. Chaque ligne est un lien vers l\'élément d\'origine : rien n\'est copié avant « Afficher ». L\'animateur réordonne et retire toutes les lignes, un présentateur seulement les siennes ; les participants ne voient que les éléments déjà présentés.',
    timeline: 'Le journal de la séance, dans l\'ordre : éléments présentés et arrivées. Cliquez sur un élément pour ouvrir sa fiche.',
    present: 'Cherchez un élément de n\'importe quel espace auquel vous avez accès et affichez-le à tous. Il est copié, verrouillé, dans l\'espace de séance ; le dernier affiché remplace le précédent.',
    presenters: 'Membres de l\'espace parent, y compris ceux qui n\'ont pas encore rejoint. Cochés : ils peuvent ajouter des éléments à la préparation et les présenter ; décochés, ils perdent ce rôle (leurs lignes restent). Démarrer, terminer et inviter restent réservés à l\'animateur.',
    invitees: 'Des membres de la communauté sans accès à l\'espace parent. Invités, ils sont notifiés et voient la séance (éléments présentés, fil, commentaires), jamais l\'espace parent. Les retirer leur enlève l\'accès.',
    // Infobulle (le bouton n'ouvre rien)
    start: 'Démarrer la séance : elle passe en direct pour tous. La fenêtre en direct s\'ouvre, la séance apparaît dans le bouton « en direct » de l\'en-tête des personnes conviées, et les présentations deviennent possibles. Pas de retour à « préparée ».',
    // Confirmation de « Terminer »
    end: 'Plus aucun élément ne pourra être présenté et la fenêtre en direct se fermera chez tous. L\'espace de séance, le fil et la préparation restent consultables. C\'est irréversible.',
    // Phrase d'explication de la création
    newSessionIntro: 'Éléments de premier niveau de l\'espace, dans leur ordre, à ajouter à la préparation. Décochez ce que vous ne voulez pas présenter ; « avec ses sous-éléments » les ajoute juste après leur parent (sinon ils restent à révéler en séance). Vous pourrez compléter la préparation ensuite.',
  },
  zones: {
    bar: { title: 'Bandeau de séance', text: 'Pilote la séance de cet espace : son état, la préparation, le fil, les rôles et les invités. Les boutons dépendent de votre rôle et de l\'état de la séance.' },
    panel: { title: 'Panneau de séance', text: 'Le contenu du bouton choisi dans le bandeau. Il se referme en recliquant sur ce bouton.' },
  },
};
