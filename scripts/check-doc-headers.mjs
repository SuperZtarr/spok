/*
 * Contrôle documentation avant mep (cf. skill spok-deploy) : vérifie que chaque fichier
 * source créé/modifié à pousser commence par un commentaire d'en-tête (règle CLAUDE.md
 * "Documentation dans le code"). Échoue (exit 1) en listant les fichiers non documentés.
 * Usage : node scripts/check-doc-headers.mjs [ref-de-base]   (défaut : origin/master)
 * Périmètre : .ts/.tsx/.mjs dans apps/ et packages/ — diff base...HEAD + fichiers modifiés non commités.
 */
import { execFileSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';

const base = process.argv[2] || 'origin/master';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).split('\n').map(s => s.trim()).filter(Boolean);

const committed = git('diff', '--name-only', `${base}...HEAD`);
const working = git('diff', '--name-only', 'HEAD').concat(git('diff', '--name-only', '--cached'));
const files = [...new Set([...committed, ...working])]
  .filter(f => /^(apps|packages)\/.*\.(ts|tsx|mjs)$/.test(f))
  .filter(f => !/\.d\.ts$/.test(f) && !/dist\//.test(f));

const missing = [];
for (const f of files) {
  if (!existsSync(f)) continue; // fichier supprimé
  const head = readFileSync(f, 'utf8').trimStart();
  if (!head.startsWith('/*') && !head.startsWith('//')) missing.push(f);
}

if (missing.length) {
  console.log('❌ Fichiers modifiés sans commentaire d\'en-tête :');
  for (const f of missing) console.log('   -', f);
  console.log(`\n${missing.length} fichier(s) à documenter avant le mep (règle CLAUDE.md).`);
  process.exit(1);
}
console.log(`✅ Documentation OK — ${files.length} fichier(s) source vérifiés.`);
