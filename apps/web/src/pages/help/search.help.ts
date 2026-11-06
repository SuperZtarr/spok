/* Aide utilisateur de la page « Recherche » (/search).
   Lue par le point d'interrogation de la page (PageHelpButton), son tour et la ligne d'aide sous le champ
   (FieldHelp, visible aussi sur téléphone, contrairement aux hints) — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Recherche',
  summary: 'Chercher dans tout ce que vous pouvez ouvrir : communautés, espaces, éléments, utilisateurs et contributions.',
  tips: [
    'Les résultats arrivent dès la première lettre',
    'Plusieurs mots : tous sont obligatoires, dans n\'importe quel ordre. Dès le deuxième mot, chaque mot a sa pastille : cliquez ou touchez-la pour le passer à « au moins un » ou « exclu »',
    'Entre guillemets, "plan projet" cherche l\'expression exacte',
    'Lancée depuis un espace, la recherche se limite à cet espace : « Toute la communauté » ou « Partout » pour élargir',
    'Les filtres d\'éléments (type, statut, tag) ne gardent que les éléments et les contributions',
    'Les éléments sont regroupés par communauté et par espace',
    'Sur téléphone, les filtres sont repliés derrière le bouton « Filtres » (le chiffre = filtres actifs) et les catégories défilent sur une ligne',
  ],
  tour: [
    {
      popover: {
        title: 'Recherche',
        description: 'Tout ce que vous pouvez ouvrir, en une seule recherche.',
      },
    },
    {
      element: '[data-tour="search-input"]',
      popover: {
        title: 'Le terme',
        description: 'Tapez : les résultats arrivent dès la première lettre.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="search-words"]',
      popover: {
        title: 'Présence des mots',
        description: 'Saisissez au moins deux mots : chacun reçoit sa pastille. Cliquez ou touchez-la pour choisir : obligatoire, au moins un ou exclu.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="search-scope"]',
      popover: {
        title: 'Portée',
        description: 'Lancée depuis un espace ou une communauté, la recherche s\'y limite. Élargissez avec « Toute la communauté » ou « Partout ».',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="search-types"]',
      popover: {
        title: 'Que chercher',
        description: 'Activez ou non chaque catégorie ; le nombre de résultats s\'affiche sur chacune.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="search-filters"]',
      popover: {
        title: 'Filtres',
        description: 'Communauté, espace, type, statut, tag (les tags d\'un espace choisi). Un filtre d\'élément ne garde que les éléments et les contributions. Sur téléphone, touchez « Filtres » pour les déplier.',
        side: 'bottom',
      },
    },
  ],
  hints: {
  fields: {
    words: 'Avec plusieurs mots, vous pourrez choisir pour chacun : obligatoire, au moins un ou exclu. Entre guillemets : expression exacte.',
    wordsChoice: 'Cliquez ou touchez un mot pour changer son état. Obligatoire : il doit être présent. Au moins un : un seul des mots dans cet état suffit. Exclu : il ne doit pas être présent.',
  },
    wordRequired: 'Obligatoire : seuls les résultats contenant ce mot sont gardés. Cliquez pour passer à « au moins un ».',
    wordAny: 'Au moins un : les résultats doivent contenir au moins un des mots dans cet état. Cliquez pour l\'exclure.',
    wordExcluded: 'Exclu : les résultats contenant ce mot sont écartés. Cliquez pour le rendre obligatoire.',
  },
};
