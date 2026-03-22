import { PrismaClient } from '@spok/database';
import { ENV } from './_env';

const db = new PrismaClient({
  datasources: { db: { url: ENV.PROD_DB_URL } },
});

const ADMIN_ID = ENV.PROD_ADMIN_ID;

// Space IDs in prod
const SPACE_MODELE = 'cmmuaspxq00545e158iaw0883';
const SPACE_UI = 'cmmthmtjw000if03nkcpdb7mh';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findOrCreateItem(
  spaceId: string,
  title: string,
  type: string,
  parentId: string | null,
  position: number,
  extra?: { description?: string; url?: string; status?: string }
): Promise<string> {
  const existing = await db.item.findFirst({
    where: { title, spaceId, parentId, type: type as any },
  });
  if (existing) return existing.id;

  const item = await db.item.create({
    data: {
      title,
      type: type as any,
      spaceId,
      createdById: ADMIN_ID,
      parentId,
      position,
      ...extra,
    },
  });
  console.log(`  + ${type} ${title}`);
  return item.id;
}

// ---------------------------------------------------------------------------
// 1. Modèle de données — champs manquants
// ---------------------------------------------------------------------------

async function updateModele() {
  console.log('\n=== Modèle de données ===');

  // Find existing parent items
  const items = await db.item.findMany({
    where: { spaceId: SPACE_MODELE },
    select: { id: true, title: true, parentId: true, type: true },
  });

  const find = (title: string) => items.find(i => i.title === title);

  // --- Community: champs manquants ---
  const community = find('Community');
  if (community) {
    console.log('Community - ajout champs manquants');
    const children = items.filter(i => i.parentId === community.id);
    let pos = children.length;
    await findOrCreateItem(SPACE_MODELE, 'visibility', 'DOCUMENT', community.id, pos++);
    await findOrCreateItem(SPACE_MODELE, 'pendingVisibility', 'DOCUMENT', community.id, pos++);
    await findOrCreateItem(SPACE_MODELE, 'coverPosition', 'DOCUMENT', community.id, pos++);
    await findOrCreateItem(SPACE_MODELE, 'coverZoom', 'DOCUMENT', community.id, pos++);
  }

  // --- Space: champs manquants ---
  const space = find('Space');
  if (space) {
    console.log('Space - ajout champs manquants');
    const children = items.filter(i => i.parentId === space.id);
    let pos = children.length;
    await findOrCreateItem(SPACE_MODELE, 'visibility', 'DOCUMENT', space.id, pos++);
    await findOrCreateItem(SPACE_MODELE, 'coverPosition', 'DOCUMENT', space.id, pos++);
    await findOrCreateItem(SPACE_MODELE, 'coverZoom', 'DOCUMENT', space.id, pos++);
  }

  // --- User: champ manquant ---
  const user = find('User');
  if (user) {
    console.log('User - ajout champ manquant');
    const children = items.filter(i => i.parentId === user.id);
    await findOrCreateItem(SPACE_MODELE, 'disabledAt', 'DOCUMENT', user.id, children.length);
  }

  // --- Notification: champs manquants ---
  const notification = find('Notification');
  if (notification) {
    console.log('Notification - ajout champs manquants');
    const children = items.filter(i => i.parentId === notification.id);
    let pos = children.length;
    await findOrCreateItem(SPACE_MODELE, 'type', 'DOCUMENT', notification.id, pos++);
    await findOrCreateItem(SPACE_MODELE, 'title', 'DOCUMENT', notification.id, pos++);
    await findOrCreateItem(SPACE_MODELE, 'message', 'DOCUMENT', notification.id, pos++);
    await findOrCreateItem(SPACE_MODELE, 'link', 'DOCUMENT', notification.id, pos++);
    await findOrCreateItem(SPACE_MODELE, 'read', 'DOCUMENT', notification.id, pos++);
    await findOrCreateItem(SPACE_MODELE, 'metadata', 'DOCUMENT', notification.id, pos++);
  }

  // --- Tables manquantes ---
  const techParent = find('Les tables techniques');
  if (techParent) {
    console.log('Tables techniques - ajout manquantes');
    const children = items.filter(i => i.parentId === techParent.id);
    let pos = children.length;
    await findOrCreateItem(SPACE_MODELE, 'ItemBookmark', 'DOCUMENT', techParent.id, pos++);
    await findOrCreateItem(SPACE_MODELE, 'PasswordResetToken', 'DOCUMENT', techParent.id, pos++);
    await findOrCreateItem(SPACE_MODELE, 'AppConfig', 'DOCUMENT', techParent.id, pos++);
    await findOrCreateItem(SPACE_MODELE, 'MenuItem', 'DOCUMENT', techParent.id, pos++);
  }

  // --- Fix orphelin fromItemId → sous ItemRelation ---
  const orphan = find('fromItemId');
  const itemRelation = find('ItemRelation');
  if (orphan && itemRelation && orphan.parentId !== itemRelation.id) {
    console.log('Fix: fromItemId → sous ItemRelation');
    await db.item.update({
      where: { id: orphan.id },
      data: { parentId: itemRelation.id, title: 'fromItemId' },
    });
  }
}

// ---------------------------------------------------------------------------
// 2. Interface utilisateur — pages et vues manquantes
// ---------------------------------------------------------------------------

