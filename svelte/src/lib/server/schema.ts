/**
 * schema.ts — DDL PostgreSQL (multi-tenant) + inisialisasi otomatis.
 *
 * Versi Postgres murni dari server/db/schema.js. Tidak ada lagi `?` gaya SQLite
 * maupun AUTOINCREMENT — semua BIGSERIAL/`now()`.
 *
 * Pemanggilan `ensureSchema()` bersifat idempoten (CREATE TABLE IF NOT EXISTS).
 */
import { pool, SCHEMA } from './db';

const DDL = `
-- ===================== OWNER (super admin / pemilik aplikasi) =====================
CREATE TABLE IF NOT EXISTS owners (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ===================== ACCOUNTS (client / pemesan undangan) =====================
CREATE TABLE IF NOT EXISTS accounts (
  id            BIGSERIAL PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT,
  password_hash TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  plan          TEXT DEFAULT 'basic',
  theme         TEXT DEFAULT 'botanical',
  max_guests    INTEGER DEFAULT 500,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ===================== CONTENT (per-account) =====================
CREATE TABLE IF NOT EXISTS couple (
  id            BIGSERIAL PRIMARY KEY,
  account_id    BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  groom_name    TEXT NOT NULL DEFAULT '',
  groom_full    TEXT,
  groom_ig      TEXT,
  groom_photo   TEXT,
  groom_parents TEXT,
  bride_name    TEXT NOT NULL DEFAULT '',
  bride_full    TEXT,
  bride_ig      TEXT,
  bride_photo   TEXT,
  bride_parents TEXT,
  love_story    TEXT,
  UNIQUE (account_id)
);

CREATE TABLE IF NOT EXISTS events (
  id        BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS guests (
  id         BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slug       TEXT NOT NULL,
  name       TEXT NOT NULL,
  phone      TEXT,
  category   TEXT DEFAULT 'Tamu',
  quota      INTEGER DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (account_id, slug)
);

CREATE TABLE IF NOT EXISTS rsvp (
  id         BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  guest_id   BIGINT REFERENCES guests(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  attendance TEXT NOT NULL CHECK (attendance IN ('hadir','tidak_hadir','ragu')),
  pax        INTEGER DEFAULT 1,
  message    TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wishes (
  id         BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  guest_id   BIGINT REFERENCES guests(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  message    TEXT NOT NULL,
  attending  TEXT DEFAULT 'hadir',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gallery (
  id       BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  url      TEXT NOT NULL,
  caption  TEXT,
  sort     INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gifts (
  id        BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type      TEXT NOT NULL,
  bank_name TEXT,
  account_no TEXT,
  account_name TEXT,
  sort      INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  key   TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (account_id, key)
);

CREATE TABLE IF NOT EXISTS themes (
  id         BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slug       TEXT NOT NULL,
  name       TEXT NOT NULL,
  base       TEXT DEFAULT 'botanical',
  tokens     TEXT NOT NULL DEFAULT '{}',
  is_custom  INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (account_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_couple_account ON couple(account_id);
CREATE INDEX IF NOT EXISTS idx_events_account ON events(account_id);
CREATE INDEX IF NOT EXISTS idx_guests_account ON guests(account_id);
CREATE INDEX IF NOT EXISTS idx_rsvp_account ON rsvp(account_id);
CREATE INDEX IF NOT EXISTS idx_wishes_account ON wishes(account_id);
CREATE INDEX IF NOT EXISTS idx_gallery_account ON gallery(account_id);
CREATE INDEX IF NOT EXISTS idx_gifts_account ON gifts(account_id);
CREATE INDEX IF NOT EXISTS idx_themes_account ON themes(account_id);
`;

let initialized = false;

/** Buat schema & tabel bila belum ada (idempoten). Dipanggil sekali per proses. */
export async function ensureSchema(): Promise<void> {
	if (initialized) return;
	// 1) Buat schema aplikasi bila belum ada (vibe punya db_create).
	await pool.query(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`);
	// 2) DDL tabel, dibungkus agar search_path pasti benar.
	await pool.query(`SET search_path TO "${SCHEMA}", public`);
	await pool.query(DDL);
	initialized = true;
}
