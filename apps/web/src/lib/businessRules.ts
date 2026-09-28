/* Registre des règles de gestion implicites (type/statut/priorité), consulté par RuleHint (UI dev) et par Claude comme documentation vivante. */

export interface ItemBusinessRule {
  id: string;
  category: 'type' | 'status' | 'priority';
  appliesToValues: string[];
  trigger: string;
  effect: string;
  location: string;
}

export interface PageBusinessRule {
  id: string;
  page: string;
  trigger: string;
  effect: string;
  location: string;
}

export const ITEM_BUSINESS_RULES: ItemBusinessRule[] = [
  {
    id: 'default-type-undefined',
    category: 'type',
    appliesToValues: ['UNDEFINED'],
    trigger: "Création d'un item",
    effect: 'Type initialisé à UNDEFINED ("Non défini")',
    location: 'apps/web/src/pages/SpacePage.tsx:470,502,517',
  },
  {
    id: 'type-shows-url-field',
    category: 'type',
    appliesToValues: ['LINK'],
    trigger: 'Type = Lien',
    effect: 'Affiche un champ URL',
    location: 'apps/web/src/components/ItemEditModal.tsx:1244-1256',
  },
  {
    id: 'type-shows-diagram-editor',
    category: 'type',
    appliesToValues: ['DIAGRAM'],
    trigger: 'Type = Diagramme',
    effect: "Affiche l'éditeur de diagramme (draw.io)",
    location: 'apps/web/src/components/ItemEditModal.tsx:1259-1275',
  },
  {
    id: 'type-shows-image-upload',
    category: 'type',
    appliesToValues: ['IMAGE'],
    trigger: 'Type = Image',
    effect: "Affiche la zone d'upload d'image",
    location: 'apps/web/src/components/ItemEditModal.tsx:1278-1299',
  },
  {
    id: 'type-shows-document-upload',
    category: 'type',
    appliesToValues: ['DOCUMENT'],
    trigger: 'Type = Document',
    effect: "Affiche la zone d'upload de fichier",
    location: 'apps/web/src/components/ItemEditModal.tsx:1302-1318',
  },
  {
    id: 'type-shows-hours-mode',
    category: 'type',
    appliesToValues: ['MEETING'],
    trigger: 'Type = Réunion',
    effect: "Affiche les dates en mode heures (H:MM) par défaut, au lieu de jours pleins",
    location: 'apps/web/src/components/ItemEditModal.tsx:319-324,1033,1017',
  },
  {
    id: 'type-default-duration-meeting-task',
    category: 'type',
    appliesToValues: ['MEETING', 'TASK'],
    trigger: 'Date de début renseignée sans date de fin',
    effect: 'Date de fin par défaut = début + 1 heure',
    location: 'apps/web/src/components/ItemEditModal.tsx:498-499',
  },
  {
    id: 'type-default-duration-project',
    category: 'type',
    appliesToValues: ['PROJECT'],
    trigger: 'Date de début renseignée sans date de fin',
    effect: 'Date de fin par défaut = début + 1 mois',
    location: 'apps/web/src/components/ItemEditModal.tsx:500-501',
  },
  {
    id: 'type-default-duration-period',
    category: 'type',
    appliesToValues: ['PERIOD'],
    trigger: 'Date de début renseignée sans date de fin',
    effect: 'Date de fin par défaut = début + 1 jour',
    location: 'apps/web/src/components/ItemEditModal.tsx:502-503',
  },
  {
    id: 'status-clear-dates',
    category: 'status',
    appliesToValues: ['undefined'],
    trigger: 'Statut = "Non défini"',
    effect: 'Vide les dates de début et de fin',
    location: 'apps/web/src/components/ItemEditModal.tsx:1084',
  },
  {
    id: 'status-autofill-start',
    category: 'status',
    appliesToValues: ['todo', 'in_progress', 'to_validate', 'scheduled', 'late'],
    trigger: 'Statut choisi (≠ "Non défini"), date de début vide',
    effect: "Remplit la date de début à aujourd'hui",
    location: 'apps/web/src/components/ItemEditModal.tsx:1088',
  },
  {
    id: 'status-autofill-end-terminal',
    category: 'status',
    appliesToValues: ['done', 'cancelled'],
    trigger: 'Statut = "Terminé"/"Annulé", date de fin vide',
    effect: "Remplit la date de fin à aujourd'hui",
    location: 'apps/web/src/components/ItemEditModal.tsx:1087',
  },
];