async function updateUI() {
  console.log('\n=== Interface utilisateur ===');

  const items = await db.item.findMany({
    where: { spaceId: SPACE_UI },
    select: { id: true, title: true, parentId: true, type: true },
  });

  const find = (title: string) => items.find(i => i.title === title);

  // --- Pages manquantes sous "Les pages" ---
  const lesPages = find('Les pages');
  if (lesPages) {
    console.log('Pages - ajout manquantes');
    const children = items.filter(i => i.parentId === lesPages.id);
    let pos = children.length;
    await findOrCreateItem(SPACE_UI, 'Page Liens globaux', 'NOTE', lesPages.id, pos++, { description: 'GlobalLinksPage — /links — Tous les liens par communauté/espace/sous-espace' });
    await findOrCreateItem(SPACE_UI, 'Page Favoris', 'NOTE', lesPages.id, pos++, { description: 'BookmarksPage — /bookmarks — Espaces épinglés' });
    await findOrCreateItem(SPACE_UI, 'Page Contact', 'NOTE', lesPages.id, pos++, { description: 'ContactPage — /contact — Formulaire de contact (questions, bugs, features)' });
    await findOrCreateItem(SPACE_UI, 'Page Plan du site', 'NOTE', lesPages.id, pos++, { description: 'SitemapPage — /sitemap — Structure du site avec descriptions' });
    await findOrCreateItem(SPACE_UI, 'Page Recherche', 'NOTE', lesPages.id, pos++, { description: 'SearchPage — /search — Recherche avancée multi-type avec filtres et surlignage' });
    await findOrCreateItem(SPACE_UI, 'Page Graphe global', 'NOTE', lesPages.id, pos++, { description: 'GraphPage — /graph — Graphe force-directed global' });
    await findOrCreateItem(SPACE_UI, 'Page Sunburst global', 'NOTE', lesPages.id, pos++, { description: 'SunburstPage — /sunburst — Visualisation circulaire hiérarchique globale' });
    await findOrCreateItem(SPACE_UI, 'Page MindMap global', 'NOTE', lesPages.id, pos++, { description: 'MindMapPage — /mindmap — Carte mentale globale' });
    await findOrCreateItem(SPACE_UI, 'Page Tâches globales', 'NOTE', lesPages.id, pos++, { description: 'GlobalTasksPage — /tasks — Tâches filtrées cross-espaces' });
    await findOrCreateItem(SPACE_UI, 'Page Invitation', 'NOTE', lesPages.id, pos++, { description: 'InvitationPage — /invitation — Acceptation invitation par token' });
  }

  // --- Vues manquantes sous "Vues" ---
  const vues = find('Vues');
  if (vues) {
    console.log('Vues - ajout manquantes');
    const children = items.filter(i => i.parentId === vues.id);
    let pos = children.length;
    await findOrCreateItem(SPACE_UI, 'Échéances (Deadlines)', 'DOCUMENT', vues.id, pos++, { description: 'DeadlinesView — Items triés par date d\'échéance' });
    await findOrCreateItem(SPACE_UI, 'Images', 'DOCUMENT', vues.id, pos++, { description: 'ImagesView — Galerie des items de type IMAGE' });
    await findOrCreateItem(SPACE_UI, 'Liens', 'DOCUMENT', vues.id, pos++, { description: 'LinksView — Liste des items LINK avec favicon et métadonnées' });
    await findOrCreateItem(SPACE_UI, 'Documents', 'DOCUMENT', vues.id, pos++, { description: 'DocumentsView — Liste filtrée des items DOCUMENT' });
    await findOrCreateItem(SPACE_UI, 'Bugs', 'DOCUMENT', vues.id, pos++, { description: 'BugsView — Liste filtrée des items BUG' });
    await findOrCreateItem(SPACE_UI, 'Planification', 'DOCUMENT', vues.id, pos++, { description: 'PlanningView — Timeline avec périodes et jalons' });
    await findOrCreateItem(SPACE_UI, 'Vue d\'ensemble', 'DOCUMENT', vues.id, pos++, { description: 'OverviewView — Aperçu espace (stats, membres, vues)' });
    await findOrCreateItem(SPACE_UI, 'Relations', 'DOCUMENT', vues.id, pos++, { description: 'RelationsMapView — Carte des relations entre items' });
    await findOrCreateItem(SPACE_UI, 'Dashboard Cockpit', 'DOCUMENT', vues.id, pos++, { description: 'DashboardCockpitView — KPIs, mini-Gantt échéances, répartitions, progression' });
  }

  // --- Admin pages manquantes ---
  const admin = items.find(i => i.title === 'Administration' && i.parentId === lesPages?.id);
  if (admin) {
    console.log('Admin - ajout pages manquantes');
    const children = items.filter(i => i.parentId === admin.id);
    let pos = children.length;
    await findOrCreateItem(SPACE_UI, 'Admin Menu', 'NOTE', admin.id, pos++, { description: 'MenuConfigPage — /admin/menu — Configuration navigation (sections, ordre, accès)' });
    await findOrCreateItem(SPACE_UI, 'Admin Vues', 'NOTE', admin.id, pos++, { description: 'ViewsConfigPage — /admin/views — Configuration des vues (globales, espace, catégories)' });
    await findOrCreateItem(SPACE_UI, 'Admin API Doc', 'NOTE', admin.id, pos++, { description: 'ApiDocPage — /admin/api-doc — Documentation API endpoints' });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await updateModele();
  await updateUI();
  console.log('\nTerminé!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
