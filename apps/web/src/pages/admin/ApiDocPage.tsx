export function ApiDocPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Documentation API</h1>
        <p className="text-sm text-muted-foreground mt-1">Architecture des endpoints, niveaux d'authentification et logique d'acces</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Derniere mise a jour : 20 mars 2026</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-6 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          Public (optionalAuthenticate)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          Utilisateur (authenticate)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          Admin (authenticateAdmin)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
          Aucune auth
        </span>
      </div>

      {/* Public endpoints */}
      <Section title="Endpoints publics" subtitle="Accessibles aux visiteurs non connectes. Si connecte, la reponse est enrichie avec les donnees de l'utilisateur.">
        <Row method="GET" path="/menu" auth="none" desc="Items de menu (table MenuItem)" />
        <Row method="GET" path="/config/views" auth="none" desc="Configuration des vues (legacy)" />
        <Row method="GET" path="/config/global-pages" auth="none" desc="Configuration des pages globales (legacy)" />
        <Row method="GET" path="/communities" auth="optional" desc="Visiteur : communautes publiques. Connecte : les siennes + publiques non-rejointes" />
        <Row method="GET" path="/communities/public" auth="optional" desc="Communautes publiques (redondant avec GET /communities)" />
        <Row method="GET" path="/communities/:id" auth="optional" desc="Detail d'une communaute (si publique ou membre)" />
        <Row method="GET" path="/communities/:id/tags" auth="optional" desc="Tags d'une communaute (si publique ou membre)" />
        <Row method="GET" path="/spaces" auth="optional" desc="Visiteur : espaces publics. Connecte : espaces accessibles" />
        <Row method="GET" path="/spaces/:id" auth="optional" desc="Detail d'un espace (si public ou membre)" />
        <Row method="GET" path="/spaces/:id/members" auth="optional" desc="Membres d'un espace (si public ou membre)" />
        <Row method="GET" path="/spaces/:id/items" auth="optional" desc="Items d'un espace (herite du parent, via checkSpaceAccess)" />
        <Row method="GET" path="/spaces/:id/items/:itemId" auth="optional" desc="Detail d'un item (herite du parent, via checkSpaceAccess)" />
        <Row method="GET" path="/spaces/:id/items/:itemId/contributions" auth="optional" desc="Contributions d'un item (herite du parent)" />
        <Row method="GET" path="/spaces/:id/tags" auth="optional" desc="Tags d'un espace (herite du parent)" />
        <Row method="GET" path="/spaces/:id/referentiels" auth="optional" desc="Referentiels d'un espace (herite du parent)" />
        <Row method="GET" path="/graph/spaces/:spaceId/graph" auth="optional" desc="Graphe d'un espace" />
        <Row method="GET" path="/graph/communities/:id/graph" auth="optional" desc="Graphe d'une communaute" />
        <Row method="GET" path="/graph/global" auth="optional" desc="Graphe global" />
        <Row method="GET" path="/graph/sunburst" auth="optional" desc="Sunburst global" />
        <Row method="GET" path="/search/advanced" auth="optional" desc="Recherche avancee multi-types" />
        <Row method="GET" path="/search" auth="optional" desc="Recherche basique (items + contributions)" />
        <Row method="GET" path="/invitations/:token" auth="none" desc="Detail d'une invitation par token" />
        <Row method="GET" path="/health" auth="none" desc="Health check" />
      </Section>

      {/* User endpoints - READ */}
      <Section title="Endpoints utilisateur (lecture)" subtitle="Necessitent une connexion. Donnees specifiques a l'utilisateur.">
        <Row method="GET" path="/auth/me" auth="user" desc="Profil de l'utilisateur connecte" />
        <Row method="GET" path="/user/preferences" auth="user" desc="Preferences utilisateur (theme, etc.)" />
        <Row method="GET" path="/user/notification-preferences" auth="user" desc="Preferences de notifications" />
        <Row method="GET" path="/user/tasks" auth="user" desc="Taches assignees a l'utilisateur" />
        <Row method="GET" path="/invitations/my" auth="user" desc="Invitations en attente de l'utilisateur" />
        <Row method="GET" path="/spaces/favorites" auth="user" desc="Espaces favoris de l'utilisateur" />
        <Row method="GET" path="/notifications/unread-count" auth="user" desc="Nombre de notifications non lues" />
        <Row method="GET" path="/notifications" auth="user" desc="Liste des notifications" />
      </Section>

      {/* User endpoints - WRITE */}
      <Section title="Endpoints utilisateur (ecriture)" subtitle="Actions necessitant une connexion.">
        <Row method="POST" path="/auth/login" auth="none" desc="Connexion" />
        <Row method="POST" path="/auth/register" auth="none" desc="Inscription" />
        <Row method="POST" path="/auth/refresh" auth="none" desc="Rafraichir le token" />
        <Row method="POST" path="/auth/logout" auth="none" desc="Deconnexion" />
        <Row method="POST" path="/auth/forgot-password" auth="none" desc="Demande de reinitialisation mot de passe" />
        <Row method="POST" path="/auth/reset-password" auth="none" desc="Reinitialisation mot de passe" />
        <Row method="POST" path="/auth/resend-verification" auth="user" desc="Renvoyer l'email de verification" />
        <Row method="PATCH" path="/user/preferences" auth="user" desc="Modifier preferences" />
        <Row method="PATCH" path="/user/profile" auth="user" desc="Modifier profil (nom, email)" />
        <Row method="PATCH" path="/user/password" auth="user" desc="Changer mot de passe" />
        <Row method="PATCH" path="/user/notification-preferences" auth="user" desc="Modifier preferences notifications" />
        <Row method="POST" path="/user/avatar" auth="user" desc="Upload avatar" />
        <Row method="DELETE" path="/user/avatar" auth="user" desc="Supprimer avatar" />
      </Section>

      {/* Communities - WRITE */}
      <Section title="Communautes (ecriture)" subtitle="Gestion des communautes — necessite une connexion.">
        <Row method="POST" path="/communities" auth="user" desc="Creer une communaute" />
        <Row method="PUT" path="/communities/reorder" auth="user" desc="Reordonner ses communautes" />
        <Row method="PUT" path="/communities/:id" auth="user" desc="Modifier une communaute (proprietaire)" />
        <Row method="DELETE" path="/communities/:id" auth="user" desc="Supprimer une communaute (proprietaire)" />
        <Row method="GET" path="/communities/:id/delete-preview" auth="user" desc="Apercu suppression (proprietaire)" />
        <Row method="POST" path="/communities/:id/join" auth="user" desc="Rejoindre une communaute publique" />
        <Row method="POST" path="/communities/:id/leave" auth="user" desc="Quitter une communaute" />
        <Row method="GET" path="/communities/:id/members" auth="user" desc="Liste des membres" />
        <Row method="GET" path="/communities/:id/available-users" auth="user" desc="Utilisateurs invitables" />
        <Row method="POST" path="/communities/:id/invite" auth="user" desc="Inviter un membre" />
        <Row method="PATCH" path="/communities/:id/members/:userId" auth="user" desc="Modifier role d'un membre" />
        <Row method="DELETE" path="/communities/:id/members/:userId" auth="user" desc="Retirer un membre" />
        <Row method="POST" path="/communities/:id/avatar" auth="user" desc="Upload avatar communaute" />
        <Row method="DELETE" path="/communities/:id/avatar" auth="user" desc="Supprimer avatar" />
        <Row method="POST" path="/communities/:id/cover" auth="user" desc="Upload couverture" />
        <Row method="DELETE" path="/communities/:id/cover" auth="user" desc="Supprimer couverture" />
        <Row method="GET" path="/communities/:id/emails" auth="user" desc="Historique emails" />
        <Row method="POST" path="/communities/:id/send-email" auth="user" desc="Envoyer email aux membres" />
      </Section>

      {/* Spaces - WRITE */}
      <Section title="Espaces (ecriture)" subtitle="Gestion des espaces — necessite une connexion.">
        <Row method="POST" path="/spaces" auth="user" desc="Creer un espace" />
        <Row method="PUT" path="/spaces/:id" auth="user" desc="Modifier un espace (proprietaire)" />
        <Row method="DELETE" path="/spaces/:id" auth="user" desc="Supprimer un espace (proprietaire)" />
        <Row method="GET" path="/spaces/:id/delete-preview" auth="user" desc="Apercu suppression" />
        <Row method="POST" path="/spaces/:id/join" auth="user" desc="Rejoindre un espace" />
        <Row method="POST" path="/spaces/:id/leave" auth="user" desc="Quitter un espace" />
        <Row method="GET" path="/spaces/:id/available-users" auth="user" desc="Utilisateurs invitables" />
        <Row method="GET" path="/spaces/:id/invitations" auth="user" desc="Invitations en attente" />
        <Row method="POST" path="/spaces/:id/invite" auth="user" desc="Inviter un membre" />
        <Row method="PATCH" path="/spaces/:id/members/:userId" auth="user" desc="Modifier role d'un membre" />
        <Row method="DELETE" path="/spaces/:id/members/:userId" auth="user" desc="Retirer un membre" />
        <Row method="POST" path="/spaces/:id/avatar" auth="user" desc="Upload avatar espace" />
        <Row method="DELETE" path="/spaces/:id/avatar" auth="user" desc="Supprimer avatar" />
        <Row method="POST" path="/spaces/:id/cover" auth="user" desc="Upload couverture" />
        <Row method="DELETE" path="/spaces/:id/cover" auth="user" desc="Supprimer couverture" />
        <Row method="POST" path="/spaces/favorites/:id" auth="user" desc="Ajouter aux favoris" />
        <Row method="DELETE" path="/spaces/favorites/:id" auth="user" desc="Retirer des favoris" />
      </Section>

      {/* Items - WRITE */}
      <Section title="Items (ecriture)" subtitle="CRUD des items dans un espace — necessite une connexion et l'acces a l'espace.">
        <Row method="POST" path="/spaces/:spaceId/items" auth="user" desc="Creer un item" />
        <Row method="PATCH" path="/spaces/:spaceId/items/:id" auth="user" desc="Modifier un item" />
        <Row method="DELETE" path="/spaces/:spaceId/items/:id" auth="user" desc="Supprimer un item" />
        <Row method="POST" path="/spaces/:spaceId/items/:id/contributions" auth="user" desc="Ajouter une contribution" />
        <Row method="PATCH" path="/spaces/:spaceId/items/:id/contributions/:cId" auth="user" desc="Modifier une contribution" />
        <Row method="DELETE" path="/spaces/:spaceId/items/:id/contributions/:cId" auth="user" desc="Supprimer une contribution" />
        <Row method="POST" path="/spaces/:spaceId/items/:id/reactions" auth="user" desc="Ajouter une reaction" />
        <Row method="DELETE" path="/spaces/:spaceId/items/:id/reactions" auth="user" desc="Retirer une reaction" />
        <Row method="POST" path="/spaces/:spaceId/tags" auth="user" desc="Creer un tag" />
        <Row method="PATCH" path="/spaces/:spaceId/tags/:id" auth="user" desc="Modifier un tag" />
        <Row method="DELETE" path="/spaces/:spaceId/tags/:id" auth="user" desc="Supprimer un tag" />
      </Section>

      {/* Admin */}
      <Section title="Administration" subtitle="Reservees aux administrateurs (globalRole = ADMIN).">
        <Row method="GET" path="/admin/users" auth="admin" desc="Liste des utilisateurs" />
        <Row method="GET" path="/admin/users/:id" auth="admin" desc="Detail utilisateur" />
        <Row method="PATCH" path="/admin/users/:id" auth="admin" desc="Modifier un utilisateur" />
        <Row method="DELETE" path="/admin/users/:id" auth="admin" desc="Supprimer un utilisateur" />
        <Row method="GET" path="/admin/spaces" auth="admin" desc="Liste des espaces" />
        <Row method="GET" path="/admin/spaces/:id" auth="admin" desc="Detail espace" />
        <Row method="GET" path="/admin/communities" auth="admin" desc="Liste des communautes" />
        <Row method="GET" path="/admin/communities/:id" auth="admin" desc="Detail communaute" />
        <Row method="PATCH" path="/admin/communities/:id/approve" auth="admin" desc="Approuver publication" />
        <Row method="PATCH" path="/admin/communities/:id/reject" auth="admin" desc="Rejeter publication" />
        <Row method="GET" path="/admin/stats" auth="admin" desc="Statistiques globales" />
        <Row method="GET" path="/admin/audit-logs" auth="admin" desc="Logs d'audit" />
        <Row method="GET" path="/admin/anomalies" auth="admin" desc="Diagnostics et anomalies" />
        <Row method="GET" path="/admin/menu" auth="admin" desc="Configuration des menus" />
        <Row method="PUT" path="/admin/menu" auth="admin" desc="Modifier les menus" />
        <Row method="POST" path="/admin/menu/reset" auth="admin" desc="Reinitialiser les menus" />
        <Row method="GET" path="/admin/referentiels" auth="admin" desc="Referentiels globaux" />
        <Row method="GET" path="/admin/config/views" auth="admin" desc="Config vues (legacy)" />
        <Row method="GET" path="/admin/config/global-pages" auth="admin" desc="Config pages (legacy)" />
      </Section>
    </div>
  );
}

// ── Sub-components ──

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-0.5">{title}</h2>
      <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>
      <div className="bg-card border rounded-lg divide-y divide-border text-sm">
        {children}
      </div>
    </div>
  );
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  POST: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  PUT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  PATCH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const AUTH_DOTS: Record<string, string> = {
  none: 'bg-gray-400',
  optional: 'bg-green-500',
  user: 'bg-blue-500',
  admin: 'bg-red-500',
};

function Row({ method, path, auth, desc }: { method: string; path: string; auth: 'none' | 'optional' | 'user' | 'admin'; desc: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${METHOD_COLORS[method] || ''} w-14 text-center flex-shrink-0`}>
        {method}
      </span>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${AUTH_DOTS[auth]}`} title={auth} />
      <code className="text-xs font-mono text-foreground/80 w-72 flex-shrink-0 truncate" title={path}>{path}</code>
      <span className="text-xs text-muted-foreground truncate">{desc}</span>
    </div>
  );
}
