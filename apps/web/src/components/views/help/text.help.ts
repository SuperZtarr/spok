/* Aide utilisateur de la vue « Texte » (text) : à quoi elle sert, comment s'en servir, tour guidé.
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';

export const help: HelpEntry = {
  title: 'Texte',
  summary: 'Vue document affichant le contenu textuel des éléments de manière continue.',
  tips: [
    'Naviguez dans le contenu comme un document',
    'Cliquez sur un élément pour l\'éditer',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Texte',
        description: 'Lecture continue de tous vos items : description complète, contributions et pièces jointes dépliées.',
      },
    },
  ],
};
