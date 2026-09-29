'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'wedding.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function init() {
  db.exec(`
    -- Data mempelai
    CREATE TABLE IF NOT EXISTS couple (
      id         INTEGER PRIMARY KEY CHECK (id = 1),
      groom_name TEXT NOT NULL,
      groom_full TEXT,
      groom_ig   TEXT,
      groom_photo TEXT,
      groom_parents TEXT,
      bride_name TEXT NOT NULL,
      bride_full TEXT,
      bride_ig   TEXT,
      bride_photo TEXT,
      bride_parents TEXT,
      love_story TEXT
    );

    -- Detail acara (bisa >1: akad, resepsi)
    CREATE TABLE IF NOT EXISTS events (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      key       TEXT NOT NULL UNIQUE,
      title     TEXT NOT NULL,
      date_iso  TEXT NOT NULL,
      time_text TEXT,
      venue     TEXT,
      address   TEXT,
      maps_url  TEXT,
      sort      INTEGER DEFAULT 0
    );

    -- Daftar tamu undangan (link personal)
    CREATE TABLE IF NOT EXISTS guests (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      slug       TEXT NOT NULL UNIQUE,
      name       TEXT NOT NULL,
      phone      TEXT,
      category   TEXT DEFAULT 'Tamu',
      quota      INTEGER DEFAULT 2,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- RSVP / konfirmasi kehadiran
    CREATE TABLE IF NOT EXISTS rsvp (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
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
      url      TEXT NOT NULL,
      caption  TEXT,
      sort     INTEGER DEFAULT 0
    );

    -- Amplop digital
    CREATE TABLE IF NOT EXISTS gifts (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      type      TEXT NOT NULL,
      bank_name TEXT,
      account_no TEXT,
      account_name TEXT,
      sort      INTEGER DEFAULT 0
    );

    -- Setelan umum (satu baris key-value)
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // ---- migrasi ringan: tambah kolom kalau belum ada ----
  const cols = db.prepare('PRAGMA table_info(couple)').all().map((c) => c.name);
  if (!cols.includes('groom_photo')) db.exec('ALTER TABLE couple ADD COLUMN groom_photo TEXT');
  if (!cols.includes('bride_photo')) db.exec('ALTER TABLE couple ADD COLUMN bride_photo TEXT');
}

init();

module.exports = { db, init, DB_PATH };
