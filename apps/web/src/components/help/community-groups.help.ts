/* Aide utilisateur des groupes personnels de communautés (2026-11-27) : sélecteur de groupe (CommunityGroupSelector,
   sidebar et page /communities) et modale de gestion (CommunityGroupsModal), écrite en éléments d'aide (help/elements.ts).
   Rappels (pageHint) : clés supprimer et ranger, à ne pas renommer. Écrits d'après apps/api/src/routes/community-groups.ts :
   à revoir si la route change. Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  selecteur: {
    title: 'Groupe affiché',
    short: 'Choisissez le groupe de communautés à afficher.',
    text: 'N\'affiche que les communautés du groupe choisi, dans la barre latérale et sur la page Communautés (le choix est le même aux deux endroits et reste mémorisé sur cet appareil). « Toutes » montre tout, « Non classées » les communautés rangées dans aucun groupe. Le bouton à côté ouvre la gestion des groupes.',
    side: 'right',
    changes: [{ id: 'community-groups-new', kind: 'new', text: 'Rangez vos communautés dans vos propres groupes et n\'affichez que celui dont vous avez besoin.', date: '2026-11-27' }],
  },
  groupes: {
    title: 'Vos groupes',
    short: 'Créez, renommez, réordonnez vos groupes.',
    text: 'Vos groupes sont personnels : personne d\'autre ne les voit et ils ne changent aucun droit. Ajoutez un groupe par son nom, renommez-le en modifiant son nom, changez son ordre avec les flèches : c\'est l\'ordre du sélecteur.',
    side: 'bottom',
  },
  ranger: {
    title: 'Ranger les communautés',
    short: 'Choisissez le groupe de chaque communauté : une communauté est dans un seul de vos groupes. « Aucun groupe » la remet dans les non classées. Rien ne change pour les autres membres.',
    text: 'Chaque communauté que vous voyez a une liste : choisissez son groupe. Une communauté est dans un seul de vos groupes à la fois ; « Aucun groupe » la remet dans les non classées. La recherche filtre par nom.',
    side: 'top',
  },
  supprimer: {
    title: 'Supprimer un groupe',
    short: 'Supprime le groupe. Ses communautés ne sont pas supprimées : elles redeviennent non classées. Pas d\'annulation : recréez le groupe et rangez-les de nouveau.',
    text: 'Supprime le groupe seulement : ses communautés restent intactes et redeviennent non classées.',
    target: '[data-tour="community-group-delete"]',
    noZone: true,
    side: 'left',
  },
};

export const help: HelpEntry = {
  title: 'Groupes de communautés',
  summary: 'Rangez les communautés dans vos propres groupes pour n\'afficher que celles dont vous avez besoin.',
  short: 'Allégez la liste des communautés en les rangeant par groupes.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Groupes de communautés',
        description: 'Quand vous avez beaucoup de communautés, rangez-les par groupes et n\'affichez que celui qui vous sert.',
      },
    },
    ...elementTourSteps('community-groups', elements),
  ],
};
