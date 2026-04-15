# Notifications et invitations

## Notifications

### Types (NotificationType)
| Type | Icone | Couleur | Preference par defaut |
|------|-------|---------|----------------------|
| INVITATION | UserPlus | blue-500 | all (in-app + email) |
| ASSIGNMENT | ClipboardList | orange-500 | all |
| CONTRIBUTION | MessageSquare | green-500 | in_app |
| MENTION | AtSign | purple-500 | all |
| EMAIL_VERIFICATION | Mail | amber-500 | in_app |

### Preferences utilisateur
- Stockees dans User.notificationPreferences (Json)
- 3 niveaux : 'all' (in-app + email), 'in_app' (in-app seul), 'none' (rien)
- Fallback sur DEFAULT_NOTIFICATION_PREFERENCES si non configurees

### Creation (utils/notifications.ts)
createNotification({ userId, type, title, message?, link?, metadata? }) :
1. Charge les preferences de l'utilisateur
2. Si preference === 'none' → skip
3. Cree la notification en base
4. Si preference === 'all' → envoie aussi un email (Resend, from: notifications@spok.space)
5. Erreurs silencieuses (catch + log, ne bloque jamais l'operation principale)

### API
| Route | Description |
|-------|-------------|
| GET /notifications | Liste paginee (limit, offset), tri : non-lus d'abord, puis par date |
| GET /notifications/unread-count | { count: number } |
| PATCH /notifications/:id/read | Marquer comme lu (verifie ownership) |
| PATCH /notifications/read-all | Marquer tous comme lus |
| DELETE /notifications/:id | Supprimer (verifie ownership) |

Toutes ces routes requierent l'authentification JWT.

### NotificationBell (composant)
- Bouton cloche avec badge count (max 99+, rouge)
- Dropdown au clic avec liste scrollable (max-h 420px)
- Polling : unreadCount toutes les 30s, invitations toutes les 60s
- unreadCount = notifications non lues + invitations en attente
- Queries protegees par enabled: !!user

## Invitations

### Modele (Invitation)
- email, token (unique), status (PENDING/ACCEPTED/DECLINED/CANCELLED), role, message
- communityId ou spaceId (l'un des deux)
- invitedById, expiresAt (30 jours), respondedAt

### Flux
1. OWNER invite → cree Invitation + envoie email avec lien /invitation?token=xxx
2. Invite ouvre le lien → voit les details (GET /invitations/by-token/:token, public)
3. Invite accepte (POST /invitations/:token/accept) :
   - Si communaute : cree CommunityMembership + autoJoinCommunitySpaces()
   - Si espace : cree SpaceMembership
   - Notifie l'inviteur
4. Invite decline → status = DECLINED, pas de notification

### autoJoinCommunitySpaces()
Quand une invitation communaute est acceptee :
- Cherche tous les espaces de la communaute avec defaultRole != null
- Cree un SpaceMembership pour chaque (skip si deja membre)
- Permet l'onboarding automatique

### Pending invitations dans NotificationBell
- Query : GET /invitations/my (invitations PENDING pour l'email de l'utilisateur, non expirees)
- Affichees en haut du dropdown avec boutons Accepter/Decliner

## Fichiers cles
- `packages/database/prisma/schema.prisma` — Notification, Invitation models
- `apps/api/src/utils/notifications.ts` — createNotification, sendNotificationEmail, sendInvitationEmail
- `apps/api/src/routes/notifications.ts` — routes CRUD notifications
- `apps/api/src/routes/invitations.ts` — routes invitations + autoJoinCommunitySpaces
- `apps/web/src/components/NotificationBell.tsx` — composant cloche + dropdown
- `packages/shared/src/types/notification.ts` — types, preferences par defaut
