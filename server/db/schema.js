'use strict';

/**
 * Skema & akses database.
 *
 * Aplikasi ini MULTI-TENANT: satu database menampung banyak undangan
 * (tiap undangan = 1 "account" milik 1 client). Semua tabel konten punya
 * kolom `account_id` sebagai pemisah data (tenant key).
 *
 * CATATAN MIGRASI KE POSTGRES:
 * Semua SQL di aplikasi ditulis lewat helper di file ini + `db.prepare(...)`
 * bergaya better-sqlite3. Untuk pindah ke Postgres, cukup sediakan adapter
 * dengan API yang sama (prepare/run/get/all/exec/transaction/pragma) —
 * query-nya standar ANSI, hanya perlu ganti `?` -> `$1` dan AUTOINCREMENT,
 * atau pakai driver seperti `pg` + pg-promise dengan shim serupa.
 */

const path = require('path');
const fs = require('fs');
const { Database, client } = require('./index');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'wedding.db');
const db = client === 'postgres' || client === 'pg'
  ? new Database(process.env.DATABASE_URL)
  : new Database(DB_PATH);
if (client !== 'postgres' && client !== 'pg') {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
}

const IS_PG = client === 'postgres' || client === 'pg';

/**
 * Terjemahkan DDL/ekspresi bergaya SQLite menjadi Postgres.
 * Supaya DDL di bawah tetap satu sumber, cukup dijalankan lewat fungsi ini.
 */
function dialect(sql) {
  if (!IS_PG) return sql;
  return sql
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
    .replace(/datetime\('now'\)/g, 'now()')
    .replace(/\bTEXT\b/g, 'text')
    .replace(/\bINTEGER\b/g, 'integer');
}

function init() {
  db.exec(dialect(`
    -- ===================== OWNER (super admin / pemilik aplikasi) =====================
    CREATE TABLE IF NOT EXISTS owners (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TEXT DEFAULT (datetime('now'))
    );

    -- ===================== ACCOUNTS (client / pemesan undangan) =====================
    CREATE TABLE IF NOT EXISTS accounts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      slug          TEXT NOT NULL UNIQUE,       -- dipakai di URL /u/<slug>
      title         TEXT,                       -- label internal (mis. "Rizky & Amelia")
      password_hash TEXT NOT NULL,              -- password admin client
      status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
      plan          TEXT DEFAULT 'basic',
      theme         TEXT DEFAULT 'botanical',   -- template default yang dipilih owner
      max_guests    INTEGER DEFAULT 500,
      expires_at    TEXT,                       -- opsional: masa aktif langganan
      created_at    TEXT DEFAULT (datetime('now'))
    );

    -- ===================== CONTENT (per-account) =====================
    -- Data mempelai (1 baris per account)
    CREATE TABLE IF NOT EXISTS couple (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      groom_name TEXT NOT NULL DEFAULT '',
      groom_full TEXT,
      groom_ig   TEXT,
      groom_photo TEXT,
      groom_parents TEXT,
      bride_name TEXT NOT NULL DEFAULT '',
      bride_full TEXT,
      bride_ig   TEXT,
      bride_photo TEXT,
      bride_parents TEXT,
      love_story TEXT,
      UNIQUE (account_id)
    );

    -- Detail acara (bisa >1: akad, resepsi)
    CREATE TABLE IF NOT EXISTS events (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      key       TEXT NOT NULL,
      title     TEXT NOT NULL,
      date_iso  TEXT NOT NULL,
      time_text TEXT,
      venue     TEXT,
      address   TEXT,
      maps_url  TEXT,
      sort      INTEGER DEFAULT 0,
      UNIQUE (account_id, key)
    );

    -- Daftar tamu undangan (link personal)
    CREATE TABLE IF NOT EXISTS guests (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      slug       TEXT NOT NULL,
      name       TEXT NOT NULL,
      phone      TEXT,
      category   TEXT DEFAULT 'Tamu',
      quota      INTEGER DEFAULT 2,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE (account_id, slug)
    );

    -- RSVP / konfirmasi kehadiran
    CREATE TABLE IF NOT EXISTS rsvp (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      guest_id   INTEGER,
      name       TEXT NOT NULL,
      attendance TEXT NOT NULL CHECK (attendance IN ('hadir','tidak_hadir','ragu')),
      pax        INTEGER DEFAULT 1,
      message    TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL
    );

    -- Buku tamu / ucapan
    CREATE TABLE IF NOT EXISTS wishes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      guest_id   INTEGER,
      name       TEXT NOT NULL,
      message    TEXT NOT NULL,
      attending  TEXT DEFAULT 'hadir',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL
    );

    -- Galeri foto
    CREATE TABLE IF NOT EXISTS gallery (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      url      TEXT NOT NULL,
      caption  TEXT,
      sort     INTEGER DEFAULT 0
    );

    -- Amplop digital
    CREATE TABLE IF NOT EXISTS gifts (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      type      TEXT NOT NULL,
      bank_name TEXT,
      account_no TEXT,
      account_name TEXT,
      sort      INTEGER DEFAULT 0
    );

    -- Setelan umum per-account (key-value). Termasuk music_url & quote.
    -- Password client TIDAK disimpan di sini (ada di accounts.password_hash).
    CREATE TABLE IF NOT EXISTS settings (
      account_id INTEGER NOT NULL,
      key   TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (account_id, key)
    );

    -- Tema kustom per-account (modular).
    -- Kolom tokens menyimpan JSON berisi override CSS variable (warna, font, gambar).
    -- Contoh: {"--sage":"#7d8f6d","--gold":"#b08d47","--serif":"Lora, serif"}
    -- Tema kustom bisa diturunkan dari preset mana pun (kolom base).
    CREATE TABLE IF NOT EXISTS themes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      slug       TEXT NOT NULL,           -- id unik lokal (mis. "custom-teal")
      name       TEXT NOT NULL,           -- label yang dilihat client
      base       TEXT DEFAULT 'botanical',-- preset dasar saat membuat token
      tokens     TEXT NOT NULL DEFAULT '{}',
      is_custom  INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE (account_id, slug)
    );
  `));

  migrateLegacy();
}

