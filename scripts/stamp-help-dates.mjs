#!/usr/bin/env node
/*
 * Date les nouveautés et évolutions de l'aide au moment de la MEP (skill spok-deploy) : une annonce sans date n'apparaît
 * qu'en développement local (help/elements.ts). Dater à la MEP, et non au développement, évite qu'un utilisateur ayant lu les
 * nouveautés entre-temps en manque une.
 * Usage :
 *   node scripts/stamp-help-dates.mjs                     liste les annonces sans date, sans rien modifier
 *   node scripts/stamp-help-dates.mjs <fichiers du lot>   date celles de ces fichiers avec la date du jour
 * Ne dater que les fichiers du lot : une annonce du travail en cours d'une autre session recevrait une date trop ancienne.
 * Une date déjà posée n'est jamais modifiée. Sans dépendance ; stampChangeDates et undatedChanges sont testés par
 * apps/web/src/help/stampHelpDates.test.ts.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Fin du texte commencé à `start` (guillemet ou commentaire), échappements compris. */
function skipToken(source, start) {
  const char = source[start];
  if (char === '/' && source[start + 1] === '/') {
    const end = source.indexOf('\n', start);
    return end === -1 ? source.length : end;
  }
  if (char === '/' && source[start + 1] === '*') {
    const end = source.indexOf('*/', start);
    return end === -1 ? source.length : end + 2;
  }
  if (char === "'" || char === '"' || char === '`') {
    for (let i = start + 1; i < source.length; i += 1) {
      if (source[i] === '\\') i += 1;
      else if (source[i] === char) return i + 1;
    }
    return source.length;
  }
  return start;
}

/** Objets de premier niveau de chaque tableau `changes: [...]`, en positions dans le texte. */
function changeObjects(source) {
  const objects = [];
  const arrays = /\bchanges\s*:\s*\[/g;
  let match;
  while ((match = arrays.exec(source))) {
    let depth = 0;
    let objectStart = -1;
    let i = match.index + match[0].length;
    while (i < source.length) {
      const next = skipToken(source, i);
      if (next !== i) { i = next; continue; }
      const char = source[i];
      if (char === ']' && depth === 0) break;
      if (char === '{' || char === '[') {
        if (char === '{' && depth === 0) objectStart = i;
        depth += 1;
      } else if (char === '}' || char === ']') {
        depth -= 1;
        if (char === '}' && depth === 0) objects.push({ start: objectStart, end: i });
      }
      i += 1;
    }
  }
  return objects;
}

/** Code de l'objet sans ses textes : un mot « date: » dans une phrase ne compte pas comme une date posée. */
function withoutStrings(code) {
  let result = '';
  let i = 0;
  while (i < code.length) {
    const next = skipToken(code, i);
    if (next !== i) { i = next; continue; }
    result += code[i];
    i += 1;
  }
  return result;
}

const hasDate = (source, { start, end }) => /\bdate\s*:/.test(withoutStrings(source.slice(start, end + 1)));

export function undatedChanges(source) {
  return changeObjects(source)
    .filter((object) => !hasDate(source, object))
    .map(({ start, end }) => changeId(source.slice(start, end + 1)));
}

function changeId(code) {
  return code.match(/\bid\s*:\s*['"`]([^'"`]+)['"`]/)?.[1] ?? '(sans identifiant)';
}

export function stampChangeDates(source, date) {
  let result = source;
  // De la fin vers le début : les positions déjà calculées restent justes
  for (const object of changeObjects(source).reverse()) {
    if (hasDate(source, object)) continue;
    const { end } = object;
    const lineStart = source.lastIndexOf('\n', end) + 1;
    const multiline = source.slice(lineStart, end).trim() === '' && lineStart > object.start;
    if (multiline) {
      const indent = source.slice(lineStart, end);
      result = `${result.slice(0, lineStart)}${indent}  date: '${date}',\n${result.slice(lineStart)}`;
    } else {
      const before = source.slice(object.start, end).trimEnd();
      const separator = before.endsWith(',') ? ' ' : ', ';
      result = `${result.slice(0, object.start)}${before}${separator}date: '${date}' }${result.slice(end + 1)}`;
    }
  }
  return result;
}

function helpFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return helpFiles(path);
    return /\.(help|elements)\.ts$/.test(name) ? [path] : [];
  });
}

function main() {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
  const files = process.argv.slice(2);
  if (files.length === 0) {
    const found = helpFiles(join(root, 'apps/web/src')).flatMap((file) =>
      undatedChanges(readFileSync(file, 'utf8')).map((id) => `${relative(root, file)} : ${id}`));
    console.log(found.length ? `Annonces sans date :\n${found.join('\n')}` : 'Aucune annonce sans date.');
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const stamped = stampChangeDates(source, today);
    if (stamped !== source) {
      writeFileSync(file, stamped);
      console.log(`Daté (${today}) : ${file}`);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1])) main();
