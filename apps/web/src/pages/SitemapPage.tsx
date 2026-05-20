import { Link } from 'react-router-dom';
import { Globe, User, Shield, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../stores/auth';

interface SiteNode {
  label: string;
  description?: string;
  path?: string;
  component?: string;
  auth?: 'public' | 'authenticated' | 'admin';
  note?: string;
  children?: SiteNode[];
}

const SITE_TREE: SiteNode[] = [
  {
    label: 'Pages publiques', auth: 'public',
    description: 'Pages accessibles sans authentification',
    children: [
      { label: 'Accueil', path: '/', component: 'LandingPage', auth: 'public', note: 'Si non connecte',
        description: 'Page vitrine avec hero, communautes publiques en cartes, fonctionnalites et catalogue des vues' },
      { label: 'Connexion', path: '/login', component: 'LoginPage', auth: 'public',
        description: 'Formulaire email/mot de passe, lien mot de passe oublie' },
      { label: 'Inscription', path: '/register', component: 'RegisterPage', auth: 'public',
        description: 'Formulaire nom/email/mot de passe' },
      { label: 'Mot de passe oublie', path: '/forgot-password', component: 'ForgotPasswordPage', auth: 'public',
        description: 'Envoi d\'un email de reinitialisation' },
      { label: 'Reinitialiser le mot de passe', path: '/reset-password', component: 'ResetPasswordPage', auth: 'public',
        description: 'Formulaire nouveau mot de passe avec token' },
      { label: 'Verification email', path: '/verify-email', component: 'VerifyEmailPage', auth: 'public',
        description: 'Confirmation d\'adresse email via lien' },
      { label: 'Invitation', path: '/invitation', component: 'InvitationPage', auth: 'public',
        description: 'Acceptation d\'invitation a une communaute ou un espace' },
      { label: 'Contact', path: '/contact', component: 'ContactPage', auth: 'public',
        description: 'Formulaire de contact (question, bug, fonctionnalite, technique) transmis aux administrateurs' },
      { label: 'Plan du site', path: '/sitemap', component: 'SitemapPage', auth: 'public',
        description: 'Cette page — arborescence de toutes les pages' },
      { label: 'Communautes', path: '/communities', component: 'CommunitiesListPage', auth: 'public',
        description: 'Visiteur : communautes publiques. Connecte : les siennes + publiques non-rejointes' },
      { label: 'Page communaute', path: '/communities/:id', component: 'CommunityPage', auth: 'public', note: 'Si communaute publique',
        description: 'Detail d\'une communaute : description, espaces, membres' },
      { label: 'Presentation espace', path: '/spaces/:id/overview', component: 'SpaceOverviewPage', auth: 'public', note: 'Si espace non PRIVATE',
        description: 'Apercu d\'un espace : statistiques, membres, vues disponibles' },
      { label: 'Recherche', path: '/search', component: 'SearchPage', auth: 'public',
        description: 'Recherche avancee multi-types (communautes, espaces, items, contributions, utilisateurs)' },
    ],
  },
  {
    label: 'Pages utilisateur', auth: 'authenticated',
    description: 'Pages accessibles apres connexion',
    children: [
      { label: 'Accueil', path: '/', component: 'HomePage > HomeView', auth: 'authenticated',
        description: 'Communautes en cartes (bandeau cover, badge activite recente), espaces favoris et recents avec badge activite, assistant de demarrage pour les nouveaux' },
      { label: 'Communautes', path: '/communities', component: 'CommunitiesListPage', auth: 'authenticated',
        description: 'Grille de communautes avec cover, avatar, role, compteurs, communautes publiques a rejoindre, creation de communaute' },
      { label: 'Espaces', path: '/spaces', component: 'SpacesListPage', auth: 'authenticated', note: 'Redirige vers /communities si pas de communaute selectionnee',
        description: 'Grille d\'espaces groupes par communaute, creation avec templates, drag & drop hierarchie' },
      { label: 'Tableau de bord', path: '/dashboard', component: 'DashboardViewPage', auth: 'authenticated',
        description: 'KPIs, taches prioritaires/en retard, calendrier semaine/mois, distribution par statut et type, progression par espace' },
      { label: 'Graphe global', path: '/graph', component: 'GraphPage', auth: 'authenticated',
        description: 'Graphe interactif de relations entre tous les items, filtrage par type' },
      { label: 'Sunburst global', path: '/sunburst', component: 'SunburstPage', auth: 'authenticated',
        description: 'Hierarchie communautes > espaces > items en diagramme circulaire' },
      { label: 'Carte mentale globale', path: '/mindmap', component: 'MindMapPage', auth: 'authenticated',
        description: 'Arbre interactif de toute l\'organisation' },
      { label: 'Taches globales', path: '/tasks', component: 'GlobalTasksPage', auth: 'authenticated',
        description: 'Taches creees par ou assignees a l\'utilisateur, tous espaces confondus, filtrage par statut/type/priorite/espace' },
      { label: 'Liens globaux', path: '/links', component: 'GlobalLinksPage', auth: 'authenticated',
        description: 'Tous les items de type LINK accessibles par l\'utilisateur' },
    ],
  },
  {
    label: 'Communautes', auth: 'authenticated',
    description: 'Gestion des communautes',
    children: [
      { label: 'Page communaute', path: '/communities/:id', component: 'CommunityPage', auth: 'authenticated',
        description: 'Detail, espaces, membres, set la communaute courante pour la navigation' },
      { label: 'Parametres', path: '/communities/:id/settings', component: 'CommunitySettingsPage', auth: 'authenticated', note: 'OWNER uniquement',
        description: 'Nom, description, avatar, cover, visibilite, gestion des membres et espaces, envoi d\'emails' },
    ],
  },
  {
    label: 'Espaces', auth: 'authenticated',
    description: 'Espaces de travail',
    children: [
      { label: 'Presentation', path: '/spaces/:id/overview', component: 'SpaceOverviewPage', auth: 'authenticated',
        description: 'Apercu de l\'espace : stats, membres, vues disponibles. Accessible depuis la page d\'accueil et le menu principal' },
      {
        label: 'Contenu', path: '/spaces/:id', component: 'SpacePage', auth: 'authenticated',
        description: 'Espace de travail avec 23 vues disponibles',
        children: [
          { label: 'Basique', children: [
            { label: 'Liste', component: 'ListView', description: 'Tableau triable, edition inline, drag & drop' },
            { label: 'Arborescence', component: 'TreeView', description: 'Hierarchie parent-enfant depliable' },
            { label: 'Texte', component: 'TextView', description: 'Vue document avec editeur rich text TipTap' },
            { label: 'Kanban', component: 'KanbanView', description: 'Colonnes par statut, drag & drop' },
            { label: 'Recents', component: 'RecentChangesView', description: 'Items modifies recemment dans l\'espace' },
          ]},
          { label: 'Types d\'items', children: [
            { label: 'Types', component: 'TypesView', description: 'Items groupes par type en colonnes' },
            { label: 'Membres', component: 'MembersView', description: 'Items groupes par membre assigne' },
            { label: 'Priorites', component: 'PriorityView', description: 'Items groupes par niveau de priorite' },
            { label: 'Tableau croise', component: 'CrossTableView', description: 'Matrice configurable lignes/colonnes' },
          ]},
          { label: 'Planification', children: [
            { label: 'Planning', component: 'PlanningView', description: 'Vue planning par assignation' },
            { label: 'Gantt', component: 'TimelineView', description: 'Diagramme de Gantt avec dependances' },
            { label: 'Calendrier', component: 'CalendarView', description: 'Vue calendrier mensuelle' },
            { label: 'Burndown', component: 'BurndownView', description: 'Courbe burndown/burnup' },
            { label: 'Flux cumulatif', component: 'CfdView', description: 'Cumulative flow diagram' },
          ]},
          { label: 'Exploration', children: [
            { label: 'Carte mentale', component: 'MindMapView', description: 'Arbre radial interactif, reordonnancement par drag' },
            { label: 'Graphe', component: 'GraphView', description: 'Graphe de relations entre items' },
            { label: 'Sunburst', component: 'SunburstView', description: 'Hierarchie circulaire' },
            { label: 'Relations', component: 'RelationsView', description: 'Vue dediee aux relations entre items' },
            { label: 'Bulles', component: 'BubbleView', description: 'Visualisation en bulles proportionnelles' },
            { label: 'Arbre radial', component: 'RadialTreeView', description: 'Arbre en disposition radiale' },
            { label: 'Treemap', component: 'TreemapView', description: 'Repartition hierarchique en rectangles' },
            { label: 'Chord', component: 'ChordView', description: 'Diagramme de flux circulaire entre types' },
            { label: 'Heatmap', component: 'HeatmapView', description: 'Carte de chaleur temporelle de l\'activite' },
            { label: 'Reseau ego', component: 'EgoNetworkView', description: 'Graphe egocentrique autour d\'un item' },
          ]},
        ],
      },
      { label: 'Parametres', path: '/spaces/:id/settings', component: 'SpaceSettingsPage', auth: 'authenticated', note: 'OWNER uniquement',
        description: 'Nom, avatar, cover, visibilite, communaute, espace parent, membres, referentiels personnalises' },
      { label: 'Historique', path: '/spaces/:id/history', component: 'SpaceHistoryPage', auth: 'authenticated',
        description: 'Journal d\'audit : creations, modifications, suppressions, restauration' },
    ],
  },
  {
    label: 'Administration', auth: 'admin', path: '/admin',
    description: 'Console d\'administration (globalRole = ADMIN)',
    children: [
      { label: 'Utilisateurs', path: '/admin/users', component: 'UsersPage', auth: 'admin',
        description: 'Liste paginee, recherche, export CSV, creation, suppression, modification de role' },
      { label: 'Espaces', path: '/admin/spaces', component: 'SpacesPage', auth: 'admin',
        description: 'Liste paginee, filtres type/communaute, hierarchie, recherche, export CSV, suppression' },
      { label: 'Communautes', path: '/admin/communities', component: 'CommunitiesPage', auth: 'admin',
        description: 'Liste paginee, approbation des demandes de publication, recherche, export CSV' },
      { label: 'Statistiques', path: '/admin/stats', component: 'StatsPage', auth: 'admin',
        description: 'Totaux, courbes d\'activite, repartition par type, top espaces actifs' },
      { label: 'Journal d\'audit', path: '/admin/audit-logs', component: 'AuditLogsPage', auth: 'admin',
        description: 'Historique complet, filtres, regroupement par batch, restauration, purge' },
      { label: 'Diagnostics', path: '/admin/anomalies', component: 'AnomaliesPage', auth: 'admin',
        description: 'Detection d\'anomalies par categorie, tests d\'integrite BD' },
      { label: 'Vues (legacy)', path: '/admin/views', component: 'ViewsConfigPage', auth: 'admin',
        description: 'Configuration des vues et pages globales (ancien systeme appConfig)' },
      { label: 'Referentiels', path: '/admin/referentiels', component: 'ReferentielsPage', auth: 'admin',
        description: 'Statuts par defaut (ordre, couleur), types d\'items, espaces personnalises' },
      { label: 'Documentation API', path: '/admin/api-doc', component: 'ApiDocPage', auth: 'admin',
        description: 'Documentation des endpoints API, niveaux d\'authentification, logique d\'acces' },
    ],
  },
  {
    label: 'Composants transversaux', auth: 'admin',
    description: 'Elements d\'interface presents sur toutes les pages (visible en mode dev uniquement)',
    children: [
      { label: 'Sidebar', component: 'Layout (sidebar)', auth: 'authenticated',
        description: 'Communautes depliables (drag & drop reorder), espaces hierarchiques, favoris, recents. Masquee sur les pages auth et landing' },
      { label: 'Header', component: 'Layout (header)', auth: 'public',
        description: 'Header unique pour toutes les pages. Menu principal (MainMenu), recherche globale, notifications, profil utilisateur. Visiteur : boutons Connexion/S\'inscrire' },
      { label: 'Recherche globale', component: 'GlobalSearch', auth: 'public',
        description: 'Barre de recherche dans le header, resultats instantanes (items + contributions), lien vers recherche avancee. Fonctionne pour les visiteurs' },
      { label: 'Notifications', component: 'NotificationBell', auth: 'authenticated',
        description: 'Badge compteur, invitations en attente, accepter/refuser' },
      { label: 'Profil utilisateur', component: 'UserProfileModal', auth: 'authenticated',
        description: 'Nom, email, mot de passe, avatar, preferences de notification' },
      { label: 'Onboarding', component: 'WelcomeModal + tours guides', auth: 'authenticated',
        description: 'Modale de bienvenue, tours guides interactifs par vue' },
    ],
  },
];

const AUTH_BADGE = {
  public: { label: 'Public', icon: Globe, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30' },
  authenticated: { label: 'Connecte', icon: User, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  admin: { label: 'Admin', icon: Shield, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' },
};

function TreeNode({ node, level, isAuthenticated, isAdmin, isDev }: { node: SiteNode; level: number; isAuthenticated: boolean; isAdmin: boolean; isDev: boolean }) {
  if (node.auth === 'admin' && !isAdmin && !isDev) return null;
  if (node.auth === 'authenticated' && !isAuthenticated && !isDev) return null;

  const badge = node.auth ? AUTH_BADGE[node.auth] : null;
  const BadgeIcon = badge?.icon;
  const visibleChildren = node.children?.filter(c => {
    if (c.auth === 'admin' && !isAdmin && !isDev) return false;
    if (c.auth === 'authenticated' && !isAuthenticated && !isDev) return false;
    return true;
  });

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 hover:bg-accent/30 rounded-md px-2 transition-colors"
        style={{ paddingLeft: `${level * 24 + 8}px` }}
      >
        {level > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {node.path && !node.path.includes(':') ? (
              <Link to={node.path} className="text-sm font-medium hover:text-primary transition-colors">
                {node.label}
              </Link>
            ) : (
              <span className={`text-sm ${node.children ? 'font-semibold' : 'font-medium'}`}>{node.label}</span>
            )}

            {isDev && badge && BadgeIcon && (
              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${badge.bg} ${badge.color}`}>
                <BadgeIcon className="w-3 h-3" />
                {badge.label}
              </span>
            )}

            {isDev && node.note && (
              <span className="text-[10px] text-muted-foreground/70 italic">{node.note}</span>
            )}
          </div>
          {node.description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{node.description}</p>
          )}
        </div>

        {isDev && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {node.component && (
              <code className="text-[10px] text-muted-foreground font-mono">{node.component}</code>
            )}
            {node.path && (
              <code className="text-[10px] text-muted-foreground/60 font-mono">{node.path}</code>
            )}
          </div>
        )}
      </div>

      {visibleChildren && visibleChildren.length > 0 && (
        <div>
          {visibleChildren.map((child, i) => (
            <TreeNode key={child.path || `${child.label}-${i}`} node={child} level={level + 1} isAuthenticated={isAuthenticated} isAdmin={isAdmin} isDev={isDev} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SitemapPage() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = !!user;
  const isAdmin = user?.globalRole === 'ADMIN';
  const isDev = !import.meta.env.PROD || localStorage.getItem('devMode') === 'true';

  const visibleTree = SITE_TREE.filter(n => {
    if (n.auth === 'admin' && !isAdmin && !isDev) return false;
    if (n.auth === 'authenticated' && !isAuthenticated && !isDev) return false;
    return true;
  });

  return (
    <div className="flex-1 overflow-auto bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4">
        <div className="pb-4 pt-6 flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Plan du site</h1>
            <p className="text-sm text-muted-foreground">
              {isDev
                ? 'Architecture complete — composants, chemins et niveaux d\'acces'
                : 'Toutes les pages de SPOK'}
            </p>
          </div>
          {isDev && (
            <span className="ml-auto text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              DEV
            </span>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="border border-border rounded-xl overflow-hidden py-2">
          {visibleTree.map((node, i) => (
            <TreeNode key={node.path || `${node.label}-${i}`} node={node} level={0} isAuthenticated={isAuthenticated} isAdmin={isAdmin} isDev={isDev} />
          ))}
        </div>
      </div>
    </div>
  );
}
