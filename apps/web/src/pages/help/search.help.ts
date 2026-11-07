/* Aide utilisateur de la page « Recherche » (/search), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le
   « ? » (PageHelpButton), le tour et le mode Aide. `fields` : ligne d'aide sous le champ (FieldHelp, visible aussi sur téléphone,
   contrairement aux hints). Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  terme: {
    title: 'Le terme',
    short: 'Les résultats arrivent dès la première lettre.',
    text: 'Tapez : les résultats arrivent dès la première lettre. Entre guillemets, "plan projet" cherche l\'expression exacte.',
    target: '[data-tour="search-input"]',
    side: 'bottom',
  },
  mots: {
    title: 'Présence des mots',
    short: 'Choisissez l\'état de chaque mot.',
    text: 'Plusieurs mots : tous sont obligatoires, dans n\'importe quel ordre. Dès le deuxième mot, chacun reçoit sa pastille : cliquez ou touchez-la pour choisir obligatoire, au moins un ou exclu.',
    target: '[data-tour="search-words"]',
    side: 'bottom',
    changes: [{
      id: 'search-mots-presence',
      kind: 'evolution',
      text: 'Tous les mots saisis doivent être présents. Chaque mot peut passer à « au moins un » ou « exclu », et les guillemets cherchent une expression exacte.',
      date: '2026-11-07',
    }],
  },
  portee: {
    title: 'Portée',
    short: 'Où chercher.',
    text: 'Lancée depuis un espace ou une communauté, la recherche s\'y limite. Élargissez avec « Toute la communauté » ou « Partout ».',
    target: '[data-tour="search-scope"]',
    side: 'bottom',
  },
  categories: {
    title: 'Que chercher',
    short: 'Activez ou non chaque catégorie.',
    text: 'Activez ou non chaque catégorie ; le nombre de résultats s\'affiche sur chacune. Les éléments sont regroupés par communauté et par espace. Utilisateurs : connectez-vous pour en chercher. Vous trouvez par leur nom les personnes avec qui vous partagez un espace ou une communauté, ou les membres de la portée choisie ; les adresses e-mail n\'apparaissent pas. Sur téléphone, les catégories défilent sur une ligne.',
    target: '[data-tour="search-types"]',
    side: 'bottom',
  },
  filtres: {
    title: 'Filtres',
    short: 'Communauté, espace, type, statut, tag.',
    text: 'Communauté, espace, type, statut, tag (les tags d\'un espace choisi). Un filtre d\'élément ne garde que les éléments et les contributions. Sur téléphone, touchez « Filtres » pour les déplier ; le chiffre indique les filtres actifs.',
    target: '[data-tour="search-filters"]',
    side: 'bottom',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Recherche',
  route: '/search',
  summary: 'Chercher dans tout ce que vous pouvez ouvrir : communautés, espaces, éléments, utilisateurs et contributions.',
  ...derived,
  hints: {
    ...derived.hints,
    wordRequired: 'Obligatoire : seuls les résultats contenant ce mot sont gardés. Cliquez pour passer à « au moins un ».',
    wordAny: 'Au moins un : les résultats doivent contenir au moins un des mots dans cet état. Cliquez pour l\'exclure.',
    wordExcluded: 'Exclu : les résultats contenant ce mot sont écartés. Cliquez pour le rendre obligatoire.',
  },
  fields: {
    words: 'Avec plusieurs mots, vous pourrez choisir pour chacun : obligatoire, au moins un ou exclu. Entre guillemets : expression exacte.',
    wordsChoice: 'Cliquez ou touchez un mot pour changer son état. Obligatoire : il doit être présent. Au moins un : un seul des mots dans cet état suffit. Exclu : il ne doit pas être présent.',
  },
  tour: [
    {
      popover: {
        title: 'Recherche',
        description: 'Tout ce que vous pouvez ouvrir, en une seule recherche.',
      },
    },
    ...elementTourSteps('search', elements),
  ],
};
