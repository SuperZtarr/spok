/* Textes du mode Aide pour le cadre commun et la barre d'espace, indexés par nom de zone data-devzone (le même
   vocabulaire que DevZoneInspector). Une zone ajoutée ici doit exister dans le code, et toute zone data-devzone posée
   doit avoir son texte ici (sauf « contenu », trop large) — contrôlé par coverage.test. Titre ≤ 4 mots, 1 à 3 phrases,
   sans lister les boutons (rôle des infobulles). Les commandes de la barre d'espace et les champs de la fiche d'élément
   reprennent le texte de leur élément d'aide (spaceToolbar.elements.ts, item-modal.help.ts) ; seules les zones qui
   regroupent plusieurs fonctions gardent un texte ici. */
import { elements as I } from '../components/help/item-modal.help';
import { SPACE_TOOLBAR_ELEMENTS as E } from './spaceToolbar.elements';
import type { HelpElement, HelpZone } from './types';

const elementZone = ({ title, text }: HelpElement): HelpZone => ({ title, text });

/** Infobulles de la barre latérale (lues par HelpHint dans Layout.tsx). */
export const SIDEBAR_HINTS = {
  process: (count: number) => `Cet espace contient un process (${count} élément${count > 1 ? 's' : ''} placé${count > 1 ? 's' : ''}) — vue Process de l'espace.`,
};

export const SHELL_ZONES: Record<string, HelpZone> = {
  sidebar: { title: 'Barre latérale', text: 'Vos espaces et vos communautés. Cliquez sur un espace pour y entrer. Une petite icône après son nom signale qu\'il contient un process.' },
  'sidebar-logo': { title: 'Logo', text: 'Ramène à l\'accueil.' },
  'sidebar-guide': { title: 'Guide de démarrage', text: 'Relance la visite guidée des bases de SPOK.' },
  'sidebar-nav': { title: 'Navigation', text: 'Vos accès aux espaces : favoris, récents, vos espaces, vos communautés.' },
  'sidebar-favoris': { title: 'Favoris', text: 'Les espaces marqués d\'une étoile, toujours en tête de la barre.' },
  'sidebar-recents': { title: 'Récents', text: 'Les derniers espaces visités, pour y revenir vite.' },
  'sidebar-mes-espaces': { title: 'Mes espaces', text: 'Votre espace personnel et les espaces hors communauté dont vous êtes membre.' },
  'sidebar-communaute': { title: 'Une communauté', text: 'Une communauté et ses espaces : cliquez pour déplier ses espaces, ou sur son nom pour ouvrir sa page. Au survol, « + » crée un espace et « ⋯ » sur un espace ouvre ses actions.' },
  'sidebar-autres-espaces': { title: 'Autres espaces', text: 'Des espaces visibles hors de vos communautés : vous pouvez les consulter ou les rejoindre.' },
  'sidebar-arbre': { title: 'Communauté courante', text: 'La communauté où vous êtes et l\'arbre de ses espaces. « Toutes les communautés » revient à la liste complète. Au survol d\'un espace, « ⋯ » permet de créer un sous-espace, de le déplacer, de changer son ordre ou de le supprimer.' },
  'sidebar-footer': { title: 'Pied de barre', text: 'Les pages d\'administration quand le mode admin est actif, et la date de la dernière mise en ligne de SPOK.' },
  header: { title: 'En-tête', text: 'Où vous êtes, le mode d\'affichage (Forum, Projet, Loisirs, Tous), la création rapide, les séances en direct, les notifications et votre compte.' },
  bandeau: { title: 'Navigation globale', text: 'Les pages qui couvrent toutes vos communautés (accueil, communautés, espaces, graphes, liens), puis vos pages personnelles.' },
  toolbar: { title: 'Barre de l\'espace', text: 'Commune à toutes les vues de l\'espace : choix de la vue, ordre, filtre ou aperçu selon la vue, et actions de l\'espace.' },
  'toolbar-vues': elementZone(E.vues),
  'toolbar-ordre': elementZone(E.ordre),
  'toolbar-filtre': elementZone(E.filtre),
  'toolbar-apercu': elementZone(E.apercu),
  'toolbar-actions': { title: 'Actions de l\'espace', text: 'Séances en direct, nombre d\'éléments, modèles, historique et paramètres de l\'espace.' },
  'contenu-barre-vue': { title: 'Barre de la vue', text: 'Les commandes propres à la vue affichée : créer un élément, régler l\'affichage, aide et export.' },
  // Fiche d'un élément (ItemEditModal, ItemReadView)
  'item-chemin': elementZone(I.chemin),
  'item-entete': { title: 'En-tête de la fiche', text: 'Le type et le titre de l\'élément, le choix entre Afficher et Modifier, et qui l\'a créé.' },
  'item-description': elementZone(I.description),
  'item-contributions': { title: 'Réactions et contributions', text: 'Les réactions à l\'élément et les messages des membres, avec leurs réponses.' },
  'item-champs': { title: 'Champs de pilotage', text: 'Le type, le statut, les dates et le média de l\'élément.' },
  'item-type': elementZone(I.type),
  'item-statut': elementZone(I.statut),
  'item-dates': elementZone(I.dates),
  'item-details': { title: 'Détails', text: 'L\'identifiant de l\'élément, son assignation, ses relations, ses tags et ses enfants.' },
  'item-relations': elementZone(I.relations),
  'item-tags': elementZone(I.tags),
  'item-enfants': elementZone(I.enfants),
  'item-pied': elementZone(I.actions),
  'item-lecture': { title: 'Mode Afficher', text: 'La fiche présentée comme un document à lire. On modifie en passant sur « Modifier ».' },
  'item-lecture-media': { title: 'Contenus', text: 'Les images et schémas de l\'élément en grand (cliquez pour le plein écran), puis ses fichiers et liens à ouvrir, regroupés par sorte.' },
  'item-lecture-contenu': { title: 'Contenu', text: 'Description, éléments enfants (cliquables), relations et contributions, en lecture seule — le même contenu que celui copié par « Copier la fiche ».' },
  'item-resume': { title: 'Résumé des champs', text: 'Les champs renseignés mais masqués dans la fiche réduite. Cliquez pour afficher tous les champs.' },
  'item-medias': { title: 'Contenus', text: 'Les images, fichiers, liens et schémas de l\'élément, plusieurs de chaque sorte, quel que soit son type : « + Ajouter » en joint un nouveau.' },
  'item-composer': { title: 'Mode Composer', text: 'Le titre et le chapeau de l\'article en rappel, puis ses blocs à ajouter, réordonner, régler ou retirer. Les éléments eux-mêmes restent à leur place.' },
};