/**
 * Migrasi dari skema single-tenant lama (kolom id=1 / tanpa account_id) ke
 * multi-tenant. Idempoten: aman dipanggil berkali-kali.
 *
 * Menangani dua kondisi:
 * 1. Tabel lama sudah ada tapi belum punya `account_id` -> tambahkan kolom &
 *    isi dengan account pertama.
 * 2. Belum ada account sama sekali tapi ada data lama -> buat account "demo"
 *    dan pindahkan datanya ke sana.
 */
function migrateLegacy() {
  // Migrasi ini khusus database SQLite versi lama. Untuk Postgres (instalasi
  // baru), lewati.
  if (IS_PG) return;

  const needsAccountId = (table) => {
    try {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
      return cols.length > 0 && !cols.includes('account_id');
    } catch {
      return false;
    }
  };

  const legacyTables = ['couple', 'events', 'guests', 'rsvp', 'wishes', 'gallery', 'gifts'];
  const anyLegacy = legacyTables.some(needsAccountId);

  const settingsNeedsAccount = (() => {
    try {
      const cols = db.prepare('PRAGMA table_info(settings)').all().map((c) => c.name);
      return cols.length > 0 && !cols.includes('account_id');
    } catch {
      return false;
    }
  })();

  if (!anyLegacy && !settingsNeedsAccount) return;

  console.log('ℹ️  Menjalankan migrasi single-tenant -> multi-tenant...');

  // Pastikan ada minimal 1 account sebagai penerima data lama.
  let first = db.prepare('SELECT id FROM accounts ORDER BY id LIMIT 1').get();
  if (!first) {
    const { hashPassword } = require('../security');
    const info = db
      .prepare(
        `INSERT INTO accounts (slug, title, password_hash, theme, status)
         VALUES (?, ?, ?, ?, 'active')`
      )
      .run('demo', 'Undangan Demo', hashPassword('admin123'), 'botanical');
    first = { id: Number(info.lastInsertRowid) };
    console.log(`   • Account "demo" dibuat (password client: admin123).`);
  }
  const accId = first.id;

  // Bangun ulang tabel lama -> baru dengan menambahkan account_id.
  const rebuild = (table, createSql, columnsToCopy) => {
    const oldName = `${table}_old`;
    db.exec(`ALTER TABLE ${table} RENAME TO ${oldName};`);
    db.exec(createSql);
    const copyCols = ['account_id', ...columnsToCopy].join(', ');
    db.exec(`INSERT INTO ${table} (${copyCols}) SELECT ${accId}, ${columnsToCopy.join(', ')} FROM ${oldName};`);
    db.exec(`DROP TABLE ${oldName};`);
  };

  if (needsAccountId('couple'))
    rebuild(
      'couple',
      `CREATE TABLE couple (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        groom_name TEXT NOT NULL DEFAULT '', groom_full TEXT, groom_ig TEXT, groom_photo TEXT, groom_parents TEXT,
        bride_name TEXT NOT NULL DEFAULT '', bride_full TEXT, bride_ig TEXT, bride_photo TEXT, bride_parents TEXT,
        love_story TEXT, UNIQUE (account_id));`,
      ['groom_name', 'groom_full', 'groom_ig', 'groom_photo', 'groom_parents', 'bride_name', 'bride_full', 'bride_ig', 'bride_photo', 'bride_parents', 'love_story']
    );

  if (needsAccountId('events'))
    rebuild(
      'events',
      `CREATE TABLE events (
        id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL,
        key TEXT NOT NULL, title TEXT NOT NULL, date_iso TEXT NOT NULL, time_text TEXT,
        venue TEXT, address TEXT, maps_url TEXT, sort INTEGER DEFAULT 0, UNIQUE (account_id, key));`,
      ['key', 'title', 'date_iso', 'time_text', 'venue', 'address', 'maps_url', 'sort']
    );

  if (needsAccountId('guests'))
    rebuild(
      'guests',
      `CREATE TABLE guests (
        id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL,
        slug TEXT NOT NULL, name TEXT NOT NULL, phone TEXT, category TEXT DEFAULT 'Tamu',
        quota INTEGER DEFAULT 2, created_at TEXT DEFAULT (datetime('now')), UNIQUE (account_id, slug));`,
      ['slug', 'name', 'phone', 'category', 'quota', 'created_at']
    );

  if (needsAccountId('rsvp'))
    rebuild(
      'rsvp',
      `CREATE TABLE rsvp (
        id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL, guest_id INTEGER,
        name TEXT NOT NULL, attendance TEXT NOT NULL CHECK (attendance IN ('hadir','tidak_hadir','ragu')),
        pax INTEGER DEFAULT 1, message TEXT, created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL);`,
      ['guest_id', 'name', 'attendance', 'pax', 'message', 'created_at']
    );

  if (needsAccountId('wishes'))
    rebuild(
      'wishes',
      `CREATE TABLE wishes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL, guest_id INTEGER,
        name TEXT NOT NULL, message TEXT NOT NULL, attending TEXT DEFAULT 'hadir',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL);`,
      ['guest_id', 'name', 'message', 'attending', 'created_at']
    );

  if (needsAccountId('gallery'))
    rebuild(
      'gallery',
      `CREATE TABLE gallery (
        id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL,
        url TEXT NOT NULL, caption TEXT, sort INTEGER DEFAULT 0);`,
      ['url', 'caption', 'sort']
    );

  if (needsAccountId('gifts'))
    rebuild(
      'gifts',
      `CREATE TABLE gifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL,
        type TEXT NOT NULL, bank_name TEXT, account_no TEXT, account_name TEXT, sort INTEGER DEFAULT 0);`,
      ['type', 'bank_name', 'account_no', 'account_name', 'sort']
    );

  // settings: pindahkan music_url/quote ke account, BUANG admin_password lama
  // (diganti accounts.password_hash). Tabel lama dibangun ulang agar punya
  // kolom account_id pada PRIMARY KEY.
  if (settingsNeedsAccount) {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    db.exec('ALTER TABLE settings RENAME TO settings_old;');
    db.exec(`CREATE TABLE settings (
      account_id INTEGER NOT NULL, key TEXT NOT NULL, value TEXT,
      PRIMARY KEY (account_id, key));`);
    db.exec('DROP TABLE settings_old;');
    const ins = db.prepare('INSERT OR REPLACE INTO settings (account_id, key, value) VALUES (?, ?, ?)');
    rows.forEach((r) => {
      if (r.key === 'admin_password') return; // tidak dipakai lagi
      ins.run(accId, r.key, r.value);
    });
  }

  console.log('✅ Migrasi multi-tenant selesai.');
}

init();

/** Ambil account berdasarkan slug (case-insensitive). */
function getAccountBySlug(slug) {
  return db.prepare('SELECT * FROM accounts WHERE slug = ?').get(String(slug || '').toLowerCase().trim()) || null;
}

function getAccountById(id) {
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) || null;
}

/** Ambil semua tema kustom milik satu account. */
function getCustomThemes(accountId) {
  const rows = db.prepare('SELECT id, slug, name, base, tokens FROM themes WHERE account_id = ? ORDER BY created_at').all(accountId);
  return rows.map((r) => {
    let tokens = {};
    try { tokens = JSON.parse(r.tokens || '{}'); } catch { tokens = {}; }
    return { ...r, tokens };
  });
}

module.exports = { db, init, DB_PATH, getAccountBySlug, getAccountById, getCustomThemes, client };
