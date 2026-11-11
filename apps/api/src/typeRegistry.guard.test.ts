/*
 * Garde de la source unique des types d'élément (registre packages/shared/src/constants/typeRegistry.ts, 2026-11-08).
 * Échoue si :
 *  - l'enum Prisma `ItemType` ne contient pas exactement les types du registre ;
 *  - un fichier source (web, api, mcp-core, shared) redéclare une liste ou une table de types : tableau de 4 types ou
 *    plus, objet qui a 3 types ou plus comme clés, ou `switch` à 4 `case` de types ou plus ;
 *  - un fichier compare ou pose un statut par sa valeur ('done', 'cancelled', 'in_progress'…) ou en liste plusieurs :
 *    le sens d'un statut passe par sa catégorie (statusCategory, isClosedStatus, statusIdsIn, firstStatusIn).
 * Correction attendue : dériver du registre (ITEM_TYPES, itemTypesWhere, getItemTypeDef côté partagé ; TYPE_LABELS,
 * getTypeHex, getTypeColor, TYPE_FILTER_OPTIONS… côté web), jamais ajouter une exception ici sans raison écrite.
 * Placé dans le projet api (environnement node) car il lit des fichiers de tout le dépôt.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { ITEM_TYPES } from '@spok/shared';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SCANNED = ['apps/web/src', 'apps/api/src', 'packages/mcp-core/src', 'packages/shared/src'];
const REGISTRY = 'packages/shared/src/constants/typeRegistry.ts';
// Seuls fichiers où les identifiants des statuts par défaut s'écrivent
const STATUS_SOURCES = ['packages/shared/src/constants/defaultReferentiels.ts', 'packages/shared/src/constants/statusCategory.ts'];
const STATUS_IDS = ['todo', 'scheduled', 'in_progress', 'late', 'to_validate', 'done', 'cancelled'];
const STATUS_ALT = STATUS_IDS.join('|');

/** Statuts écrits en dur (vide = conforme) */
export function findStatusLiterals(src: string): string[] {
  const problems: string[] = [];
  src.split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // commentaire
    const code = line.replace(/\/\/.*$/, ''); // commentaire de fin de ligne
    const m = new RegExp(`[sS]tatus\\w*\\s*(?:===|!==|:|=)\\s*['"](${STATUS_ALT})['"]`).exec(code);
    if (m) problems.push(`ligne ${i + 1} : statut « ${m[1]} » écrit en dur`);
  });
  for (const m of src.matchAll(/\[[^[\]]*\]/g)) {
    const found = new Set([...m[0].matchAll(new RegExp(`['"](${STATUS_ALT})['"]`, 'g'))].map((x) => x[1]));
    if (found.size >= 2) problems.push(`liste de statuts : ${[...found].join(', ')}`);
  }
  return problems;
}

// Exceptions justifiées (chemin relatif à la racine, séparateur /) — aucune pour l'instant
const ALLOWED: Record<string, string> = {};

const TYPES = new Set<string>(ITEM_TYPES);
const TYPE_ALT = [...TYPES].join('|');

// Les types média (Image, Document, Lien, Diagramme) sont sortis du registre au lot 4 des contenus multiples : les
// sortes de contenu (IMAGE, FILE, LINK, DIAGRAM) ne sont plus des noms de type, plus d'exception « média ».

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

