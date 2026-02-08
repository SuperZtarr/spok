/**
 * Load raw forum SQL dump into dedicated PostgreSQL tables
 * Tables: forum_raw_boards, forum_raw_categories, forum_raw_members, forum_raw_messages, forum_raw_topics
 *
 * Usage: DATABASE_URL="..." pnpm exec tsx apps/api/scripts/load-forum-raw.ts
 */

import fs from 'fs';
import { PrismaClient } from '@spok/database';

const prisma = new PrismaClient({ log: [] });

const SQL_FILE = 'C:/_dev/spok/_archive/superzta_forum_gbk.sql';

// ── SQL Parser (robust, handles escaped quotes in strings) ──

function parseSqlString(sql: string, pos: number): [string, number] {
  if (sql[pos] !== "'") throw new Error(`Expected ' at pos ${pos}`);
  let result = '';
  let i = pos + 1;
  while (i < sql.length) {
    if (sql[i] === '\\') {
      i++;
      if (i < sql.length) {
        if (sql[i] === 'n') result += '\n';
        else if (sql[i] === 'r') result += '\r';
        else if (sql[i] === 't') result += '\t';
        else if (sql[i] === '0') result += '\0';
        else result += sql[i];
      }
      i++;
    } else if (sql[i] === "'" && i + 1 < sql.length && sql[i + 1] === "'") {
      result += "'";
      i += 2;
    } else if (sql[i] === "'") {
      return [result, i + 1];
    } else {
      result += sql[i];
      i++;
    }
  }
  return [result, i];
}

function parseSqlValue(sql: string, pos: number): [string | null, number] {
  while (pos < sql.length && (sql[pos] === ' ' || sql[pos] === '\t' || sql[pos] === '\n' || sql[pos] === '\r')) pos++;
  if (pos >= sql.length) return ['', pos];

  if (sql[pos] === "'") return parseSqlString(sql, pos);

  if (sql.substring(pos, pos + 4).toUpperCase() === 'NULL') return [null, pos + 4];

  if (sql[pos] === '0' && pos + 1 < sql.length && sql[pos + 1] === 'x') {
    let end = pos + 2;
    while (end < sql.length && /[0-9a-fA-F]/.test(sql[end])) end++;
    return [sql.substring(pos, end), end];
  }

  let end = pos;
  while (end < sql.length && sql[end] !== ',' && sql[end] !== ')') end++;
  return [sql.substring(pos, end).trim(), end];
}

function parseSqlRecord(sql: string, startPos: number): [Array<string | null>, number] {
  let pos = startPos;
  while (pos < sql.length && sql[pos] !== '(') pos++;
  if (pos >= sql.length) return [[], pos];
  pos++;

  const values: Array<string | null> = [];
  while (pos < sql.length) {
    while (pos < sql.length && (sql[pos] === ' ' || sql[pos] === '\t' || sql[pos] === '\n' || sql[pos] === '\r')) pos++;
    if (sql[pos] === ')') { pos++; break; }

    const [val, newPos] = parseSqlValue(sql, pos);
    values.push(val);
    pos = newPos;

    while (pos < sql.length && (sql[pos] === ' ' || sql[pos] === '\t' || sql[pos] === '\n' || sql[pos] === '\r')) pos++;
    if (sql[pos] === ',') pos++;
  }

  return [values, pos];
}

function parseAllRecords(sql: string, tableName: string): Array<Array<string | null>> {
  const records: Array<Array<string | null>> = [];
  const insertPrefix = `INSERT INTO \`${tableName}\``;

  let searchPos = 0;
  while (true) {
    const idx = sql.indexOf(insertPrefix, searchPos);
    if (idx === -1) break;

    const valuesIdx = sql.indexOf('VALUES', idx);
    if (valuesIdx === -1) break;

    let pos = valuesIdx + 6;
    while (pos < sql.length) {
      while (pos < sql.length && sql[pos] !== '(' && sql[pos] !== ';') pos++;
      if (pos >= sql.length || sql[pos] === ';') break;

      const [record, newPos] = parseSqlRecord(sql, pos);
      if (record.length > 0) records.push(record);
      pos = newPos;

      while (pos < sql.length && sql[pos] !== '(' && sql[pos] !== ';' && sql[pos] !== 'I') pos++;
      if (pos >= sql.length || sql[pos] === ';' || sql[pos] === 'I') break;
    }
    searchPos = pos;
  }

  return records;
}

