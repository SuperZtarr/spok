/*
 * Types de l'aide utilisateur intégrée (couche « doc utilisateur », cf. mémoire three-doc-layers) :
 * une fiche HelpEntry par vue / page / modale, écrite DANS LE CODE à côté du composant
 * (vues : components/views/help/<vue>.help.ts), lue par tous les affichages (point d'interrogation,
 * tour guidé ; infobulles, états vides, aide des champs et mode Aide au fil de l'eau).
 * Modifier un comportement d'interface = mettre à jour sa fiche dans le même changement.
 * Mode Aide (phase 4) : champ `zones`, lu par help/helpZones.ts et affiché par help/HelpModeOverlay.
 * Pilote Kanban (2026-11-07) : `elements` = un texte par fonction, dont help/elements.ts dérive conseils, zones,
 * infobulles et étapes de tour ; leurs `changes` alimentent les nouveautés (help/announcements.ts).
 */

/** Étape d'un tour guidé (driver.js). element = sélecteur CSS (data-tour de préférence) ; absent = encart centré. */
export interface TourStep {
  element?: string;
  popover: {
    title: string;
    description: string;
    side?: 'top' | 'bottom' | 'left' | 'right';
  };
  /** Changements de la fonction : affichés dans l'étape tant que l'utilisateur ne les a pas traités (help/elements.ts). */
  changes?: HelpChange[];
}

/** Zone expliquée par le mode Aide (survol) : titre ≤ 4 mots, texte 1 à 3 phrases, sans lister les boutons. */
export interface HelpZone {
  title: string;
  text: string;
}

/** Changement annoncé d'une fonction : nouveauté (new) ou évolution d'une fonction existante (evolution). */
export interface HelpChange {
  /** Identifiant stable : c'est lui qui est retenu quand l'utilisateur a traité l'annonce. */
  id: string;
  kind: 'new' | 'evolution';
  /** Ce qui change, en une phrase. */
  text: string;
  /** AAAA-MM-JJ. Sans date, l'annonce n'apparaît qu'en développement local : elle ne peut pas partir en production. */
  date?: string;
}

/** Élément d'aide : une fonction, un seul texte, repris par tous les affichages. */
export interface HelpElement {
  /** Nom de la fonction (titre de zone et d'étape de tour, ≤ 4 mots). */
  title: string;
  /** Libellé au survol. */
  short: string;
  /** Explication : ce que ça fait et comment s'en servir. */
  text: string;
  /** Repère existant de la commande, si ce n'est pas sa zone data-help-zone (barre commune). */
  target?: string;
  /** Commande sans zone du mode Aide (ex. bouton partagé par plusieurs vues) : son infobulle HelpHint l'y explique déjà. */
  noZone?: boolean;
  /** Position de la bulle de tutoriel par rapport à la zone. */
  side?: TourStep['popover']['side'];
  /** Nouveautés et évolutions de cette fonction. */
  changes?: HelpChange[];
}

/** Fiche d'aide d'un élément d'interface. */
export interface HelpEntry {
  /** Adresse de la page, si elle est fixe : destination de « Montrer » pour une annonce de cette fiche. */
  route?: string;
  /** Éléments d'aide de la fiche, par clé de zone : source des tips, zones, hints et étapes dérivés. */
  elements?: Record<string, HelpElement>;
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
  /** Zones expliquées par le mode Aide, par clé — posées dans le code par data-help-zone="<fiche>:<clé>". */
  zones?: Record<string, HelpZone>;
}
