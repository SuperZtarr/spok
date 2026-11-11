/**
 * Migration des types retirés (contenus multiples, lot 4, 2026-11-11) — règle validée par Thomas :
 *   IMAGE, LINK, DIAGRAM, DOCUMENT, NOTE → UNDEFINED (« Élément »), le média reste en contenu ;
 *   CONFIG → UNDEFINED + tag « config » ; BUG → TASK + tag « bug » (tag de la communauté, créé s'il manque).
 *   (NOTE fusionnée dans l'Élément : complément du lot 4 validé par Thomas le 2026-11-11.)
 * Aussi : un élément d'un autre type qui porte encore une url sans contenu de cette adresse reçoit un contenu Lien
 * (l'url n'est plus lue) ; un élément retiré pas encore recopié reçoit son contenu (comme backfill-item-contents.ts) ;
 * modèles d'élément enregistrés (item_templates.structure) et libellés de types des communautés
 * (communities.referentiels.typeLabels) : types retirés enlevés / remplacés, « Non défini » → « Élément ».
 * Correspondance : @spok/shared replacementForRetiredType (même règle que utils/itemTree.ts).
 *
 * Lit et écrit le type en SQL brut (::text / ::"ItemType") : le client Prisma régénéré ne connaît plus les anciennes
 * valeurs. À lancer AVANT la mise en ligne du schéma du lot 4 (l'enum réduit ne s'applique pas tant qu'une ligne
 * porte un ancien type). Rejouable : ne retouche que ce qui reste à migrer.
 *
 * Sauvegarde : chaque --apply écrit backups/migrate-item-types-<env>-<date>.json (racine du dépôt, ignoré par git) :
 * ancien type de chaque élément, tags et contenus ajoutés, anciens modèles et référentiels.
 * --restore <fichier> remet tout en place (possible tant que l'enum contient encore les anciennes valeurs).
 *
 * Exécuter : npx tsx apps/api/scripts/migrate-item-types.ts [--prod] [--apply] [--restore <fichier>]
 * Sans --apply : bilan seulement. --prod : base de prod, sur demande explicite de Thomas seulement.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { prodPrisma, localPrisma, isProd } from './_env';
import { draftForLegacy } from './_legacyContent';
import { RETIRED_ITEM_TYPES, isRetiredItemType, replacementForRetiredType } from '@spok/shared';
import { SYSTEM_TAG_COLORS } from '../src/utils/classificationTag';

const prisma = isProd ? prodPrisma() : localPrisma();
const apply = process.argv.includes('--apply');
const restoreIdx = process.argv.indexOf('--restore');
const restoreFile = restoreIdx > 0 ? process.argv[restoreIdx + 1] : undefined;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

type Row = { id: string; type: string; url: string | null; content: unknown; createdById: string; createdAt: Date; spaceId: string };
type Backup = {
  env: string; at: string;
  items: { id: string; from: string; to: string }[];
  itemTags: { itemId: string; tagId: string }[];
  createdTags: string[];
  createdContents: string[];
  templates: { id: string; structure: unknown }[];
  communities: { id: string; referentiels: unknown }[];
};

const RETIRED_SQL = RETIRED_ITEM_TYPES.map((t) => `'${t}'`).join(', ');

async function tagFor(spaceId: string, name: string, backup: Backup, cache: Map<string, string>): Promise<string> {
  const space = await prisma.space.findUnique({ where: { id: spaceId }, select: { communityId: true } });
  const scope = space?.communityId ? { communityId: space.communityId } : { spaceId };
  const key = `${scope.communityId ?? scope.spaceId}|${name}`;
  const known = cache.get(key);
  if (known) return known;
  const existing = await prisma.tag.findFirst({ where: { ...scope, name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
  let id = existing?.id;
  if (!id) {
    id = (await prisma.tag.create({ data: { ...scope, name, color: SYSTEM_TAG_COLORS[name] ?? null }, select: { id: true } })).id;
    backup.createdTags.push(id);
  }
  cache.set(key, id);
  return id;
}

/** Arbre d'un modèle enregistré, types retirés remplacés ; null si rien ne change */
function migrateStructure(node: any): any | null {
  if (!node || typeof node !== 'object') return null;
  let changed = false;
  const next: any = { ...node };
  if (isRetiredItemType(node.type)) {
    const r = replacementForRetiredType(node.type);
    next.type = r.type;
    if (r.tag) next.tags = [...(Array.isArray(node.tags) ? node.tags : []), r.tag];
    changed = true;
  }
  if (Array.isArray(node.children)) {
    next.children = node.children.map((c: any) => {
      const m = migrateStructure(c);
      if (m) changed = true;
      return m ?? c;
    });
  }
  return changed ? next : null;
}

/** Référentiels d'une communauté, types retirés enlevés et « Non défini » renommé ; null si rien ne change */
function migrateReferentiels(ref: any): any | null {
  if (!ref || typeof ref !== 'object' || !ref.typeLabels || typeof ref.typeLabels !== 'object') return null;
  const labels = { ...ref.typeLabels };
  let changed = false;
  for (const t of RETIRED_ITEM_TYPES) if (t in labels) { delete labels[t]; changed = true; }
  const u = labels.UNDEFINED;
  if (u && (u.label === 'Non défini' || u.labelShort === 'Non défini')) {
    labels.UNDEFINED = { ...u, label: u.label === 'Non défini' ? 'Éléments' : u.label, labelShort: u.labelShort === 'Non défini' ? 'Élément' : u.labelShort };
    changed = true;
  }
  return changed ? { ...ref, typeLabels: labels } : null;
}

