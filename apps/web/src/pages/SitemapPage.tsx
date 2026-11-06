/*
 * Plan du site (/sitemap), accessible sans connexion. Deux blocs :
 * - Contenu public : communautés non privées et leurs espaces publics, chargés de l'API (GET /communities puis
 *   GET /spaces?communityId=), filtrés par lib/publicSiteTree.ts — même contenu pour tous, jamais d'espace privé ;
 * - Pages et vues : SITE_PAGES, écrit à la main ici — toute nouvelle route d'App.tsx s'y ajoute.
 *   Les vues d'espace ne s'écrivent pas ici : elles viennent de useMenuItems (VIEW_REGISTRY, droits et réglages de
 *   /admin/views compris) et de l'accroche de leur fiche d'aide (VIEW_HELP.short).
 * En mode développement (isDev), chaque ligne affiche aussi son composant, son chemin et son niveau d'accès.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Globe, User, Shield, ChevronRight } from 'lucide-react';
import type { MenuSection } from '@spok/shared';
import { useAuthStore } from '../stores/auth';
import { useMenuItems } from '../hooks/useMenuItems';
import { communitiesApi, spacesApi } from '../lib/api';
import { buildPublicSpaceTree, isPublicVisibility, type PublicSpaceNode } from '../lib/publicSiteTree';
import { VIEW_HELP } from '../components/views/help';
import { PageHelpButton } from '../help/PageHelpButton';
import { PAGE_HELP } from '../help/pageHelp';
import type { ViewMode } from '../stores/viewMode';

interface SiteNode {
  label: string;
  description?: string;
  path?: string;
  component?: string;
  auth?: 'public' | 'authenticated' | 'admin';
  note?: string;
  children?: SiteNode[];
}

/** Arborescence des pages ; les vues d'espace (viewNodes) sont insérées sous « Contenu ». */
function buildSitePages(viewNodes: SiteNode[], viewCount: number): SiteNode[] {
  return [
    {
      label: 'Pages publiques', auth: 'public',
      description: 'Pages accessibles sans connexion',
      children: [
        { label: 'Accueil', path: '/', component: 'LandingPage', auth: 'public', note: 'Si non connecté',
          description: 'Page vitrine : présentation, communautés publiques, fonctionnalités et catalogue des vues' },
        { label: 'Connexion', path: '/login', component: 'LoginPage', auth: 'public',
          description: 'Formulaire e-mail et mot de passe, lien « mot de passe oublié »' },
        { label: 'Inscription', path: '/register', component: 'RegisterPage', auth: 'public',
          description: 'Formulaire nom, e-mail et mot de passe' },
        { label: 'Mot de passe oublié', path: '/forgot-password', component: 'ForgotPasswordPage', auth: 'public',
          description: 'Envoi d\'un e-mail de réinitialisation' },
        { label: 'Réinitialiser le mot de passe', path: '/reset-password', component: 'ResetPasswordPage', auth: 'public',
          description: 'Choix d\'un nouveau mot de passe depuis le lien reçu' },
        { label: 'Vérification de l\'e-mail', path: '/verify-email', component: 'VerifyEmailPage', auth: 'public',
          description: 'Confirmation de l\'adresse e-mail depuis le lien reçu' },
        { label: 'Invitation', path: '/invitation', component: 'InvitationPage', auth: 'public',
          description: 'Acceptation d\'une invitation à une communauté ou un espace' },
        { label: 'Contact', path: '/contact', component: 'ContactPage', auth: 'public',
          description: 'Formulaire de contact (question, bug, fonctionnalité, technique) transmis aux administrateurs' },
        { label: 'Plan du site', path: '/sitemap', component: 'SitemapPage', auth: 'public',
          description: 'Cette page' },
        { label: 'Communautés', path: '/communities', component: 'CommunitiesListPage', auth: 'public',
          description: 'Visiteur : communautés publiques. Connecté : les siennes et les publiques à rejoindre' },
        { label: 'Page d\'une communauté', path: '/communities/:id', component: 'CommunityPage', auth: 'public', note: 'Si communauté publique',
          description: 'Description, espaces et membres d\'une communauté' },
        { label: 'Présentation d\'un espace', path: '/spaces/:id/overview', component: 'SpaceOverviewPage', auth: 'public', note: 'Si espace non privé',
          description: 'Aperçu d\'un espace : statistiques, membres, vues disponibles' },
        { label: 'Lecture d\'un article', path: '/spaces/:id/articles/:itemId', component: 'ArticlePage', auth: 'public', note: 'Si espace non privé',
          description: 'Page qui assemble, dans l\'ordre choisi, des éléments existants : notes, images, schémas, liens' },
        { label: 'Recherche', path: '/search', component: 'SearchPage', auth: 'public',
          description: 'Recherche avancée : communautés, espaces, éléments, contributions, utilisateurs' },
      ],
    },
    {
      label: 'Pages utilisateur', auth: 'authenticated',
      description: 'Pages accessibles après connexion',
      children: [
        { label: 'Accueil', path: '/', component: 'HomePage > HomeView', auth: 'authenticated',
          description: 'Communautés en cartes, espaces favoris et récents, assistant de démarrage pour les nouveaux' },
        { label: 'Ma journée', path: '/today', component: 'TodayPage', auth: 'authenticated',
          description: 'Votre journée sur une page : vos agendas, votre liste du jour et les éléments à revoir' },
        { label: 'Tableau de bord', path: '/dashboard', component: 'DashboardViewPage', auth: 'authenticated',
          description: 'Indicateurs, tâches prioritaires et en retard, calendrier, répartition par statut et par type, progression par espace' },
        { label: 'Tâches', path: '/tasks', component: 'GlobalTasksPage', auth: 'authenticated',
          description: 'Tâches créées par vous ou qui vous sont assignées, tous espaces confondus' },
        { label: 'Activité', path: '/activity', component: 'ActivityPage', auth: 'authenticated',
          description: 'Éléments modifiés par d\'autres que vous n\'avez pas encore vus, par communauté et par espace' },
        { label: 'Favoris et épingles', path: '/bookmarks', component: 'BookmarksPage', auth: 'authenticated',
          description: 'Vos espaces favoris, vos espaces récents et les éléments épinglés' },
        { label: 'Espaces', path: '/spaces', component: 'SpacesListPage', auth: 'authenticated', note: 'Redirige vers /communities si aucune communauté n\'est sélectionnée',
          description: 'Espaces groupés par communauté, création depuis un modèle, hiérarchie par glisser-déposer' },
        { label: 'Graphe global', path: '/graph', component: 'GraphPage', auth: 'authenticated',
          description: 'Graphe interactif des relations entre tous les éléments' },
        { label: 'Sunburst global', path: '/sunburst', component: 'SunburstPage', auth: 'authenticated',
          description: 'Hiérarchie communautés, espaces et éléments en diagramme circulaire' },
        { label: 'Carte mentale globale', path: '/mindmap', component: 'MindMapPage', auth: 'authenticated',
          description: 'Arbre interactif de toute l\'organisation' },
        { label: 'Liens', path: '/links', component: 'GlobalLinksPage', auth: 'authenticated',
          description: 'Tous les éléments de type lien auxquels vous avez accès' },
      ],
    },
    {
      label: 'Communautés', auth: 'authenticated',
      description: 'Gestion des communautés',
      children: [
        { label: 'Page d\'une communauté', path: '/communities/:id', component: 'CommunityPage', auth: 'authenticated',
          description: 'Détail, espaces et membres ; en fait la communauté courante pour la navigation' },
        { label: 'Paramètres', path: '/communities/:id/settings', component: 'CommunitySettingsPage', auth: 'authenticated', note: 'Propriétaire ou mode admin',
          description: 'Nom, description, avatar, couverture, visibilité, membres, espaces, envoi d\'e-mails' },
      ],
    },
    {
      label: 'Espaces', auth: 'authenticated',
      description: 'Espaces de travail',
      children: [
        { label: 'Présentation', path: '/spaces/:id/overview', component: 'SpaceOverviewPage', auth: 'authenticated',
          description: 'Aperçu de l\'espace : statistiques, membres, vues disponibles' },
        {
          label: 'Contenu', path: '/spaces/:id', component: 'SpacePage', auth: 'authenticated',
          description: `Espace de travail avec ${viewCount} vues disponibles`,
          children: viewNodes,
        },
        { label: 'Paramètres', path: '/spaces/:id/settings', component: 'SpaceSettingsPage', auth: 'authenticated', note: 'Propriétaire ou mode admin',
          description: 'Nom, avatar, couverture, visibilité, communauté, espace parent, membres, référentiels' },
        { label: 'Historique', path: '/spaces/:id/history', component: 'SpaceHistoryPage', auth: 'admin', note: 'Mode admin',
          description: 'Journal des créations, modifications et suppressions, avec restauration' },
      ],
    },
    {
      label: 'Administration', auth: 'admin', path: '/admin',
      description: 'Console d\'administration, réservée aux administrateurs',
      children: [
        { label: 'Utilisateurs', path: '/admin/users', component: 'UsersPage', auth: 'admin',
          description: 'Liste, recherche, export CSV, création, suppression, modification du rôle' },
        { label: 'Accès d\'un utilisateur', path: '/admin/users/:id/access', component: 'UserAccessPage', auth: 'admin',
          description: 'Pour un compte, toutes les communautés et leurs espaces, avec l\'accès qu\'il a et celui qu\'il pourrait avoir' },
        { label: 'Espaces', path: '/admin/spaces', component: 'SpacesPage', auth: 'admin',
          description: 'Liste, filtres, hiérarchie, recherche, export CSV, suppression' },
        { label: 'Communautés', path: '/admin/communities', component: 'CommunitiesPage', auth: 'admin',
          description: 'Liste, validation des demandes de publication, recherche, export CSV' },
        { label: 'Statistiques', path: '/admin/stats', component: 'StatsPage', auth: 'admin',
          description: 'Totaux, courbes d\'activité, répartition par type, espaces les plus actifs' },
        { label: 'Journal d\'audit', path: '/admin/audit-logs', component: 'AuditLogsPage', auth: 'admin',
          description: 'Historique complet, filtres, regroupement par lot, restauration, purge' },
        { label: 'Diagnostics', path: '/admin/anomalies', component: 'AnomaliesPage', auth: 'admin',
          description: 'Détection d\'anomalies par catégorie, contrôles d\'intégrité de la base' },
        { label: 'Doublons', path: '/admin/duplicates', component: 'DuplicatesPage', auth: 'admin',
          description: 'Éléments en double dans tout SPOK : même titre, même adresse ou même nom de fichier' },
        { label: 'Vues', path: '/admin/views', component: 'ViewsConfigPage', auth: 'admin',
          description: 'Qui voit quelles pages globales et quelles vues d\'espace : masquer une entrée ou changer son accès' },
        { label: 'Référentiels', path: '/admin/referentiels', component: 'ReferentielsPage', auth: 'admin',
          description: 'Statuts et types d\'éléments par défaut, et communautés qui les ont personnalisés' },
        { label: 'Documentation API', path: '/admin/api-doc', component: 'ApiDocPage', auth: 'admin',
          description: 'Points d\'accès de l\'API, niveaux d\'authentification, logique d\'accès' },
        { label: 'Performances', path: '/admin/perf', component: 'PerfPage', auth: 'admin',
          description: 'Requêtes récentes de l\'API : temps de réponse, taille, points d\'accès les plus lents' },
      ],
    },
    {
      label: 'Composants transversaux', auth: 'admin',
      description: 'Éléments d\'interface présents sur toutes les pages',
      children: [
        { label: 'Barre latérale', component: 'Layout (sidebar)', auth: 'authenticated',
          description: 'Communautés dépliables, espaces en hiérarchie, favoris, récents. Masquée sur les pages d\'authentification et la page vitrine' },
        { label: 'En-tête', component: 'Layout (header) + GlobalNavBar', auth: 'public',
          description: 'Bandeau de navigation, recherche globale, notifications, profil. Visiteur : boutons Connexion et Inscription' },
        { label: 'Recherche globale', component: 'GlobalSearch', auth: 'public',
          description: 'Résultats instantanés (éléments et contributions), lien vers la recherche avancée. Fonctionne pour les visiteurs' },
        { label: 'Notifications', component: 'NotificationBell', auth: 'authenticated',
          description: 'Compteur, invitations en attente, accepter ou refuser' },
        { label: 'Profil utilisateur', component: 'UserProfileModal', auth: 'authenticated',
          description: 'Nom, e-mail, mot de passe, avatar, préférences de notification' },
        { label: 'Aide et démarrage', component: 'WelcomeModal + tours guidés', auth: 'authenticated',
          description: 'Modale de bienvenue, tours guidés et mode Aide (Maj+?)' },
      ],
    },
  ];
}

