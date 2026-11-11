/* Aide utilisateur de la vue « Bugs » (bugs), écrite en éléments d'aide (help/elements.ts). Cette vue affiche ListView :
   ses en-têtes reprennent l'élément de la Liste, sa ligne garde son propre texte. En mode Aide, les zones list:* s'appliquent
   à l'intérieur de la vue. Lue par le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide.
   Depuis le lot 4 « contenus multiples », la vue suit un tag (« bug » par défaut, réglable : élément `tag`) ;
   annonce `bugs-view-tag` sans date, datée par la session MEP. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';
import { elements as listElements } from './list.help';

const elements: HelpElements = {
  contenu: {
    title: 'Bugs',
    short: 'Les éléments tagués « bug » (ou le tag suivi).',
    text: 'La liste des anomalies à corriger dans cet espace : les éléments qui portent le tag suivi (« bug » par défaut), quel que soit leur type — d\'habitude des tâches. Mêmes gestes que la vue Liste.',
    side: 'top',
    changes: [{ id: 'bugs-view-tag', kind: 'evolution', text: 'La vue Bugs suit un tag (« bug » par défaut) au lieu du type Anomalie, qui n\'existe plus : vos anomalies sont devenues des tâches taguées « bug ».', date: '2026-11-11' }],
  },
  tag: {
    title: 'Tag suivi',
    short: 'Le tag des éléments affichés ici.',
    text: 'Le tag que la vue affiche, le même pour tous les espaces de la communauté. Seul le propriétaire de la communauté le change (choix parmi les tags présents dans l\'espace) ; les autres le voient. Rien n\'est modifié sur les éléments : changer de tag change seulement ce que la vue montre.',
    target: '[data-tour="bugs-tag"]',
    side: 'bottom',
  },
  entetes: { ...listElements.entetes, noZone: true },
  ligne: {
    title: 'Un bug',
    short: 'Cliquez pour ouvrir sa fiche.',
    text: 'Cliquez pour ouvrir sa fiche et décrire l\'anomalie ; changez son statut au fil de la correction.',
    target: '[data-tour="list-row"]',
    noZone: true,
    side: 'bottom',
  },
};

export const help: HelpEntry = {
  title: 'Bugs',
  summary: 'Les anomalies de l\'espace (éléments tagués « bug », ou le tag suivi), en liste.',
  short: 'Liste des bugs',
  empty: 'Aucun élément ne porte le tag suivi. Posez le tag « bug » (ou le tag choisi) sur une tâche pour la suivre ici.',
  ...helpFromElements(elements),
  tour: [
    ...elementTourSteps('bugs', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};