async function migrate() {
  const env = isProd ? 'PROD' : 'local';
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT id, type::text AS type, url, content, "createdById", "createdAt", "spaceId" FROM items
     WHERE type::text IN (${RETIRED_SQL}) OR (url IS NOT NULL AND url <> '')`,
  );
  const contents = await prisma.itemContent.findMany({
    where: { itemId: { in: rows.map((r) => r.id) } }, select: { itemId: true, kind: true, url: true },
  });
  const byItem = new Map<string, { kind: string; url: string | null }[]>();
  for (const c of contents) byItem.set(c.itemId, [...(byItem.get(c.itemId) ?? []), c]);

  const backup: Backup = { env, at: new Date().toISOString(), items: [], itemTags: [], createdTags: [], createdContents: [], templates: [], communities: [] };
  const plan = { contents: 0, types: {} as Record<string, number>, tags: { bug: 0, config: 0 } };
  const tagCache = new Map<string, string>();

  for (const row of rows) {
    const own = byItem.get(row.id) ?? [];
    const retired = isRetiredItemType(row.type);
    // Contenu à créer : élément retiré pas encore recopié, ou autre type dont l'url n'est dans aucun contenu
    const draft = draftForLegacy(row);
    const needsContent = draft && (retired ? own.length === 0 : !own.some((c) => c.url === row.url));
    if (needsContent) {
      plan.contents++;
      own.push({ kind: draft.kind, url: draft.url });
      if (apply) backup.createdContents.push((await prisma.itemContent.create({ data: draft, select: { id: true } })).id);
    }
    if (!retired) continue;
    const r = replacementForRetiredType(row.type);
    const key = `${row.type} → ${r.type}${r.tag ? ` + ${r.tag}` : ''}`;
    plan.types[key] = (plan.types[key] ?? 0) + 1;
    if (r.tag) plan.tags[r.tag]++;
    if (!apply) continue;
    if (r.tag) {
      const tagId = await tagFor(row.spaceId, r.tag, backup, tagCache);
      const res = await prisma.itemTag.createMany({ data: [{ itemId: row.id, tagId }], skipDuplicates: true });
      if (res.count) backup.itemTags.push({ itemId: row.id, tagId });
    }
    await prisma.$executeRawUnsafe(`UPDATE items SET type = $1::"ItemType" WHERE id = $2`, r.type, row.id);
    backup.items.push({ id: row.id, from: row.type, to: r.type });
  }

  const templates = await prisma.itemTemplate.findMany({ select: { id: true, structure: true } });
  const templateChanges = templates.map((t) => ({ t, next: migrateStructure(t.structure) })).filter((x) => x.next);
  const communities = await prisma.community.findMany({ select: { id: true, referentiels: true } });
  const refChanges = communities.map((c) => ({ c, next: migrateReferentiels(c.referentiels) })).filter((x) => x.next);

  console.log(`[${env}] ${apply ? 'MIGRATION' : 'BILAN (sans --apply, rien n\'est écrit)'}`);
  console.log('  Types :', plan.types);
  console.log(`  Contenus à créer : ${plan.contents} ; tags posés : bug ${plan.tags.bug}, config ${plan.tags.config}`);
  console.log(`  Modèles d'élément à corriger : ${templateChanges.length} ; communautés (libellés de types) : ${refChanges.length}`);
  if (!apply) return;

  for (const { t, next } of templateChanges) {
    backup.templates.push({ id: t.id, structure: t.structure });
    await prisma.itemTemplate.update({ where: { id: t.id }, data: { structure: next } });
  }
  for (const { c, next } of refChanges) {
    backup.communities.push({ id: c.id, referentiels: c.referentiels });
    await prisma.community.update({ where: { id: c.id }, data: { referentiels: next } });
  }

  const dir = path.join(ROOT, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `migrate-item-types-${env}-${backup.at.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2));
  const left = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM items WHERE type::text IN (${RETIRED_SQL})`);
  console.log(`Fait : ${backup.items.length} éléments, ${backup.createdContents.length} contenus, ${backup.itemTags.length} tags posés.`);
  console.log(`Éléments restant à un type retiré : ${left[0].n}`);
  console.log(`Sauvegarde : ${file}`);
}

async function restore(file: string) {
  const b: Backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`[${isProd ? 'PROD' : 'local'}] RESTAURATION de ${file} (sauvegarde ${b.env} du ${b.at})`);
  for (const it of b.items) await prisma.$executeRawUnsafe(`UPDATE items SET type = $1::"ItemType" WHERE id = $2`, it.from, it.id);
  for (const t of b.itemTags) await prisma.itemTag.deleteMany({ where: t });
  await prisma.itemContent.deleteMany({ where: { id: { in: b.createdContents } } });
  await prisma.tag.deleteMany({ where: { id: { in: b.createdTags }, items: { none: {} } } });
  for (const t of b.templates) await prisma.itemTemplate.update({ where: { id: t.id }, data: { structure: t.structure as any } });
  for (const c of b.communities) await prisma.community.update({ where: { id: c.id }, data: { referentiels: c.referentiels as any } });
  console.log(`Restauré : ${b.items.length} éléments, ${b.itemTags.length} tags retirés, ${b.createdContents.length} contenus retirés.`);
}

(restoreFile ? restore(restoreFile) : migrate()).finally(() => prisma.$disconnect());