/** Vues d'espace par section, d'après le menu de l'utilisateur courant. */
function buildViewNodes(sections: MenuSection[]): SiteNode[] {
  return sections.map((section) => ({
    label: section.label,
    children: section.items.map((view) => ({
      label: view.label,
      component: view.viewMode ?? undefined,
      description: VIEW_HELP[view.viewMode as ViewMode]?.short,
    })),
  }));
}

function spaceToSiteNode(space: PublicSpaceNode): SiteNode {
  return {
    label: space.name,
    path: `/spaces/${space.id}/overview`,
    children: space.children.map(spaceToSiteNode),
  };
}

const AUTH_BADGE = {
  public: { label: 'Public', icon: Globe, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30' },
  authenticated: { label: 'Connecté', icon: User, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
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
  const { spaceViewSections } = useMenuItems();

  const { data: communities, isLoading, isError } = useQuery({
    queryKey: ['communities'],
    queryFn: () => communitiesApi.list(),
  });
  const publicCommunities = useMemo(
    () => (communities ?? []).filter((c) => isPublicVisibility(c.visibility)).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [communities],
  );
  const spaceQueries = useQueries({
    queries: publicCommunities.map((c) => ({
      queryKey: ['spaces', c.id],
      queryFn: () => spacesApi.list(c.id),
    })),
  });

  const publicNodes: SiteNode[] = publicCommunities.map((community, i) => ({
    label: community.name,
    path: `/communities/${community.id}`,
    description: community.description ?? undefined,
    children: buildPublicSpaceTree(spaceQueries[i]?.data ?? [], community.visibility).map(spaceToSiteNode),
  }));

  const viewNodes = buildViewNodes(spaceViewSections);
  const viewCount = spaceViewSections.reduce((total, section) => total + section.items.length, 0);
  const visibleTree = buildSitePages(viewNodes, viewCount).filter(n => {
    if (n.auth === 'admin' && !isAdmin && !isDev) return false;
    if (n.auth === 'authenticated' && !isAuthenticated && !isDev) return false;
    return true;
  });

  return (
    <div className="flex-1 overflow-auto bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4">
        <div className="pb-4 pt-6 flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Plan du site</h1>
              <PageHelpButton pageKey="sitemap" />
            </div>
            <p className="text-sm text-muted-foreground">
              {isDev
                ? 'Architecture complète : composants, chemins et niveaux d\'accès'
                : 'Le contenu public et toutes les pages de SPOK'}
            </p>
          </div>
          {isDev && (
            <span className="ml-auto text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              DEV
            </span>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        <section data-tour="sitemap-public">
          <h2 className="text-sm font-semibold mb-2">Communautés et espaces publics</h2>
          <div className="border border-border rounded-xl overflow-hidden py-2">
            {isLoading && <p className="px-4 py-2 text-sm text-muted-foreground">Chargement…</p>}
            {isError && <p className="px-4 py-2 text-sm text-destructive">Impossible de charger les communautés publiques.</p>}
            {!isLoading && !isError && publicNodes.length === 0 && (
              <p className="px-4 py-2 text-sm text-muted-foreground">{PAGE_HELP.sitemap.empty}</p>
            )}
            {publicNodes.map((node) => (
              <TreeNode key={node.path} node={node} level={0} isAuthenticated={isAuthenticated} isAdmin={isAdmin} isDev={isDev} />
            ))}
          </div>
        </section>

        <section data-tour="sitemap-pages">
          <h2 className="text-sm font-semibold mb-2">Pages et vues</h2>
          <div className="border border-border rounded-xl overflow-hidden py-2">
            {visibleTree.map((node, i) => (
              <TreeNode key={node.path || `${node.label}-${i}`} node={node} level={0} isAuthenticated={isAuthenticated} isAdmin={isAdmin} isDev={isDev} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
