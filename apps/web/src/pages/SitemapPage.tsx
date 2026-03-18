import { Link } from 'react-router-dom';
import { Globe, User, Shield, ChevronRight } from 'lucide-react';
import { PublicHeader } from '../components/PublicHeader';
import { PublicFooter } from '../components/PublicFooter';

const isDev = !import.meta.env.PROD || localStorage.getItem('devMode') === 'true';

interface SiteNode {
  label: string;
  path?: string;
  component?: string;
  auth?: 'public' | 'authenticated' | 'admin';
  children?: SiteNode[];
}

const SITE_TREE: SiteNode[] = [
  {
    label: 'Accueil', path: '/', component: 'LandingPage', auth: 'public',
    children: [
      { label: 'Connexion', path: '/login', component: 'LoginPage', auth: 'public' },
      { label: 'Inscription', path: '/register', component: 'RegisterPage', auth: 'public' },
      { label: 'Mot de passe oublié', path: '/forgot-password', component: 'ForgotPasswordPage', auth: 'public' },
      { label: 'Réinitialiser le mot de passe', path: '/reset-password', component: 'ResetPasswordPage', auth: 'public' },
      { label: 'Vérification email', path: '/verify-email', component: 'VerifyEmailPage', auth: 'public' },
      { label: 'Invitation', path: '/invitation', component: 'InvitationPage', auth: 'public' },
      { label: 'Plan du site', path: '/sitemap', component: 'SitemapPage', auth: 'public' },
    ],
  },
  {
    label: 'Tableau de bord', path: '/dashboard', component: 'DashboardPage', auth: 'authenticated',
    children: [
      { label: 'Mes tâches', path: '/tasks', component: 'GlobalTasksPage', auth: 'authenticated' },
    ],
  },
  {
    label: 'Communautés',
    children: [
      { label: 'Page communauté', path: '/communities/:id', component: 'CommunityPage', auth: 'public' },
      { label: 'Paramètres communauté', path: '/communities/:id/settings', component: 'CommunitySettingsPage', auth: 'authenticated' },
    ],
  },
  {
    label: 'Espaces',
    children: [
      { label: 'Présentation', path: '/spaces/:id', component: 'SpaceOverviewPage', auth: 'public' },
      { label: 'Contenu (vues)', path: '/spaces/:id/content', component: 'SpacePage', auth: 'authenticated' },
      { label: 'Paramètres', path: '/spaces/:id/settings', component: 'SpaceSettingsPage', auth: 'authenticated' },
      { label: 'Historique', path: '/spaces/:id/history', component: 'SpaceHistoryPage', auth: 'authenticated' },
    ],
  },
  {
    label: 'Administration', auth: 'admin',
    children: [
      { label: 'Utilisateurs', path: '/admin/users', component: 'UsersPage', auth: 'admin' },
      { label: 'Espaces', path: '/admin/spaces', component: 'SpacesPage', auth: 'admin' },
      { label: 'Communautés', path: '/admin/communities', component: 'CommunitiesPage', auth: 'admin' },
      { label: 'Anomalies', path: '/admin/anomalies', component: 'AnomaliesPage', auth: 'admin' },
      { label: 'Référentiels', path: '/admin/referentiels', component: 'ReferentielsPage', auth: 'admin' },
      { label: 'Statistiques', path: '/admin/stats', component: 'StatsPage', auth: 'admin' },
      { label: 'Journal d\'audit', path: '/admin/audit-logs', component: 'AuditLogsPage', auth: 'admin' },
      { label: 'Configuration des vues', path: '/admin/views', component: 'ViewsConfigPage', auth: 'admin' },
    ],
  },
];

const AUTH_BADGE = {
  public: { label: 'Public', icon: Globe, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30' },
  authenticated: { label: 'Connecté', icon: User, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  admin: { label: 'Admin', icon: Shield, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' },
};

function TreeNode({ node, level }: { node: SiteNode; level: number }) {
  // Hide admin nodes in prod
  if (!isDev && node.auth === 'admin') return null;

  const badge = node.auth ? AUTH_BADGE[node.auth] : null;
  const BadgeIcon = badge?.icon;
  const visibleChildren = node.children?.filter(c => isDev || c.auth !== 'admin');

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 hover:bg-accent/30 rounded-md px-2 transition-colors"
        style={{ paddingLeft: `${level * 24 + 8}px` }}
      >
        {level > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}

        <div className="flex-1 min-w-0 flex items-center gap-2">
          {node.path ? (
            <Link to={node.path.includes(':') ? '#' : node.path} className="text-sm font-medium hover:text-primary transition-colors">
              {node.label}
            </Link>
          ) : (
            <span className="text-sm font-semibold">{node.label}</span>
          )}

          {isDev && badge && BadgeIcon && (
            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${badge.bg} ${badge.color}`}>
              <BadgeIcon className="w-3 h-3" />
              {badge.label}
            </span>
          )}
        </div>

        {isDev && node.component && (
          <code className="text-[10px] text-muted-foreground font-mono flex-shrink-0">{node.component}</code>
        )}
        {isDev && node.path && (
          <code className="text-[10px] text-muted-foreground/60 font-mono flex-shrink-0">{node.path}</code>
        )}
      </div>

      {visibleChildren && visibleChildren.length > 0 && (
        <div>
          {visibleChildren.map((child, i) => (
            <TreeNode key={child.path || `${child.label}-${i}`} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SitemapPage() {
  const visibleTree = SITE_TREE.filter(n => isDev || n.auth !== 'admin');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader maxWidth="max-w-4xl" showBack />

      <div className="mx-auto max-w-4xl px-4">
        <div className="pb-4 pt-6 flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Plan du site</h1>
            <p className="text-sm text-muted-foreground">
              {isDev
                ? 'Architecture complète — composants, chemins et niveaux d\'accès'
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
            <TreeNode key={node.path || `${node.label}-${i}`} node={node} level={0} />
          ))}
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
