import { PrismaClient, SpaceType, Role, ItemType, GlobalRole, CommunityRole } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await hash('admin1234', 10);
  const demoHash = await hash('demo1234', 10);
  const testHash = await hash('test1234', 10);

  // ============================================================
  // USERS
  // ============================================================

  const admin = await prisma.user.upsert({
    where: { email: 'admin@spok.app' },
    update: { globalRole: GlobalRole.ADMIN },
    create: {
      email: 'admin@spok.app',
      name: 'Admin SPOK',
      passwordHash,
      globalRole: GlobalRole.ADMIN,
    },
  });

  const demo = await prisma.user.upsert({
    where: { email: 'demo@spok.app' },
    update: {},
    create: {
      email: 'demo@spok.app',
      name: 'Demo User',
      passwordHash: demoHash,
    },
  });

  const alice = await prisma.user.upsert({
    where: { email: 'alice@spok.app' },
    update: {},
    create: {
      email: 'alice@spok.app',
      name: 'Alice Martin',
      passwordHash: testHash,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@spok.app' },
    update: {},
    create: {
      email: 'bob@spok.app',
      name: 'Bob Dupont',
      passwordHash: testHash,
    },
  });

  const charlie = await prisma.user.upsert({
    where: { email: 'charlie@spok.app' },
    update: {},
    create: {
      email: 'charlie@spok.app',
      name: 'Charlie Durand',
      passwordHash: testHash,
    },
  });

  console.log('Created users: admin, demo, alice, bob, charlie');

  // ============================================================
  // PERSONAL SPACES
  // ============================================================

  for (const u of [admin, demo, alice, bob, charlie]) {
    const spaceId = `personal-space-${u.id}`;
    const space = await prisma.space.upsert({
      where: { id: spaceId },
      update: {},
      create: {
        id: spaceId,
        name: `Espace de ${u.name}`,
        type: SpaceType.PERSONAL,
      },
    });
    await prisma.spaceMembership.upsert({
      where: { userId_spaceId: { userId: u.id, spaceId: space.id } },
      update: {},
      create: { userId: u.id, spaceId: space.id, role: Role.OWNER },
    });
  }

  console.log('Created personal spaces');

  // ============================================================
  // COMMUNITY "Test SPOK"
  // ============================================================

  const community = await prisma.community.upsert({
    where: { id: 'community-test' },
    update: {},
    create: {
      id: 'community-test',
      name: 'Test SPOK',
      description: 'Communauté de test avec jeu de données complet pour valider toutes les fonctionnalités.',
      isPublic: true,
    },
  });

  // Memberships communauté : admin=OWNER, alice=ADMIN, demo/bob/charlie=MEMBER
  const communityMembers: { userId: string; role: CommunityRole }[] = [
    { userId: admin.id, role: CommunityRole.OWNER },
    { userId: alice.id, role: CommunityRole.ADMIN },
    { userId: demo.id, role: CommunityRole.MEMBER },
    { userId: bob.id, role: CommunityRole.MEMBER },
    { userId: charlie.id, role: CommunityRole.MEMBER },
  ];

  for (const m of communityMembers) {
    await prisma.communityMembership.upsert({
      where: { userId_communityId: { userId: m.userId, communityId: community.id } },
      update: {},
      create: { userId: m.userId, communityId: community.id, role: m.role },
    });
  }

  console.log('Created community "Test SPOK" with 5 members');

  // ============================================================
  // SPACES (hiérarchie)
  // ============================================================

  // Espace racine : Développement Produit
  const spaceDev = await prisma.space.upsert({
    where: { id: 'space-dev' },
    update: {},
    create: {
      id: 'space-dev',
      name: 'Développement Produit',
      type: SpaceType.GROUP,
      communityId: community.id,
    },
  });

  // Sous-espace : Backend
  const spaceBackend = await prisma.space.upsert({
    where: { id: 'space-backend' },
    update: {},
    create: {
      id: 'space-backend',
      name: 'Backend API',
      type: SpaceType.GROUP,
      communityId: community.id,
      parentId: spaceDev.id,
    },
  });

  // Sous-espace : Frontend
  const spaceFrontend = await prisma.space.upsert({
    where: { id: 'space-frontend' },
    update: {},
    create: {
      id: 'space-frontend',
      name: 'Frontend Web',
      type: SpaceType.GROUP,
      communityId: community.id,
      parentId: spaceDev.id,
    },
  });

  // Espace racine : Organisation
  const spaceOrga = await prisma.space.upsert({
    where: { id: 'space-orga' },
    update: {},
    create: {
      id: 'space-orga',
      name: 'Organisation',
      type: SpaceType.GROUP,
      communityId: community.id,
    },
  });

  console.log('Created 4 spaces (2 root + 2 children)');

  // ============================================================
  // SPACE MEMBERSHIPS (rôles variés par espace)
  // ============================================================

  const spaceMembers: { userId: string; spaceId: string; role: Role }[] = [
    // Développement Produit : tous membres
    { userId: admin.id, spaceId: spaceDev.id, role: Role.OWNER },
    { userId: alice.id, spaceId: spaceDev.id, role: Role.ADMIN },
    { userId: demo.id, spaceId: spaceDev.id, role: Role.MEMBER },
    { userId: bob.id, spaceId: spaceDev.id, role: Role.MEMBER },
    { userId: charlie.id, spaceId: spaceDev.id, role: Role.VIEWER },
    // Backend : admin + alice + bob
    { userId: admin.id, spaceId: spaceBackend.id, role: Role.OWNER },
    { userId: alice.id, spaceId: spaceBackend.id, role: Role.ADMIN },
    { userId: bob.id, spaceId: spaceBackend.id, role: Role.MEMBER },
    // Frontend : admin + alice + demo
    { userId: admin.id, spaceId: spaceFrontend.id, role: Role.OWNER },
    { userId: alice.id, spaceId: spaceFrontend.id, role: Role.ADMIN },
    { userId: demo.id, spaceId: spaceFrontend.id, role: Role.MEMBER },
    // Organisation : tous
    { userId: admin.id, spaceId: spaceOrga.id, role: Role.OWNER },
    { userId: alice.id, spaceId: spaceOrga.id, role: Role.ADMIN },
    { userId: demo.id, spaceId: spaceOrga.id, role: Role.MEMBER },
    { userId: bob.id, spaceId: spaceOrga.id, role: Role.MEMBER },
    { userId: charlie.id, spaceId: spaceOrga.id, role: Role.MEMBER },
  ];

  for (const m of spaceMembers) {
    await prisma.spaceMembership.upsert({
      where: { userId_spaceId: { userId: m.userId, spaceId: m.spaceId } },
      update: {},
      create: { userId: m.userId, spaceId: m.spaceId, role: m.role },
    });
  }

  console.log('Created space memberships');

  // ============================================================
  // TAGS (par espace)
  // ============================================================

  const tagUrgent = await prisma.tag.upsert({
    where: { spaceId_name: { spaceId: spaceDev.id, name: 'Urgent' } },
    update: {},
    create: { name: 'Urgent', color: '#ef4444', spaceId: spaceDev.id },
  });
  const tagV2 = await prisma.tag.upsert({
    where: { spaceId_name: { spaceId: spaceDev.id, name: 'V2' } },
    update: {},
    create: { name: 'V2', color: '#8b5cf6', spaceId: spaceDev.id },
  });
  const tagPerf = await prisma.tag.upsert({
    where: { spaceId_name: { spaceId: spaceDev.id, name: 'Performance' } },
    update: {},
    create: { name: 'Performance', color: '#f59e0b', spaceId: spaceDev.id },
  });
  const tagUx = await prisma.tag.upsert({
    where: { spaceId_name: { spaceId: spaceDev.id, name: 'UX' } },
    update: {},
    create: { name: 'UX', color: '#ec4899', spaceId: spaceDev.id },
  });
  const tagDoc = await prisma.tag.upsert({
    where: { spaceId_name: { spaceId: spaceDev.id, name: 'Documentation' } },
    update: {},
    create: { name: 'Documentation', color: '#06b6d4', spaceId: spaceDev.id },
  });

  // Tags pour Organisation
  const tagReunion = await prisma.tag.upsert({
    where: { spaceId_name: { spaceId: spaceOrga.id, name: 'Hebdo' } },
    update: {},
    create: { name: 'Hebdo', color: '#3b82f6', spaceId: spaceOrga.id },
  });
  const tagDecision = await prisma.tag.upsert({
    where: { spaceId_name: { spaceId: spaceOrga.id, name: 'Décision' } },
    update: {},
    create: { name: 'Décision', color: '#10b981', spaceId: spaceOrga.id },
  });

  console.log('Created tags');

  // ============================================================
  // ITEMS — Espace "Développement Produit"
  // Couvre : PROJECT, TASK (tous statuts), NOTE, LINK, IMAGE, BUG
  // ============================================================

  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
  const daysFrom = (n: number) => new Date(now.getTime() + n * 86400000);

  // --- PROJECT : Refonte authentification ---
  const projAuth = await prisma.item.create({
    data: {
      type: ItemType.PROJECT,
      title: 'Refonte authentification',
      description: '<p>Migration vers JWT avec refresh tokens, reset password par email, vérification email.</p>',
      status: 'in_progress',
      priority: 1,
      startDate: daysAgo(30),
      endDate: daysFrom(15),
      spaceId: spaceDev.id,
      createdById: admin.id,
    },
  });

  // Tâches enfants avec tous les statuts
  const taskDone = await prisma.item.create({
    data: {
      type: ItemType.TASK,
      title: 'Implémenter JWT access + refresh tokens',
      description: '<p>Générer un access token (15 min) et un refresh token (7 jours). Stocker les refresh tokens en base.</p>',
      status: 'done',
      priority: 1,
      startDate: daysAgo(30),
      endDate: daysAgo(25),
      spaceId: spaceDev.id,
      createdById: alice.id,
      parentId: projAuth.id,
    },
  });

  const taskInProgress = await prisma.item.create({
    data: {
      type: ItemType.TASK,
      title: 'Formulaire de reset password',
      description: '<p>Page /forgot-password + envoi email Resend + page /reset-password avec token.</p>',
      status: 'in_progress',
      priority: 2,
      startDate: daysAgo(5),
      dueDate: daysFrom(3),
      spaceId: spaceDev.id,
      createdById: demo.id,
      parentId: projAuth.id,
    },
  });

  const taskTodo = await prisma.item.create({
    data: {
      type: ItemType.TASK,
      title: 'Vérification email à l\'inscription',
      description: '<p>Envoyer un email de vérification avec token unique. Bannière tant que non vérifié.</p>',
      status: 'todo',
      priority: 3,
      dueDate: daysFrom(10),
      spaceId: spaceDev.id,
      createdById: alice.id,
      parentId: projAuth.id,
    },
  });

  const taskBlocked = await prisma.item.create({
    data: {
      type: ItemType.TASK,
      title: 'OAuth2 Google / GitHub',
      description: '<p>Connexion via providers externes. Nécessite la refonte JWT terminée.</p>',
      status: 'blocked',
      priority: 4,
      spaceId: spaceDev.id,
      createdById: bob.id,
      parentId: projAuth.id,
    },
  });

  const taskLate = await prisma.item.create({
    data: {
      type: ItemType.TASK,
      title: 'Tests end-to-end auth',
      description: '<p>Tests Playwright couvrant login, logout, refresh, reset password.</p>',
      status: 'late',
      priority: 2,
      startDate: daysAgo(10),
      dueDate: daysAgo(2),
      spaceId: spaceDev.id,
      createdById: alice.id,
      parentId: projAuth.id,
    },
  });

  const taskCancelled = await prisma.item.create({
    data: {
      type: ItemType.TASK,
      title: 'Authentification biométrique (WebAuthn)',
      description: '<p>Abandonné : trop complexe pour la V1, reporté à la V2.</p>',
      status: 'cancelled',
      priority: 5,
      spaceId: spaceDev.id,
      createdById: admin.id,
      parentId: projAuth.id,
    },
  });

  const taskUndefined = await prisma.item.create({
    data: {
      type: ItemType.TASK,
      title: 'Revue de sécurité OWASP',
      spaceId: spaceDev.id,
      createdById: charlie.id,
      parentId: projAuth.id,
    },
  });

  // --- PROJECT : Amélioration vues ---
  const projViews = await prisma.item.create({
    data: {
      type: ItemType.PROJECT,
      title: 'Amélioration des vues',
      description: '<p>Améliorer les vues existantes (Kanban, Liste, Gantt, MindMap, Graphe, Sunburst, Séquence).</p>',
      status: 'todo',
      priority: 2,
      startDate: daysFrom(5),
      endDate: daysFrom(45),
      spaceId: spaceDev.id,
      createdById: admin.id,
    },
  });

  await prisma.item.createMany({
    data: [
      {
        type: ItemType.TASK,
        title: 'Drag & drop dans la vue Kanban',
        status: 'todo',
        priority: 2,
        dueDate: daysFrom(20),
        spaceId: spaceDev.id,
        createdById: demo.id,
        parentId: projViews.id,
      },
      {
        type: ItemType.TASK,
        title: 'Export CSV de la vue Liste',
        status: 'todo',
        priority: 3,
        spaceId: spaceDev.id,
        createdById: bob.id,
        parentId: projViews.id,
      },
      {
        type: ItemType.TASK,
        title: 'Filtres persistants par espace',
        status: 'in_progress',
        priority: 1,
        startDate: daysAgo(2),
        dueDate: daysFrom(7),
        spaceId: spaceDev.id,
        createdById: alice.id,
        parentId: projViews.id,
      },
    ],
  });

  // --- NOTE ---
  const noteArchi = await prisma.item.create({
    data: {
      type: ItemType.NOTE,
      title: 'Architecture technique SPOK',
      description: '<h2>Stack technique</h2><ul><li>Frontend : React + Vite + Tailwind</li><li>Backend : Fastify + Prisma</li><li>DB : PostgreSQL</li><li>Storage : Cloudflare R2</li></ul><p>Le monorepo utilise pnpm workspaces avec 2 packages partagés (<code>@spok/shared</code> et <code>@spok/database</code>).</p>',
      spaceId: spaceDev.id,
      createdById: admin.id,
    },
  });

  const noteRetro = await prisma.item.create({
    data: {
      type: ItemType.NOTE,
      title: 'Rétrospective Sprint 3',
      description: '<h3>Points positifs</h3><ul><li>Import forum terminé</li><li>Docker dev fonctionnel</li></ul><h3>Points à améliorer</h3><ul><li>Tests automatisés manquants</li><li>Documentation API incomplète</li></ul>',
      spaceId: spaceDev.id,
      createdById: alice.id,
    },
  });

  // --- LINK ---
  const linkFigma = await prisma.item.create({
    data: {
      type: ItemType.LINK,
      title: 'Maquettes Figma — Design System',
      url: 'https://www.figma.com/file/example-design-system',
      description: '<p>Maquettes du design system SPOK : composants, couleurs, typographie.</p>',
      spaceId: spaceDev.id,
      createdById: demo.id,
    },
  });

  await prisma.item.create({
    data: {
      type: ItemType.LINK,
      title: 'Documentation Prisma',
      url: 'https://www.prisma.io/docs',
      description: '<p>Référence ORM pour le backend.</p>',
      spaceId: spaceDev.id,
      createdById: bob.id,
    },
  });

  await prisma.item.create({
    data: {
      type: ItemType.LINK,
      title: 'Tailwind CSS Cheat Sheet',
      url: 'https://tailwindcss.com/docs',
      spaceId: spaceDev.id,
      createdById: alice.id,
    },
  });

  // --- IMAGE ---
  await prisma.item.create({
    data: {
      type: ItemType.IMAGE,
      title: 'Capture écran — Dashboard V2',
      url: 'https://picsum.photos/seed/spok-dashboard/800/600',
      description: '<p>Capture du nouveau Dashboard avec les cartes communautaires.</p>',
      spaceId: spaceDev.id,
      createdById: demo.id,
    },
  });

  await prisma.item.create({
    data: {
      type: ItemType.IMAGE,
      title: 'Diagramme architecture réseau',
      url: 'https://picsum.photos/seed/spok-archi/1024/768',
      spaceId: spaceDev.id,
      createdById: admin.id,
    },
  });

  // --- DOCUMENT ---
  await prisma.item.create({
    data: {
      type: ItemType.DOCUMENT,
      title: 'Cahier des charges V1',
      description: '<p>Spécifications fonctionnelles détaillées de la première version.</p>',
      spaceId: spaceDev.id,
      createdById: admin.id,
    },
  });

  // --- CONFIG ---
  await prisma.item.create({
    data: {
      type: ItemType.CONFIG,
      title: 'Variables d\'environnement production',
      description: '<p>Liste des variables à configurer sur Railway pour le déploiement.</p><ul><li>DATABASE_URL</li><li>JWT_SECRET</li><li>RESEND_API_KEY</li><li>R2_*</li></ul>',
      spaceId: spaceDev.id,
      createdById: admin.id,
    },
  });

  // --- BUG ---
  const bugLogin = await prisma.item.create({
    data: {
      type: ItemType.BUG,
      title: 'Déconnexion aléatoire après 30 minutes',
      description: '<p>Le refresh token ne se renouvelle pas correctement. L\'utilisateur est déconnecté même avec une activité continue.</p>',
      status: 'in_progress',
      priority: 1,
      spaceId: spaceDev.id,
      createdById: bob.id,
    },
  });

  const bugCss = await prisma.item.create({
    data: {
      type: ItemType.BUG,
      title: 'Overflow horizontal sur mobile (page Kanban)',
      description: '<p>Les colonnes Kanban débordent de l\'écran sur iPhone 12. Pas de scroll horizontal visible.</p>',
      status: 'todo',
      priority: 2,
      spaceId: spaceDev.id,
      createdById: demo.id,
    },
  });

  await prisma.item.create({
    data: {
      type: ItemType.BUG,
      title: 'Erreur 500 lors de la suppression d\'un espace avec enfants',
      description: '<p>La cascade ne fonctionne pas si un item enfant a des relations. Erreur FK constraint.</p>',
      status: 'done',
      priority: 1,
      startDate: daysAgo(8),
      endDate: daysAgo(6),
      spaceId: spaceDev.id,
      createdById: alice.id,
    },
  });

  console.log('Created items in "Développement Produit"');

  // ============================================================
  // ITEMS — Espace "Organisation"
  // Couvre : MEETING, PERIOD, CONFIG, NOTE
  // ============================================================

  // --- PERIOD ---
  const periodSprint = await prisma.item.create({
    data: {
      type: ItemType.PERIOD,
      title: 'Sprint 4 — Février 2026',
      description: '<p>Focus : refonte auth + amélioration vues.</p>',
      status: 'in_progress',
      startDate: daysAgo(10),
      endDate: daysFrom(4),
      spaceId: spaceOrga.id,
      createdById: admin.id,
    },
  });

  await prisma.item.create({
    data: {
      type: ItemType.PERIOD,
      title: 'Sprint 5 — Mars 2026',
      description: '<p>Focus : notifications + assignation.</p>',
      status: 'todo',
      startDate: daysFrom(5),
      endDate: daysFrom(19),
      spaceId: spaceOrga.id,
      createdById: admin.id,
    },
  });

  await prisma.item.create({
    data: {
      type: ItemType.PERIOD,
      title: 'Phase 1 — MVP',
      description: '<p>Livraison du produit minimum viable : auth, espaces, communautés, vues de base.</p>',
      status: 'done',
      startDate: daysAgo(60),
      endDate: daysAgo(15),
      spaceId: spaceOrga.id,
      createdById: admin.id,
    },
  });

  // --- MEETING ---
  const meetingHebdo = await prisma.item.create({
    data: {
      type: ItemType.MEETING,
      title: 'Réunion hebdo — Semaine 8',
      description: '<h3>Ordre du jour</h3><ol><li>Point sprint en cours</li><li>Blocages techniques</li><li>Priorisation backlog</li></ol><h3>Décisions</h3><ul><li>Reporter OAuth2 en V2</li><li>Prioriser le bug déconnexion</li></ul>',
      status: 'done',
      startDate: daysAgo(3),
      endDate: daysAgo(3),
      spaceId: spaceOrga.id,
      createdById: admin.id,
    },
  });

  await prisma.item.create({
    data: {
      type: ItemType.MEETING,
      title: 'Réunion hebdo — Semaine 9',
      description: '<p>À planifier.</p>',
      status: 'todo',
      startDate: daysFrom(4),
      endDate: daysFrom(4),
      spaceId: spaceOrga.id,
      createdById: admin.id,
    },
  });

  await prisma.item.create({
    data: {
      type: ItemType.MEETING,
      title: 'Démo client — Sprint 4',
      description: '<p>Présentation des nouvelles fonctionnalités au client. Préparer un scénario de démo.</p>',
      status: 'todo',
      priority: 1,
      startDate: daysFrom(5),
      endDate: daysFrom(5),
      spaceId: spaceOrga.id,
      createdById: alice.id,
    },
  });

  // --- NOTE dans Organisation ---
  await prisma.item.create({
    data: {
      type: ItemType.NOTE,
      title: 'Conventions de nommage',
      description: '<h3>Code</h3><ul><li>camelCase pour variables/fonctions</li><li>PascalCase pour composants React</li><li>UPPER_SNAKE pour constantes</li></ul><h3>Commits</h3><p>Format : <code>type: description courte</code></p><p>Types : feat, fix, refactor, docs, style, test, chore</p>',
      spaceId: spaceOrga.id,
      createdById: alice.id,
    },
  });

  // --- TASK dans Organisation ---
  await prisma.item.create({
    data: {
      type: ItemType.TASK,
      title: 'Rédiger le guide d\'onboarding',
      description: '<p>Document pour les nouveaux développeurs : setup local, architecture, conventions.</p>',
      status: 'todo',
      priority: 3,
      dueDate: daysFrom(14),
      spaceId: spaceOrga.id,
      createdById: demo.id,
    },
  });

  await prisma.item.create({
    data: {
      type: ItemType.TASK,
      title: 'Planifier la roadmap Q2 2026',
      status: 'in_progress',
      priority: 2,
      startDate: daysAgo(1),
      dueDate: daysFrom(7),
      spaceId: spaceOrga.id,
      createdById: admin.id,
    },
  });

  console.log('Created items in "Organisation"');

  // ============================================================
  // ITEMS — Espace "Backend API"
  // ============================================================

  const taskEndpoint = await prisma.item.create({
    data: {
      type: ItemType.TASK,
      title: 'Endpoint GET /items/search global',
      description: '<p>Recherche full-text cross-espaces avec filtres type, statut, tags.</p>',
      status: 'todo',
      priority: 2,
      dueDate: daysFrom(10),
      spaceId: spaceBackend.id,
      createdById: bob.id,
    },
  });

  await prisma.item.create({
    data: {
      type: ItemType.TASK,
      title: 'Rate limiting sur les routes auth',
      description: '<p>Limiter à 5 tentatives / minute par IP sur /auth/login et /auth/register.</p>',
      status: 'todo',
      priority: 1,
      spaceId: spaceBackend.id,
      createdById: alice.id,
    },
  });

  await prisma.item.create({
    data: {
      type: ItemType.TASK,
      title: 'Pagination cursor-based pour /items',
      status: 'in_progress',
      priority: 2,
      startDate: daysAgo(3),
      dueDate: daysFrom(5),
      spaceId: spaceBackend.id,
      createdById: bob.id,
    },
  });

  await prisma.item.create({
    data: {
      type: ItemType.NOTE,
      title: 'Conventions API REST',
      description: '<ul><li>GET pour lecture, POST pour création, PUT pour mise à jour complète, PATCH pour partielle, DELETE pour suppression</li><li>Codes : 200, 201, 204, 400, 401, 403, 404, 409, 500</li><li>Pagination : ?page=1&limit=50</li></ul>',
      spaceId: spaceBackend.id,
      createdById: alice.id,
    },
  });

  console.log('Created items in "Backend API"');

  // ============================================================
  // ITEMS — Espace "Frontend Web"
  // ============================================================

  await prisma.item.create({
    data: {
      type: ItemType.TASK,
      title: 'Dark mode',
      description: '<p>Implémenter le thème sombre avec Tailwind CSS <code>dark:</code> prefix. Utiliser la préférence système par défaut.</p>',
      status: 'todo',
      priority: 3,
      spaceId: spaceFrontend.id,
      createdById: demo.id,
    },
  });

  await prisma.item.create({
    data: {
      type: ItemType.TASK,
      title: 'Composant Notifications toast',
      description: '<p>Système de notifications temporaires (success, error, warning, info) avec auto-dismiss.</p>',
      status: 'in_progress',
      priority: 2,
      startDate: daysAgo(1),
      dueDate: daysFrom(4),
      spaceId: spaceFrontend.id,
      createdById: alice.id,
    },
  });

  await prisma.item.create({
    data: {
      type: ItemType.BUG,
      title: 'MindMap : nœuds superposés au chargement',
      description: '<p>Lorsque l\'espace a plus de 50 items, les nœuds se chevauchent avant que le layout s\'applique.</p>',
      status: 'todo',
      priority: 2,
      spaceId: spaceFrontend.id,
      createdById: demo.id,
    },
  });

  await prisma.item.create({
    data: {
      type: ItemType.LINK,
      title: 'React Flow — Documentation',
      url: 'https://reactflow.dev/docs/introduction',
      spaceId: spaceFrontend.id,
      createdById: alice.id,
    },
  });

  console.log('Created items in "Frontend Web"');

  // ============================================================
  // RELATIONS ENTRE ITEMS
  // ============================================================

  // OAuth2 est bloqué par la refonte JWT
  await prisma.itemRelation.create({
    data: { fromItemId: taskDone.id, toItemId: taskBlocked.id, type: 'blocks' },
  });

  // Tests E2E dépendent du formulaire reset password
  await prisma.itemRelation.create({
    data: { fromItemId: taskLate.id, toItemId: taskInProgress.id, type: 'depends' },
  });

  // Bug login lié au projet auth
  await prisma.itemRelation.create({
    data: { fromItemId: bugLogin.id, toItemId: projAuth.id, type: 'relates' },
  });

  // Bug CSS lié au lien Figma
  await prisma.itemRelation.create({
    data: { fromItemId: bugCss.id, toItemId: linkFigma.id, type: 'relates' },
  });

  // Endpoint search lié à la vérification email
  await prisma.itemRelation.create({
    data: { fromItemId: taskEndpoint.id, toItemId: taskTodo.id, type: 'relates' },
  });

  // Sprint 4 contient le projet auth et le projet vues
  await prisma.itemRelation.create({
    data: { fromItemId: periodSprint.id, toItemId: projAuth.id, type: 'relates' },
  });

  await prisma.itemRelation.create({
    data: { fromItemId: periodSprint.id, toItemId: projViews.id, type: 'relates' },
  });

  console.log('Created item relations');

  // ============================================================
  // TAG ASSIGNMENTS
  // ============================================================

  const tagAssignments: { itemId: string; tagId: string }[] = [
    { itemId: bugLogin.id, tagId: tagUrgent.id },
    { itemId: bugLogin.id, tagId: tagPerf.id },
    { itemId: bugCss.id, tagId: tagUx.id },
    { itemId: taskCancelled.id, tagId: tagV2.id },
    { itemId: taskBlocked.id, tagId: tagV2.id },
    { itemId: projAuth.id, tagId: tagUrgent.id },
    { itemId: noteArchi.id, tagId: tagDoc.id },
    { itemId: noteRetro.id, tagId: tagDoc.id },
    { itemId: projViews.id, tagId: tagUx.id },
    { itemId: meetingHebdo.id, tagId: tagReunion.id },
    { itemId: meetingHebdo.id, tagId: tagDecision.id },
  ];

  for (const a of tagAssignments) {
    await prisma.itemTag.upsert({
      where: { itemId_tagId: { itemId: a.itemId, tagId: a.tagId } },
      update: {},
      create: a,
    });
  }

  console.log('Created tag assignments');

  // ============================================================
  // CONTRIBUTIONS (commentaires sur items)
  // ============================================================

  await prisma.contribution.createMany({
    data: [
      {
        content: '<p>J\'ai commencé l\'implémentation. Le flow access/refresh fonctionne, il reste à gérer la rotation des refresh tokens.</p>',
        itemId: taskDone.id,
        authorId: alice.id,
        createdAt: daysAgo(28),
      },
      {
        content: '<p>Terminé et mergé. Les tokens expirent correctement, testés manuellement.</p>',
        itemId: taskDone.id,
        authorId: alice.id,
        createdAt: daysAgo(25),
      },
      {
        content: '<p>Le formulaire est prêt, j\'attends la clé Resend pour tester l\'envoi d\'email en dev.</p>',
        itemId: taskInProgress.id,
        authorId: demo.id,
        createdAt: daysAgo(3),
      },
      {
        content: '<p>Clé ajoutée au .env, tu peux tester maintenant.</p>',
        itemId: taskInProgress.id,
        authorId: admin.id,
        createdAt: daysAgo(2),
      },
      {
        content: '<p>Reproduit sur iPhone 12 et Samsung Galaxy S21. Les colonnes ont un min-width de 300px ce qui cause le débordement.</p>',
        itemId: bugCss.id,
        authorId: demo.id,
        createdAt: daysAgo(4),
      },
      {
        content: '<p>On pourrait utiliser un scroll horizontal avec <code>overflow-x-auto</code> sur le conteneur parent.</p>',
        itemId: bugCss.id,
        authorId: alice.id,
        createdAt: daysAgo(3),
      },
      {
        content: '<p>Le problème semble lié au refresh token : le timer de renouvellement se désynchronise quand l\'onglet est en arrière-plan.</p>',
        itemId: bugLogin.id,
        authorId: bob.id,
        createdAt: daysAgo(1),
      },
      {
        content: '<p>Bonne piste. On devrait utiliser visibilitychange pour détecter le retour au premier plan et vérifier le token.</p>',
        itemId: bugLogin.id,
        authorId: admin.id,
        createdAt: daysAgo(1),
      },
      {
        content: '<h3>CR de la réunion</h3><p>Présents : Admin, Alice, Demo, Bob.</p><p>Points abordés :</p><ul><li>Sprint 4 en bonne voie, 60% des tâches terminées</li><li>Bug déconnexion identifié, fix en cours</li><li>OAuth2 reporté en V2 par décision collective</li></ul>',
        itemId: meetingHebdo.id,
        authorId: admin.id,
        createdAt: daysAgo(3),
      },
      {
        content: '<p>+1 pour reporter OAuth2. On a assez de travail avec le système actuel.</p>',
        itemId: meetingHebdo.id,
        authorId: bob.id,
        createdAt: daysAgo(3),
      },
    ],
  });

  console.log('Created contributions');

  // ============================================================
  // DONE
  // ============================================================

  console.log('\n✓ Seeding completed!');
  console.log('  Users: admin@spok.app / demo@spok.app / alice@spok.app / bob@spok.app / charlie@spok.app');
  console.log('  Passwords: admin1234 / demo1234 / test1234 (alice, bob, charlie)');
  console.log('  Community: "Test SPOK" (public)');
  console.log('  Spaces: Développement Produit (> Backend API, Frontend Web) + Organisation');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
