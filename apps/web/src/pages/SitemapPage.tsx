import { Link } from 'react-router-dom';
import { Globe, User, Shield, ChevronRight } from 'lucide-react';
import { PublicHeader } from '../components/PublicHeader';
import { PublicFooter } from '../components/PublicFooter';
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
      { label: 'Accueil', path: '/', component: 'LandingPage', auth: 'public', note: 'Redirect vers Dashboard si connecte',
        description: 'Page vitrine avec hero, communautes publiques, fonctionnalites cles et catalogue des vues disponibles' },
      { label: 'Connexion', path: '/login', component: 'LoginPage', auth: 'public',
        description: 'Formulaire email/mot de passe, toggle mode dev, lien mot de passe oublie' },
      { label: 'Inscription', path: '/register', component: 'RegisterPage', auth: 'public',
        description: 'Formulaire nom/email/mot de passe, creation de compte avec espace personnel automatique' },
      { label: 'Mot de passe oublie', path: '/forgot-password', component: 'ForgotPasswordPage', auth: 'public',
        description: 'Envoi d\'un email de reinitialisation via Resend' },
      { label: 'Reinitialiser le mot de passe', path: '/reset-password', component: 'ResetPasswordPage', auth: 'public',
        description: 'Formulaire nouveau mot de passe avec token de validation' },
      { label: 'Verification email', path: '/verify-email', component: 'VerifyEmailPage', auth: 'public',
        description: 'Confirmation d\'adresse email via lien envoye par mail' },
      { label: 'Invitation', path: '/invitation', component: 'InvitationPage', auth: 'public',
        description: 'Acceptation d\'invitation a une communaute ou un espace via token' },
      { label: 'Plan du site', path: '/sitemap', component: 'SitemapPage', auth: 'public',
        description: 'Cette page — arborescence de toutes les pages, filtree selon le niveau d\'acces' },
      { label: 'Page communaute', path: '/communities/:id', component: 'CommunityPage', auth: 'public', note: 'Si communaute publique',
        description: 'Presentation d\'une communaute publique : description, membres, espaces, bouton rejoindre' },
      { label: 'Presentation espace', path: '/spaces/:id', component: 'SpaceOverviewPage', auth: 'public', note: 'Si espace non PRIVATE',
        description: 'Apercu d\'un espace : description, statistiques, membres, arborescence des items' },
    ],
  },
  {
    label: 'Dashboard', path: '/', component: 'DashboardPage', auth: 'authenticated',
    description: 'Page principale apres connexion, avec onglets de navigation dans la toolbar',
    children: [
      { label: 'Accueil', component: 'HomeView', auth: 'authenticated',
        description: 'Bienvenue personnalisee, resume des communautes (cover, avatar, espaces depliables), espaces personnels, assistant de demarrage pour les nouveaux' },
      { label: 'Communautes', component: 'CommunityListView', auth: 'authenticated',
        description: 'Mes communautes avec stats (membres, espaces, role), communautes publiques a rejoindre avec cartes enrichies (cover, avatar), creation de communaute' },
      { label: 'Espaces', component: 'DashboardPage (spaces)', auth: 'authenticated',
        description: 'Grille de tous les espaces groupes par communaute, drag & drop pour reorganiser la hierarchie, creation avec templates (projet, kanban, wiki, etc.), rejoindre/quitter' },
      { label: 'Tableau de bord', component: 'MyOrganizationView', auth: 'authenticated',
        description: 'KPIs (retard, en cours, a valider), taches prioritaires/en retard/du jour, calendrier semaine et mois, distribution par statut et type, progression par espace, echeances' },
      { label: 'Graphe global', component: 'GraphView', auth: 'authenticated',
        description: 'Visualisation interactive du graphe de relations entre tous les items, navigation par clic, filtrage par type' },
      { label: 'Sunburst', component: 'SunburstView', auth: 'authenticated',
        description: 'Diagramme en rayons de soleil : hierarchie communautes > espaces > items, proportionnel au nombre d\'elements' },
      { label: 'Carte mentale', component: 'DashboardMindMapView', auth: 'authenticated',
        description: 'Vue mind-map de toute l\'organisation : communautes, espaces et sous-espaces en arbre interactif, drag & drop pour reorganiser' },
    ],
  },
  {
    label: 'Taches globales', path: '/tasks', component: 'GlobalTasksPage', auth: 'authenticated',
    description: 'Liste paginee de toutes les taches de l\'utilisateur tous espaces confondus, filtrage par statut/type/priorite, tri par date',
  },
  {
    label: 'Communautes', auth: 'authenticated',
    description: 'Gestion des communautes dont l\'utilisateur est membre',
    children: [
      { label: 'Page communaute', path: '/communities/:id', component: 'CommunityPage', auth: 'authenticated',
        description: 'Detail d\'une communaute : description, liste des espaces, membres, demande de publication publique' },
      { label: 'Parametres communaute', path: '/communities/:id/settings', component: 'CommunitySettingsPage', auth: 'authenticated', note: 'OWNER uniquement',
        description: 'Nom, description, avatar, cover, visibilite (publique/privee), gestion des membres (inviter, roles, retirer), gestion des espaces (creer, deplacer, supprimer)' },
    ],
  },
  {
    label: 'Espaces', auth: 'authenticated',
    description: 'Espaces de travail individuels ou collaboratifs',
    children: [
      { label: 'Presentation', path: '/spaces/:id', component: 'SpaceOverviewPage', auth: 'authenticated',
        description: 'Apercu de l\'espace : statistiques, derniere activite, arborescence des items, membres, lien vers le contenu' },
      {
        label: 'Contenu', path: '/spaces/:id/content', component: 'SpacePage', auth: 'authenticated',
        description: 'Espace de travail principal avec barre d\'outils, filtres, et selecteur de vue',
        children: [
          { label: 'Liste', component: 'ListView', auth: 'authenticated',
            description: 'Tableau triable avec colonnes (titre, type, statut, priorite, dates, tags), edition inline, drag & drop pour reordonner' },
          { label: 'Kanban', component: 'KanbanView', auth: 'authenticated',
            description: 'Colonnes par statut, drag & drop entre colonnes, creation rapide, regroupement par type ou priorite' },
          { label: 'Timeline (Gantt)', component: 'TimelineView', auth: 'authenticated',
            description: 'Diagramme de Gantt avec barres de duree, dependances, zoom jour/semaine/mois, deplacement par glisser' },
          { label: 'Carte mentale', component: 'MindMapView', auth: 'authenticated',
            description: 'Arbre hierarchique des items parent-enfant, niveaux depliables, couleurs par type' },
          { label: 'Sequence', component: 'SequenceView', auth: 'authenticated',
            description: 'Vue sequentielle des items tries par date, regroupes par periode (jour/semaine/mois)' },
          { label: 'Graphe', component: 'GraphView', auth: 'authenticated',
            description: 'Graphe de relations entre items de l\'espace, noeuds cliquables, filtrage par type de relation' },
          { label: 'Sunburst', component: 'SunburstView', auth: 'authenticated',
            description: 'Diagramme circulaire hierarchique des items de l\'espace' },
        ],
      },
      { label: 'Parametres', path: '/spaces/:id/settings', component: 'SpaceSettingsPage', auth: 'authenticated', note: 'OWNER uniquement',
        description: 'Nom, avatar, cover, visibilite (OPEN/READONLY/PRIVATE), communaute, espace parent, membres, statuts et types personnalises, suppression' },
      { label: 'Historique', path: '/spaces/:id/history', component: 'SpaceHistoryPage', auth: 'authenticated',
        description: 'Journal chronologique de toutes les modifications de l\'espace : creations, modifications, suppressions, avec possibilite de restauration' },
    ],
  },
  {
    label: 'Administration', auth: 'admin', path: '/admin',
    description: 'Console d\'administration reservee aux administrateurs globaux',
    children: [
      { label: 'Utilisateurs', path: '/admin/users', component: 'UsersPage', auth: 'admin',
        description: 'Liste paginee de tous les utilisateurs avec avatar, email verifie, role, nombre de communautes/espaces/items, recherche, export CSV, creation, suppression' },
      { label: 'Espaces', path: '/admin/spaces', component: 'SpacesPage', auth: 'admin',
        description: 'Liste paginee de tous les espaces avec filtre type (groupe/personnel), communaute, proprietaire, hierarchie parent, recherche, export CSV, suppression' },
      { label: 'Communautes', path: '/admin/communities', component: 'CommunitiesPage', auth: 'admin',
        description: 'Liste paginee avec visibilite, membres, espaces, approbation des demandes de publication publique, recherche, export CSV, creation, suppression' },
      { label: 'Diagnostics', path: '/admin/anomalies', component: 'AnomaliesPage', auth: 'admin',
        description: 'Onglet Anomalies : detection par categorie (items, espaces, contributions, relations) avec severite et detail paginable. Onglet Tests : suite de tests d\'integrite BD et coherence metier' },
      { label: 'Referentiels', path: '/admin/referentiels', component: 'ReferentielsPage', auth: 'admin',
        description: 'Statuts par defaut (ordre, couleur, visibilite), types d\'items par defaut, liste des espaces ayant personnalise leurs referentiels' },
      { label: 'Statistiques', path: '/admin/stats', component: 'StatsPage', auth: 'admin',
        description: 'Totaux (items, contributions, utilisateurs, espaces), courbes d\'activite sur periode, repartition par type d\'item, top 10 espaces les plus actifs' },
      { label: 'Journal d\'audit', path: '/admin/audit-logs', component: 'AuditLogsPage', auth: 'admin',
        description: 'Historique complet des modifications avec filtres (entite, action, batch, dates), regroupement par batch, restauration selective ou par lot, purge' },
      { label: 'Configuration des vues', path: '/admin/views', component: 'ViewsConfigPage', auth: 'admin',
        description: 'Edition inline des libelles, ordre, categories et niveaux d\'acces (public/user/admin) de chaque vue et page globale, toggle de visibilite' },
    ],
  },
  {
    label: 'Composants transversaux', auth: 'admin',
    description: 'Elements d\'interface presents sur toutes les pages authentifiees (visible en mode dev uniquement)',
    children: [
      { label: 'Sidebar', component: 'Layout (sidebar)', auth: 'authenticated',
        description: 'Navigation par communautes (depliables, reordonnables par drag & drop), espaces avec hierarchie, favoris (etoile), espaces recents, lien admin' },
      { label: 'Header', component: 'Layout (header)', auth: 'authenticated',
        description: 'Bouton menu mobile, lien accueil, notifications, selecteur de theme (clair/sombre/systeme), menu utilisateur (profil, admin, deconnexion)' },
      { label: 'Notifications', component: 'NotificationBell', auth: 'authenticated',
        description: 'Badge avec compteur, liste des invitations en attente (communaute ou espace), accepter/refuser en un clic' },
      { label: 'Profil utilisateur', component: 'UserProfileModal', auth: 'authenticated',
        description: 'Modification du nom, email, mot de passe, avatar, preferences de notification' },
      { label: 'Onboarding', component: 'WelcomeModal + tours guides', auth: 'authenticated',
        description: 'Modale de bienvenue au premier lancement, tours guides interactifs par vue (sidebar, espaces, kanban, etc.)' },
    ],
  },
];

const AUTH_BADGE = {
  public: { label: 'Public', icon: Globe, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30' },
  authenticated: { label: 'Connecte', icon: User, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  admin: { label: 'Admin', icon: Shield, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' },
};

function TreeNode({ node, level, isAuthenticated, isAdmin, isDev }: { node: SiteNode; level: number; isAuthenticated: boolean; isAdmin: boolean; isDev: boolean }) {
  // Filter visibility based on auth state
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
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader maxWidth="max-w-4xl" showBack />

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
      <PublicFooter />
    </div>
  );
}