export const PAGE_BUSINESS_RULES: PageBusinessRule[] = [
  {
    id: 'mark-unread',
    page: 'Menus contextuels des items, modale item, cloche de notifications, page Activité',
    trigger: "« Marquer comme non lu » (item ou notification)",
    effect: "Item : marque personnelle (ItemView.markedUnread) → l'item réapparaît dans Activité / Non lus (même ancien, modifié par soi ou en espace perso — groupe « Espaces personnels ») et clignote dans les vues ; la prochaine ouverture le remet en lu. Notification : repasse non lue (compteur de la cloche +1)",
    location: 'apps/api/src/routes/activity.ts, apps/api/src/routes/notifications.ts, apps/web/src/lib/itemMenuGroups.ts (markItemUnread)',
  },
  {
    id: 'forum-modal-reduced-with-summary',
    page: 'Modale item (mode Forum)',
    trigger: "Ouverture d'un item en mode d'interface Forum",
    effect: "Modale toujours réduite (titre, description, média, réactions/contributions) — plus de dépliage automatique. Ligne de résumé cliquable sous le titre : type (hors Note/Non défini) · statut · priorité · période/début · échéance · assigné · N liens ; clic ou « Plus de champs » = modale complète. Projet/Tous : modale complète",
    location: 'apps/web/src/components/ItemEditModal.tsx, apps/web/src/components/item-edit-helpers.ts (buildForumSummary)',
  },
  {
    id: 'priority-scale-single-source',
    page: 'Toutes (badges, filtres, confirmations, exports)',
    trigger: "Affichage ou filtrage d'une priorité",
    effect: "Échelle 4 = Urgente (P1), 3 = Haute, 2 = Normale, 1 = Basse (P4). Libellés et couleurs toujours tirés de PRIORITIES — pas de table locale (DeadlinesView et DeleteConfirmModal avaient l'échelle inversée)",
    location: 'apps/web/src/constants/ui.ts (PRIORITIES)',
  },
  {
    id: 'absorb-children-only-if-children',
    page: 'Toutes les vues (menu contextuel) + modale item',
    trigger: "Affichage de l'action « Absorber les enfants »",
    effect: "Proposée uniquement si l'item a des enfants (childCount de la liste API ou children des vues en arbre ; allItems dans la modale) — sinon l'API répond 400 « No children to absorb »",
    location: 'apps/web/src/lib/itemMenuGroups.ts (hasChildItems), apps/web/src/components/ItemEditModal.tsx',
  },
  {
    id: 'login-remember-last-email',
    page: 'Connexion (/login)',
    trigger: 'Connexion réussie',
    effect: "L'e-mail est mémorisé dans le navigateur (localStorage spok_last_login_email) et pré-rempli à la prochaine ouverture de la page, focus sur le mot de passe. Jamais le mot de passe. Un échec de connexion ne modifie pas l'e-mail mémorisé",
    location: 'apps/web/src/pages/LoginPage.tsx',
  },
  {
    id: 'interface-mode-context-override',
    page: 'Toutes (header)',
    trigger: "Entrée dans une communauté / clic sur un bouton Forum-Projet-Tous du header",
    effect: "Mode = contexte de la communauté (FORUM→Forum, PROJECT→Projet, sinon Tous) ; le choix manuel le surcharge tant qu'on reste dans la même communauté, remis au contexte au changement de communauté ou de contexte. Non persisté",
    location: 'apps/web/src/stores/interfaceMode.ts, apps/web/src/components/Layout.tsx (effet applyContextMode)',
  },
  {
    id: 'gantt-due-date-gestures',
    page: 'Vue Gantt (TimelineView)',
    trigger: "Clic droit sur la zone chronologique d'une ligne / glisser le losange d'échéance / clic droit sur le losange",
    effect: "Pose ou déplace l'échéance au jour visé (heure de l'ancienne échéance conservée, sinon 12:00 local) / la déplace au jour près / la supprime. Sans confirmation, sans cascade « Entraîne ». Inactif sur les lignes à dates dérivées des enfants et sans droit d'édition",
    location: 'apps/web/src/components/views/TimelineView.tsx (handleLaneContextMenu, handleDueMouseDown), apps/web/src/lib/timelineDueDate.ts',
  },
  {
    id: 'gantt-move-bar-without-end',
    page: 'Vue Gantt (TimelineView)',
    trigger: "Glisser le corps de barre d'un item avec début mais sans date de fin",
    effect: "La barre (dessinée jusqu'à aujourd'hui) se déplace telle qu'affichée : début et fin décalés du même delta, une date de fin est enregistrée",
    location: 'apps/web/src/components/views/timeline-utils.ts (moveInitialEnd), TimelineView.tsx (handleBodyMouseDown)',
  },
  {
    id: 'gantt-move-dateless-parent',
    page: 'Vue Gantt (TimelineView)',
    trigger: "Glisser la barre pointillée d'un parent sans dates propres (période dérivée des enfants)",
    effect: "Propose de décaler le groupe (CascadeShiftConfirmModal, enfants cochés par défaut, liés « Entraîne » inclus) ; « Annuler » ne modifie rien ; le parent n'est jamais daté",
    location: 'apps/web/src/components/views/TimelineView.tsx (handleDragEnd, anchorWithoutDates), apps/web/src/components/CascadeShiftConfirmModal.tsx',
  },
];
