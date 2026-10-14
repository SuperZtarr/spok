/*
 * Types de l'aide utilisateur intégrée (couche « doc utilisateur », cf. mémoire three-doc-layers) :
 * une fiche HelpEntry par vue / page / modale, écrite DANS LE CODE à côté du composant
 * (vues : components/views/help/<vue>.help.ts), lue par tous les affichages (point d'interrogation,
 * tour guidé ; infobulles, états vides, aide des champs et mode Aide au fil de l'eau).
 * Modifier un comportement d'interface = mettre à jour sa fiche dans le même changement.
 */

/** Étape d'un tour guidé (driver.js). element = sélecteur CSS (data-tour de préférence) ; absent = encart centré. */
export interface TourStep {
  element?: string;
  popover: {
    title: string;
    description: string;
    side?: 'top' | 'bottom' | 'left' | 'right';
  };
}

/** Fiche d'aide d'un élément d'interface. */
export interface HelpEntry {
  /** Nom affiché (« Liste », « Paramètres de l'espace »…). */
  title: string;
  /** À quoi ça sert — une ou deux phrases. */
  summary: string;
  /** Accroche d'une ligne pour les cartes (liste des vues : Présentation, aperçu d'espace, page d'accueil publique). */
  short?: string;
  /** Comment s'en servir — gestes clés, une ligne chacun. */
  tips: string[];
  /** Tour guidé pas à pas (au moins une étape pour une vue — contrôlé par help/coverage.test.ts). */
  tour: TourStep[];
  /** Infobulles des boutons/icônes, par clé stable (lues par HelpHint) — au fil de l'eau. */
  hints?: Record<string, string>;
  /** Texte d'état vide d'une vue (lu par EmptyHelp ; obligatoire pour les vues, cf. coverage.test). */
  empty?: string;
  /** Aide sous les champs d'un formulaire, par clé de champ (lue par FieldHelp — page/modale : clé du registre PAGE_HELP). */
  fields?: Record<string, string>;
}
