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
    id: 'personal-token-shown-once',
    page: 'Profil utilisateur',
    trigger: "Création d'un jeton d'accès Claude (MCP distant)",
    effect: "Le jeton en clair est affiché une seule fois ; seul son hash est stocké. Portée lecture seule = outils de lecture uniquement. Révocation immédiate (revokedAt), sans suppression. Un jeton ne peut ni gérer les jetons ni accéder à /admin ; toute écriture via MCP est tracée dans l'audit (changes.source)",
    location: 'apps/web/src/components/PersonalTokensSection.tsx, apps/api/src/routes/personal-tokens.ts, apps/api/src/plugins/jwt.ts, apps/api/src/routes/mcp.ts',
  },
  {
    id: 'mcp-access-granted-by-admin',
    page: 'Profil utilisateur / Administration → Utilisateurs',
    trigger: "Utilisation du MCP distant (création ou usage d'un jeton personnel)",
    effect: "L'accès MCP doit être accordé par un admin (les admins globaux l'ont toujours). Sans accès : bouton « Demander l'accès » (admins notifiés une fois, demande en attente visible dans la colonne MCP), création de jeton refusée, et tout jeton existant renvoie 403 — retirer l'accès coupe donc les jetons immédiatement, sans les révoquer. Une tentative refusée d'un utilisateur connu alerte les admins (notification « Accès Claude refusé », au plus une par utilisateur et par 24 h ; tentatives anonymes non signalées). Accord et retrait tracés dans l'AuditLog",
    location: 'apps/api/src/utils/personalTokens.ts (hasMcpAccess), apps/api/src/plugins/jwt.ts, apps/api/src/mcp/deniedAccessAlert.ts, apps/api/src/routes/personal-tokens.ts, apps/api/src/routes/admin/users.ts, apps/web/src/components/PersonalTokensSection.tsx, apps/web/src/pages/admin/UsersPage.tsx',
  },
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
  {
    id: 'relation-types-single-source',
    page: 'Toutes (modale item, Gantt, PERT, carte mentale, carte des relations, infobulles)',
    trigger: "Affichage, création ou calcul d'ordonnancement d'une relation",
    effect: "4 types officiels : Bloque, Permet, Entraîne, Lié à — mêmes libellés et couleurs partout. Seuls Bloque et Permet ordonnent (chemin critique Gantt, rangs PERT) ; Entraîne décale les dates sans ordonner ; Lié à n'ordonne pas. Un type hors liste est refusé par l'API et, s'il existe encore, affiché en gris sans effet",
    location: 'apps/web/src/constants/relationTypes.ts, apps/api/src/routes/item-relations.ts (z.enum RELATION_TYPES)',
  },
  {
    id: 'assignment-read-receipt',
    page: 'Modale item (Assigné à), vue Membres, page Tâches',
    trigger: "Assignation d'un item à quelqu'un d'autre que soi",
    effect: "La date et l'auteur de l'assignation sont enregistrés. « Vu par X le … » dès que l'assigné ouvre l'item après cette date, sinon « Pas encore vu » (œil barré orange dans la vue Membres et la page Tâches). Réassignation = repart de zéro ; auto-assignation, désassignation et assignations antérieures au 29/09/2026 : pas d'indicateur. Marquer non lu ensuite ne retire pas l'accusé",
    location: 'apps/api/src/utils/assignment.ts, apps/web/src/lib/assignmentReceipt.ts',
  },
  {
    id: 'live-session-create-access',
    page: 'Espace de communauté (bouton « Séances »), espace de séance',
    trigger: "Création ou ouverture d'une séance de présentation en direct",
    effect: "Seul un propriétaire de la communauté crée une séance : sous-espace PRIVÉ nommé par la date du jour, dont il est animateur. Seuls les membres de l'espace parent peuvent rejoindre ; rejoindre = devenir membre de l'espace de séance (accès conservé après la séance). L'animateur désigne les présentateurs parmi les membres du parent",
    location: 'apps/api/src/routes/live-sessions.ts, apps/web/src/components/live/ParentSessionsButton.tsx',
  },
  {
    id: 'live-session-locked-copy',
    page: 'Espace de séance (vues, modale item, fenêtre en direct)',
    trigger: "Un présentateur affiche un élément pendant la séance",
    effect: "L'élément seul est copié dans l'espace de séance et verrouillé (images dupliquées) ; ses sous-items restent cachés et sont révélés un par un par l'animateur seul, qui est le seul à les voir avant révélation (« ne pas spoiler »). Une copie se range sous la copie de son parent d'origine s'il a déjà été présenté. Contenu (titre, description, statut, dates…) non modifiable par personne, y compris par la restauration d'historique (seul le rangement peut être restauré) ; organisation libre pour tous les membres (déplacer, tags, relations) ; commentaires ouverts ; seul l'animateur peut supprimer une copie. Réafficher un élément inchangé réutilise la même copie, sinon nouvelle copie. Le dernier affichage l'emporte (affichage libre, « présenté par … »)",
    location: 'apps/api/src/utils/itemLock.ts, apps/api/src/utils/sessionCopy.ts, apps/web/src/components/ItemEditModal.tsx',
  },
  {
    id: 'live-session-preparation-agenda',
    page: 'Espace de séance (Préparation), fenêtre en direct, menu contextuel et modale des items',
    trigger: "Préparation puis animation d'une séance",
    effect: "« Nouvelle séance » ouvre « Préparer la séance » : les éléments de premier niveau de l'espace, tous cochés, chacun « avec ses N sous-éléments » (activé par défaut) — les éléments cochés forment la préparation initiale (tout décoché = vide) ; la séance est créée préparée, l'animateur la démarre. Animateur et présentateurs ajoutent à la préparation des éléments de n'importe lequel de leurs espaces (menu de l'item ou modale : « Ajouter à la préparation »), sans copie avant l'affichage ; si l'élément a des sous-éléments directs, la question « Élément seul / Avec ses N sous-éléments » est posée (ajoutés juste après, dans leur ordre). La préparation complète n'est visible que de l'animateur et des présentateurs ; les participants ne voient que les éléments déjà présentés. L'animateur réordonne tout ; un présentateur seulement ses propres lignes ; chacun retire les siennes (l'animateur toutes). Afficher (préparation, recherche ou « Présenter en séance ») n'est possible qu'en direct. La séance ouverte devient la séance active : sa fenêtre en direct suit l'utilisateur sur toutes les pages jusqu'à la fin ou « Quitter le direct ». Un bouton de l'en-tête liste les séances en cours auxquelles l'utilisateur est convié (membre de l'espace parent ou de la séance) pour y revenir. Une seule séance en cours (préparée ou en direct) par espace ; noms uniques « date (n) ». Séance terminée : l'animateur peut « Créer la suite » (une seule suite directe) — nouvelle séance préparée liée, qui reprend les présentateurs, la préparation non présentée et recopie les éléments déjà présentés (sans l'organisation ni les commentaires)",
    location: 'apps/api/src/routes/live-sessions.ts, apps/web/src/components/live/*, apps/web/src/lib/liveItemActions.ts',
  },
  {
    id: 'live-session-invitees',
    page: 'Séances live (Préparer la séance, bandeau « Invités »)',
    trigger: "L'animateur invite des membres de la communauté",
    effect: "Seuls des membres de la communauté SANS accès à l'espace parent peuvent être invités (les autres rejoignent déjà). L'invité devient membre de l'espace de séance seulement : il voit la séance (éléments présentés, fil, commentaires, réorganisation) et la fenêtre en direct, jamais l'espace parent ; il est participant (ni préparation complète, ni présentation). Notification à l'invitation. Invitation à la création ou depuis le bandeau tant que la séance n'est pas terminée ; retrait possible à tout moment (retire l'accès). Les invités sont repris dans la suite s'ils restent invitables",
    location: 'apps/api/src/utils/liveInvites.ts, apps/api/src/routes/live-sessions.ts, apps/web/src/components/live/InviteesPanel.tsx',
  },
  {
    id: 'bulk-upload-images-documents',
    page: 'Vues Images et Documents (import en masse)',
    trigger: "Import de plusieurs fichiers (bouton « Importer des … » ou glisser-déposer sur la vue)",
    effect: "Un item IMAGE (vue Images) ou DOCUMENT (vue Documents) par fichier, créé à la racine de l'espace, titré du nom de fichier sans extension. Fichiers refusés avant envoi (format, extension interdite, taille) listés avec leur raison ; si l'envoi échoue après création, l'item est supprimé. Réservé aux membres pouvant éditer",
    location: 'apps/web/src/lib/bulkUpload.ts, apps/web/src/hooks/useBulkUpload.ts',
  },
  {
    id: 'image-resize-before-upload',
    page: "Tout envoi d'image (modale d'item, avatar et couverture d'espace / communauté, import en masse)",
    trigger: "Envoi d'une image JPEG, PNG ou WebP",
    effect: "Réduite dans le navigateur à 1920 px max (plus grand côté), réencodée en WebP, avant le contrôle des 5 Mo : une photo lourde passe au lieu d'être refusée. Les GIF ne sont jamais réduits (animation) et restent limités à 5 Mo. Le serveur réduit de toute façon à 1920 px WebP",
    location: 'apps/web/src/lib/imageResize.ts, apps/web/src/components/ui/ImageUploadZone.tsx',
  },
  {
    id: 'community-visibility-source-of-truth',
    page: 'Sidebar (liste des communautés), accès à une communauté et à ses membres',
    trigger: "Affichage ou accès à une communauté dont l'utilisateur n'est pas membre",
    effect: "La visibilité se lit uniquement sur le champ visibility (OPEN / READONLY / PRIVATE), jamais sur isPublic (déprécié, parfois désynchronisé en base). La sidebar montre en plus des communautés de l'utilisateur les communautés non privées non rejointes, les invitations en attente et, en mode admin, toutes les autres ; chacune porte une icône de visibilité (globe / œil / cadenas), et les non-membres ont le nom grisé avec la mention « Invitation » ou un bouclier admin",
    location: 'apps/api/src/routes/communities.ts (GET /, GET /:id, GET /:id/members), apps/web/src/components/CommunityBadge.tsx',
  },
  {
    id: 'community-publication-approval',
    page: 'Création de communauté, paramètres de communauté (Visibilité)',
    trigger: 'Passage d\'une communauté de « Privée » à « Ouverte » ou « Lecture seule », à la création ou dans les paramètres',
    effect: "La communauté reste privée et une demande de publication est créée (« Publication en attente », admins notifiés) ; un admin valide ou refuse dans Administration (un refus efface entièrement la demande). Le propriétaire peut annuler sa demande tant qu'elle est en attente (« Annuler la demande » dans les paramètres). Repasser en Privée, ou basculer Ouverte ↔ Lecture seule, est immédiat. Un admin en mode admin change directement, sans demande",
    location: 'apps/api/src/routes/communities.ts (POST /, PATCH /:id), apps/api/src/routes/admin/communities.ts (approve-public / reject-public), apps/web/src/pages/CommunitySettingsPage.tsx',
  },
  {
    id: 'private-space-direct-members-only',
    page: "Page d'un espace, liste de ses membres, sidebar, création de sous-espace",
    trigger: "Accès à un espace dont la visibilité effective (espace → parent → communauté) est Privée par un utilisateur qui n'en est pas membre direct",
    effect: "Être membre de la communauté ne suffit pas : la fiche de l'espace, ses membres et ses éléments (y compris dans les graphes et le sunburst) sont introuvables, on ne peut pas le rejoindre de soi-même (accès sur invitation uniquement) ni y créer ou y rattacher un sous-espace. Seuls ses membres directs, le propriétaire de la communauté et un admin y accèdent (mode admin pour rejoindre ou modifier). Un espace Lecture seule s'ouvre en lecture (rôle VIEWER) et ne se rejoint que sur invitation ; un espace Ouvert s'ouvre en modification (rôle MEMBER) et se rejoint librement",
    location: 'apps/api/src/routes/spaces.ts (GET /:id, GET /:id/members, POST /:id/join, POST / et PATCH /:id avec parentId), apps/api/src/routes/items.ts (checkSpaceAccess, filterReadableSpaceIds), apps/api/src/routes/graph.ts',
  },
  {
    id: 'space-leave-and-self-demote',
    page: "Paramètres d'un espace (onglet Membres, ou écran « pas les permissions » pour un simple membre)",
    trigger: 'Un membre veut quitter un espace, ou un propriétaire veut redevenir simple membre',
    effect: "Un propriétaire peut se rétrograder en membre ou quitter l'espace s'il reste au moins un autre propriétaire ; seul propriétaire, il doit d'abord en nommer un autre ou transférer la propriété (un espace n'est jamais sans propriétaire). Un simple membre direct peut quitter depuis les paramètres. Quitter ramène à l'accueil",
    location: 'apps/api/src/routes/spaces.ts (POST /:id/leave, PATCH /:id/members/:memberId), apps/web/src/components/settings/MembersColumnManager.tsx, SpaceMembersManager.tsx, apps/web/src/pages/SpaceSettingsPage.tsx',
  },
  {
    id: 'community-owner-all-spaces',
    page: 'Sidebar, page et paramètres de tout espace de la communauté, contenu des espaces, séances live',
    trigger: "Propriétaire d'une communauté, membre ou non d'un de ses espaces",
    effect: "Droits de propriétaire dans tous les espaces de sa communauté, privés compris, sans passer par le mode admin : il les voit dans la sidebar, modifie leurs paramètres, gère membres et invitations, crée, modifie et supprime le contenu, crée des sous-espaces et prépare des séances à partir de n'importe quel espace",
    location: 'apps/api/src/routes/items.ts (isCommunityOwnerOfSpace, checkSpaceAccess), apps/api/src/routes/spaces.ts (isSpaceOwnerOrAdmin, GET /, GET /:id, PATCH /:id, POST /:id/join)',
  },
  {
    id: 'admin-mode-owner-rights',
    page: "Paramètres de communauté et d'espace, toutes les actions de gestion de communauté et d'espace",
    trigger: 'Admin global avec le mode admin activé, membre ou non de la communauté',
    effect: "Mêmes droits que le propriétaire : modifier nom, description, visibilité et contexte, images, référentiels, tags, gérer membres, rôles et invitations, envoyer des emails, supprimer la communauté. Sans le mode admin, un admin global n'a que ses droits de membre. Les actions personnelles (rejoindre, quitter, sourdine, céder sa propre propriété) restent liées à l'utilisateur. Côté espace : membres, rôles, invitations, images, emails, suppression. Côté contenu : rôle OWNER dans tout espace (créer, modifier, déplacer, fusionner, convertir, supprimer des éléments, y compris les copies de séance verrouillées, gérer tags, relations, contributions), et création de séances live ; les actions d'animation restent à l'animateur. Hors mode admin, un admin global est un utilisateur normal : aucune lecture d'office des espaces, éléments, graphes ou résultats de recherche hors de ses propres droits",
    location: 'apps/api/src/routes/communities.ts (isOwnerOrAdmin), apps/api/src/routes/community-referentiels.ts, apps/api/src/routes/spaces.ts (isSpaceOwnerOrAdmin, GET /:id renvoie OWNER), apps/api/src/routes/items.ts (checkSpaceAccess 4e argument isAdminMode), apps/api/src/routes/live-sessions.ts, apps/web/src/pages/CommunitySettingsPage.tsx et SpaceSettingsPage.tsx (canEdit)',
  },
];