// ── Helper: escape for raw SQL ──
function esc(v: string | null): string {
  if (v === null) return 'NULL';
  return "'" + v.replace(/'/g, "''").replace(/\\/g, '\\\\').replace(/\0/g, '') + "'";
}
function num(v: string | null, def = 0): string {
  if (v === null) return String(def);
  const n = Number(v);
  return isNaN(n) ? String(def) : String(n);
}

// ── Table creation ──

async function createTables() {
  const drops = [
    'DROP TABLE IF EXISTS forum_raw_messages CASCADE',
    'DROP TABLE IF EXISTS forum_raw_topics CASCADE',
    'DROP TABLE IF EXISTS forum_raw_members CASCADE',
    'DROP TABLE IF EXISTS forum_raw_boards CASCADE',
    'DROP TABLE IF EXISTS forum_raw_categories CASCADE',
  ];
  for (const q of drops) await prisma.$executeRawUnsafe(q);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE forum_raw_categories (
      id_cat INTEGER PRIMARY KEY,
      cat_order INTEGER NOT NULL DEFAULT 0,
      name VARCHAR(255) NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      can_collapse INTEGER NOT NULL DEFAULT 1
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE forum_raw_boards (
      id_board INTEGER PRIMARY KEY,
      id_cat INTEGER NOT NULL DEFAULT 0,
      child_level INTEGER NOT NULL DEFAULT 0,
      id_parent INTEGER NOT NULL DEFAULT 0,
      board_order INTEGER NOT NULL DEFAULT 0,
      id_last_msg INTEGER NOT NULL DEFAULT 0,
      id_msg_updated INTEGER NOT NULL DEFAULT 0,
      member_groups TEXT NOT NULL DEFAULT '',
      id_profile INTEGER NOT NULL DEFAULT 1,
      name VARCHAR(255) NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      num_topics INTEGER NOT NULL DEFAULT 0,
      num_posts INTEGER NOT NULL DEFAULT 0,
      count_posts INTEGER NOT NULL DEFAULT 0,
      id_theme INTEGER NOT NULL DEFAULT 0,
      override_theme INTEGER NOT NULL DEFAULT 0,
      unapproved_posts INTEGER NOT NULL DEFAULT 0,
      unapproved_topics INTEGER NOT NULL DEFAULT 0,
      redirect VARCHAR(255) NOT NULL DEFAULT '',
      deny_member_groups TEXT NOT NULL DEFAULT ''
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE forum_raw_members (
      id_member INTEGER PRIMARY KEY,
      member_name VARCHAR(80) NOT NULL DEFAULT '',
      date_registered BIGINT NOT NULL DEFAULT 0,
      posts INTEGER NOT NULL DEFAULT 0,
      id_group INTEGER NOT NULL DEFAULT 0,
      lngfile VARCHAR(255) NOT NULL DEFAULT '',
      last_login BIGINT NOT NULL DEFAULT 0,
      real_name VARCHAR(255) NOT NULL DEFAULT '',
      instant_messages INTEGER NOT NULL DEFAULT 0,
      unread_messages INTEGER NOT NULL DEFAULT 0,
      new_pm INTEGER NOT NULL DEFAULT 0,
      alerts INTEGER NOT NULL DEFAULT 0,
      buddy_list TEXT NOT NULL DEFAULT '',
      pm_ignore_list TEXT,
      pm_prefs INTEGER NOT NULL DEFAULT 0,
      mod_prefs VARCHAR(20) NOT NULL DEFAULT '',
      passwd VARCHAR(64) NOT NULL DEFAULT '',
      email_address VARCHAR(255) NOT NULL DEFAULT '',
      personal_text VARCHAR(255) NOT NULL DEFAULT '',
      birthdate VARCHAR(20) NOT NULL DEFAULT '',
      website_title VARCHAR(255) NOT NULL DEFAULT '',
      website_url VARCHAR(255) NOT NULL DEFAULT '',
      show_online INTEGER NOT NULL DEFAULT 1,
      time_format VARCHAR(80) NOT NULL DEFAULT '',
      signature TEXT NOT NULL DEFAULT '',
      time_offset REAL NOT NULL DEFAULT 0,
      avatar VARCHAR(255) NOT NULL DEFAULT '',
      usertitle VARCHAR(255) NOT NULL DEFAULT '',
      member_ip VARCHAR(100) DEFAULT NULL,
      member_ip2 VARCHAR(100) DEFAULT NULL,
      secret_question VARCHAR(255) NOT NULL DEFAULT '',
      secret_answer VARCHAR(64) NOT NULL DEFAULT '',
      id_theme INTEGER NOT NULL DEFAULT 0,
      is_activated INTEGER NOT NULL DEFAULT 1,
      validation_code VARCHAR(10) NOT NULL DEFAULT '',
      id_msg_last_visit INTEGER NOT NULL DEFAULT 0,
      additional_groups VARCHAR(255) NOT NULL DEFAULT '',
      smiley_set VARCHAR(48) NOT NULL DEFAULT '',
      id_post_group INTEGER NOT NULL DEFAULT 0,
      total_time_logged_in INTEGER NOT NULL DEFAULT 0,
      password_salt VARCHAR(255) NOT NULL DEFAULT '',
      ignore_boards TEXT NOT NULL DEFAULT '',
      warning INTEGER NOT NULL DEFAULT 0,
      passwd_flood VARCHAR(12) NOT NULL DEFAULT '',
      pm_receive_from INTEGER NOT NULL DEFAULT 1,
      timezone VARCHAR(80) NOT NULL DEFAULT '',
      tfa_secret VARCHAR(24) NOT NULL DEFAULT '',
      tfa_backup VARCHAR(64) NOT NULL DEFAULT ''
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE forum_raw_messages (
      id_msg INTEGER PRIMARY KEY,
      id_topic INTEGER NOT NULL DEFAULT 0,
      id_board INTEGER NOT NULL DEFAULT 0,
      poster_time BIGINT NOT NULL DEFAULT 0,
      id_member INTEGER NOT NULL DEFAULT 0,
      id_msg_modified INTEGER NOT NULL DEFAULT 0,
      subject VARCHAR(255) NOT NULL DEFAULT '',
      poster_name VARCHAR(255) NOT NULL DEFAULT '',
      poster_email VARCHAR(255) NOT NULL DEFAULT '',
      poster_ip VARCHAR(100) DEFAULT NULL,
      smileys_enabled INTEGER NOT NULL DEFAULT 1,
      modified_time BIGINT NOT NULL DEFAULT 0,
      modified_name VARCHAR(255) NOT NULL DEFAULT '',
      modified_reason TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      icon VARCHAR(16) NOT NULL DEFAULT '',
      approved INTEGER NOT NULL DEFAULT 1,
      likes INTEGER NOT NULL DEFAULT 0
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE forum_raw_topics (
      id_topic INTEGER PRIMARY KEY,
      is_sticky INTEGER NOT NULL DEFAULT 0,
      id_board INTEGER NOT NULL DEFAULT 0,
      id_first_msg INTEGER NOT NULL DEFAULT 0,
      id_last_msg INTEGER NOT NULL DEFAULT 0,
      id_member_started INTEGER NOT NULL DEFAULT 0,
      id_member_updated INTEGER NOT NULL DEFAULT 0,
      id_poll INTEGER NOT NULL DEFAULT 0,
      id_previous_board INTEGER NOT NULL DEFAULT 0,
      id_previous_topic INTEGER NOT NULL DEFAULT 0,
      num_replies INTEGER NOT NULL DEFAULT 0,
      num_views INTEGER NOT NULL DEFAULT 0,
      locked INTEGER NOT NULL DEFAULT 0,
      redirect_expires INTEGER NOT NULL DEFAULT 0,
      id_redirect_topic INTEGER NOT NULL DEFAULT 0,
      unapproved_posts INTEGER NOT NULL DEFAULT 0,
      approved INTEGER NOT NULL DEFAULT 1
    )
  `);

  console.log('Tables created.');
}

// ── Batch insertion using raw SQL VALUES ──

async function batchInsert(table: string, columns: string[], rows: string[][], batchSize = 500) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const valuesClauses = batch.map(r => `(${r.join(',')})`).join(',\n');
    const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${valuesClauses} ON CONFLICT DO NOTHING`;
    try {
      await prisma.$executeRawUnsafe(sql);
      inserted += batch.length;
    } catch (err: any) {
      // Fallback: insert one by one
      for (const r of batch) {
        try {
          await prisma.$executeRawUnsafe(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${r.join(',')}) ON CONFLICT DO NOTHING`);
          inserted++;
        } catch (e2: any) {
          console.error(`  Error in ${table}: ${e2.message?.substring(0, 120)}`);
        }
      }
    }
    if ((i + batchSize) % 5000 < batchSize) {
      process.stdout.write(`  ${Math.min(i + batchSize, rows.length)}/${rows.length}...\r`);
    }
  }
  return inserted;
}

// ── Data loading ──

async function loadCategories(sql: string) {
  const records = parseAllRecords(sql, 'gbk_categories');
  console.log(`Categories: ${records.length} records parsed`);
  const rows = records.map(r => [num(r[0]), num(r[1]), esc(r[2]), esc(r[3]), num(r[4])]);
  const n = await batchInsert('forum_raw_categories', ['id_cat','cat_order','name','description','can_collapse'], rows);
  console.log(`  → ${n} inserted`);
}

async function loadBoards(sql: string) {
  const records = parseAllRecords(sql, 'gbk_boards');
  console.log(`Boards: ${records.length} records parsed`);
  const cols = ['id_board','id_cat','child_level','id_parent','board_order','id_last_msg','id_msg_updated','member_groups','id_profile','name','description','num_topics','num_posts','count_posts','id_theme','override_theme','unapproved_posts','unapproved_topics','redirect','deny_member_groups'];
  const rows = records.map(r => [
    num(r[0]), num(r[1]), num(r[2]), num(r[3]), num(r[4]), num(r[5]), num(r[6]), esc(r[7]),
    num(r[8]), esc(r[9]), esc(r[10]), num(r[11]), num(r[12]), num(r[13]), num(r[14]), num(r[15]),
    num(r[16]), num(r[17]), esc(r[18]), esc(r[19])
  ]);
  const n = await batchInsert('forum_raw_boards', cols, rows);
  console.log(`  → ${n} inserted`);
}

async function loadMembers(sql: string) {
  const records = parseAllRecords(sql, 'gbk_members');
  console.log(`Members: ${records.length} records parsed`);
  const cols = ['id_member','member_name','date_registered','posts','id_group','lngfile','last_login','real_name',
    'instant_messages','unread_messages','new_pm','alerts','buddy_list','pm_ignore_list','pm_prefs','mod_prefs',
    'passwd','email_address','personal_text','birthdate','website_title','website_url','show_online','time_format',
    'signature','time_offset','avatar','usertitle','member_ip','member_ip2','secret_question','secret_answer',
    'id_theme','is_activated','validation_code','id_msg_last_visit','additional_groups','smiley_set','id_post_group',
    'total_time_logged_in','password_salt','ignore_boards','warning','passwd_flood','pm_receive_from','timezone','tfa_secret','tfa_backup'];
  const rows = records.map(r => [
    num(r[0]), esc(r[1]), num(r[2]), num(r[3]), num(r[4]), esc(r[5]), num(r[6]), esc(r[7]),
    num(r[8]), num(r[9]), num(r[10]), num(r[11]), esc(r[12]), esc(r[13]), num(r[14]), esc(r[15]),
    esc(r[16]), esc(r[17]), esc(r[18]), esc(r[19]), esc(r[20]), esc(r[21]), num(r[22]), esc(r[23]),
    esc(r[24]), num(r[25]), esc(r[26]), esc(r[27]), esc(r[28]), esc(r[29]), esc(r[30]), esc(r[31]),
    num(r[32]), num(r[33]), esc(r[34]), num(r[35]), esc(r[36]), esc(r[37]), num(r[38]),
    num(r[39]), esc(r[40]), esc(r[41]), num(r[42]), esc(r[43]), num(r[44]), esc(r[45]), esc(r[46]), esc(r[47])
  ]);
  const n = await batchInsert('forum_raw_members', cols, rows);
  console.log(`  → ${n} inserted`);
}

async function loadMessages(sql: string) {
  const records = parseAllRecords(sql, 'gbk_messages');
  console.log(`Messages: ${records.length} records parsed`);
  const cols = ['id_msg','id_topic','id_board','poster_time','id_member','id_msg_modified','subject','poster_name','poster_email','poster_ip','smileys_enabled','modified_time','modified_name','modified_reason','body','icon','approved','likes'];
  const rows = records.map(r => [
    num(r[0]), num(r[1]), num(r[2]), num(r[3]), num(r[4]), num(r[5]), esc(r[6]), esc(r[7]),
    esc(r[8]), esc(r[9]), num(r[10]), num(r[11]), esc(r[12]), esc(r[13]), esc(r[14]), esc(r[15]),
    num(r[16]), num(r[17])
  ]);
  const n = await batchInsert('forum_raw_messages', cols, rows, 200);
  console.log(`\n  → ${n} inserted`);
}

async function loadTopics(sql: string) {
  const records = parseAllRecords(sql, 'gbk_topics');
  console.log(`Topics: ${records.length} records parsed`);
  const cols = ['id_topic','is_sticky','id_board','id_first_msg','id_last_msg','id_member_started','id_member_updated','id_poll','id_previous_board','id_previous_topic','num_replies','num_views','locked','redirect_expires','id_redirect_topic','unapproved_posts','approved'];
  const rows = records.map(r => [
    num(r[0]), num(r[1]), num(r[2]), num(r[3]), num(r[4]), num(r[5]), num(r[6]), num(r[7]),
    num(r[8]), num(r[9]), num(r[10]), num(r[11]), num(r[12]), num(r[13]), num(r[14]), num(r[15]),
    num(r[16])
  ]);
  const n = await batchInsert('forum_raw_topics', cols, rows);
  console.log(`  → ${n} inserted`);
}

// ── Main ──

async function main() {
  console.log('Reading SQL file...');
  const sql = fs.readFileSync(SQL_FILE, 'utf-8');
  console.log(`File size: ${(sql.length / 1024 / 1024).toFixed(1)} MB`);

  console.log('\n1. Creating tables...');
  await createTables();

  console.log('\n2. Loading categories...');
  await loadCategories(sql);

  console.log('\n3. Loading boards...');
  await loadBoards(sql);

  console.log('\n4. Loading members...');
  await loadMembers(sql);

  console.log('\n5. Loading messages...');
  await loadMessages(sql);

  console.log('\n6. Loading topics...');
  await loadTopics(sql);

  // Summary
  console.log('\n── Summary ──');
  const counts = await Promise.all([
    prisma.$queryRawUnsafe<any[]>('SELECT count(*)::int as c FROM forum_raw_categories'),
    prisma.$queryRawUnsafe<any[]>('SELECT count(*)::int as c FROM forum_raw_boards'),
    prisma.$queryRawUnsafe<any[]>('SELECT count(*)::int as c FROM forum_raw_members'),
    prisma.$queryRawUnsafe<any[]>('SELECT count(*)::int as c FROM forum_raw_messages'),
    prisma.$queryRawUnsafe<any[]>('SELECT count(*)::int as c FROM forum_raw_topics'),
  ]);
  console.log(`Categories: ${counts[0][0].c}`);
  console.log(`Boards:     ${counts[1][0].c}`);
  console.log(`Members:    ${counts[2][0].c}`);
  console.log(`Messages:   ${counts[3][0].c}`);
  console.log(`Topics:     ${counts[4][0].c}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