/** Problèmes trouvés dans un texte source (vide = conforme) */
export function findTypeCopies(src: string): string[] {
  const problems: string[] = [];
  // Tableaux sans crochet imbriqué : nombre de types distincts cités entre guillemets
  for (const m of src.matchAll(/\[[^[\]]*\]/g)) {
    const found = new Set([...m[0].matchAll(new RegExp(`['"](${TYPE_ALT})['"]`, 'g'))].map((x) => x[1]));
    if (found.size >= 4) problems.push(`liste de ${found.size} types : ${[...found].join(', ')}`);
  }
  // Clés d'objet : fenêtre glissante de 20 lignes, types distincts utilisés comme clés
  const lines = src.split('\n');
  const keyRe = new RegExp(`(?:^|[{,])\\s*['"]?(${TYPE_ALT})['"]?\\s*:(?!:)`, 'g');
  const keysByLine = lines.map((l) => new Set([...l.matchAll(keyRe)].map((x) => x[1])));
  for (let i = 0; i < lines.length; i++) {
    const found = new Set<string>();
    for (let j = i; j < Math.min(lines.length, i + 20); j++) keysByLine[j].forEach((k) => found.add(k));
    if (found.size >= 3) {
      problems.push(`table de ${found.size} types (ligne ${i + 1}) : ${[...found].join(', ')}`);
      break;
    }
  }
  // switch sur les types
  const cases = new Set([...src.matchAll(new RegExp(`case\\s+['"](${TYPE_ALT})['"]\\s*:`, 'g'))].map((x) => x[1]));
  if (cases.size >= 4) problems.push(`switch sur ${cases.size} types : ${[...cases].join(', ')}`);
  return problems;
}

describe('source unique des types d\'élément', () => {
  it('l\'enum Prisma ItemType reprend exactement le registre', () => {
    const schema = readFileSync(join(ROOT, 'packages/database/prisma/schema.prisma'), 'utf-8');
    const block = schema.match(/enum ItemType \{([^}]*)\}/);
    expect(block).not.toBeNull();
    const values = block![1].split('\n').map((l) => l.replace(/\/\/.*/, '').trim()).filter(Boolean);
    expect(values.sort()).toEqual([...ITEM_TYPES].sort());
  });

  it('le détecteur repère une table, une liste et un switch recopiés', () => {
    expect(findTypeCopies("const C = {\n  PROJECT: '#000',\n  TASK: '#111',\n  PERIOD: '#222',\n};")).toHaveLength(1);
    expect(findTypeCopies("const L = ['UNDEFINED', 'TASK', 'PROJECT', 'MEETING'];")).toHaveLength(1);
    expect(findTypeCopies("switch (t) { case 'UNDEFINED': case 'TASK': case 'PERIOD': case 'QUESTION': }")).toHaveLength(1);
    expect(findTypeCopies("if (t === 'TASK' || t === 'MEETING') x = ['IMAGE', 'DIAGRAM'];")).toEqual([]);
    // Sortes de contenu (et anciens types retirés) : pas des types du registre
    expect(findTypeCopies("const K = ['IMAGE', 'FILE', 'LINK', 'DIAGRAM'];")).toEqual([]);
    expect(findTypeCopies("const K = ['LINK', 'CONFIG', 'DOCUMENT', 'IMAGE', 'BUG', 'DIAGRAM', 'NOTE'];")).toEqual([]);
  });

  it('le détecteur repère un statut comparé, posé ou listé en dur', () => {
    expect(findStatusLiterals("if (item.status === 'done') x();")).toHaveLength(1);
    expect(findStatusLiterals("create({ status: 'todo' })")).toHaveLength(1);
    expect(findStatusLiterals("const CLOSED = ['done', 'cancelled'];")).toHaveLength(1);
    expect(findStatusLiterals("if (viewMode === 'todo') x(); // status === 'done'")).toEqual([]);
  });

  it('aucun fichier source n\'écrit un statut en dur', () => {
    const offenders: string[] = [];
    for (const dir of SCANNED) {
      for (const file of sourceFiles(join(ROOT, dir))) {
        const rel = relative(ROOT, file).split('\\').join('/');
        if (STATUS_SOURCES.includes(rel)) continue;
        for (const p of findStatusLiterals(readFileSync(file, 'utf-8'))) offenders.push(`${rel} — ${p}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('aucun fichier source ne redéclare une liste ou une table de types', () => {
    const offenders: string[] = [];
    for (const dir of SCANNED) {
      for (const file of sourceFiles(join(ROOT, dir))) {
        const rel = relative(ROOT, file).split('\\').join('/');
        if (rel === REGISTRY || ALLOWED[rel]) continue;
        for (const p of findTypeCopies(readFileSync(file, 'utf-8'))) offenders.push(`${rel} — ${p}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
