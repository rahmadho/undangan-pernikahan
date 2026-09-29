'use strict';

/**
 * Server Express multi-tenant.
 *
 * Rute utama:
 *   /                       -> halaman depan (daftar/redirect ke demo)
 *   /u/:slug                -> halaman undangan client
 *   /u/:slug/admin          -> dashboard admin client
 *   /owner                  -> dashboard super admin (pemilik aplikasi)
 *
 * Autentikasi:
 *   - Client  : header `x-account` (slug) + `x-admin-password`
 *   - Owner   : header `x-owner-password`
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

// Muat variabel .env LEBIH DULU sebelum modul lain membaca process.env
// (mis. pemilih backend DB di server/db/index.js).
require('./env').loadEnv();

const { db, getAccountBySlug, getAccountById } = require('./db/schema');
const { seed, createAccount, ensureOwner } = require('./db/seed');
const { hashPassword, verifyPassword, rateLimit, securityHeaders } = require('./security');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));

// ---------- health check (untuk load balancer / platform hosting) ----------
app.get('/healthz', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', db: process.env.DB_CLIENT || 'sqlite', uptime: Math.round(process.uptime()) });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

// ---------- security headers ----------
app.use(securityHeaders());

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true }));

// ---------- batas panjang input ----------
const LIMITS = { name: 80, message: 500, quote: 1000, url: 500 };

// ---------- rate limiters ----------
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Terlalu banyak permintaan. Silakan coba lagi sebentar lagi.',
});
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  message: 'Terlalu banyak kirim data. Silakan coba lagi sebentar lagi.',
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Terlalu banyak percobaan login. Coba lagi nanti.',
});

// ---------- helpers ----------
const slugify = (s) =>
  String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const wrap = (fn) => (req, res, next) => {
  try {
    fn(req, res, next);
  } catch (err) {
    next(err);
  }
};

const clampStr = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const tooLong = (v, max) => String(v == null ? '' : v).trim().length > max;

/** Ambil settings (key-value) milik satu account. */
function getSettings(accountId) {
  const rows = db.prepare('SELECT key, value FROM settings WHERE account_id = ?').all(accountId);
  const out = {};
  rows.forEach((r) => (out[r.key] = r.value));
  return out;
}

function publicSettings(account) {
  const s = getSettings(account.id || account);
  return { music_url: s.music_url || '', quote: s.quote || '', theme: account.theme || 'botanical' };
}

/**
 * Cari account dari request. Urutan: header x-account, param :slug, query ?account,
 * atau body.account. Mengembalikan row account atau null.
 */
function resolveAccount(req) {
  const slug = req.headers['x-account'] || req.params.slug || req.query.account || (req.body && req.body.account);
  if (!slug) return null;
  return getAccountBySlug(String(slug));
}

/**
 * Cek status siklus hidup account.
 * Mengembalikan { ok, code, reason }.
 *   - ok=false + reason 'suspended' -> dinonaktifkan owner
 *   - ok=false + reason 'expired'   -> masa aktif habis (expires_at < hari ini)
 * Bila expires_at kosong, dianggap tanpa batas waktu.
 */
function accountLifecycle(account) {
  if (!account) return { ok: false, reason: 'not_found' };
  if (account.status !== 'active') return { ok: false, reason: 'suspended' };
  if (account.expires_at) {
    const end = new Date(String(account.expires_at).slice(0, 10) + 'T23:59:59');
    if (!Number.isNaN(end.getTime()) && end.getTime() < Date.now()) return { ok: false, reason: 'expired' };
  }
  return { ok: true, reason: null };
}

/**
 * Normalisasi masa aktif (expires_at).
 * - Bila `expires_at` (YYYY-MM-DD) diberikan, pakai itu.
 * - Selain itu, bila `days` > 0, hitung dari hari ini.
 * Mengembalikan string 'YYYY-MM-DD' atau null.
 */
function normalizeExpiry(expiresAt, days) {
  if (expiresAt) {
    const s = String(expiresAt).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  const d = parseInt(days, 10);
  if (Number.isFinite(d) && d > 0) {
    const dt = new Date(Date.now() + d * 86400000);
    return dt.toISOString().slice(0, 10);
  }
  return null;
}

/** Middleware: pastikan ada account dan masa aktifnya masih berlaku. */
function requireAccount(req, res, next) {
  const account = resolveAccount(req);
  if (!account) return res.status(404).json({ error: 'Undangan tidak ditemukan.' });
  const life = accountLifecycle(account);
  if (!life.ok) {
    const msg = life.reason === 'expired'
      ? 'Masa aktif undangan ini telah berakhir.'
      : 'Undangan tidak aktif.';
    return res.status(403).json({ error: msg, reason: life.reason });
  }
  req.account = account;
  next();
}

/** Middleware: pastikan password admin account benar (masa aktif dicek). */
function requireAccountAdmin(req, res, next) {
  const account = resolveAccount(req);
  if (!account) return res.status(404).json({ error: 'Undangan tidak ditemukan.' });
  const pass = req.headers['x-admin-password'] || (req.body && req.body.password) || req.query.password;
  const { ok } = verifyPassword(pass, account.password_hash);
  if (!ok) return res.status(401).json({ error: 'Password admin salah.' });
  // Client tetap boleh LOGIN saat expired (agar bisa lihat pesan & hubungi owner),
  // tapi hanya endpoint non-tulis. Endpoint tulis memakai requireAccountActive.
  req.account = account;
  next();
}

/** Middleware: client admin + masa aktif harus berlaku (untuk aksi tulis). */
function requireAccountActive(req, res, next) {
  requireAccountAdmin(req, res, () => {
    const life = accountLifecycle(req.account);
    if (!life.ok) {
      const msg = life.reason === 'expired'
        ? 'Masa aktif undangan telah berakhir. Hubungi penyedia untuk memperpanjang.'
        : 'Undangan sedang dinonaktifkan.';
      return res.status(403).json({ error: msg, reason: life.reason });
    }
    next();
  });
}

/** Middleware: pastikan password owner (super admin) benar. */
function requireOwner(req, res, next) {
  const owners = db.prepare('SELECT * FROM owners').all();
  if (!owners.length) return res.status(401).json({ error: 'Belum ada owner. Jalankan seed.' });
  const pass = req.headers['x-owner-password'] || (req.body && req.body.owner_password) || req.query.owner_password;
  const match = owners.find((o) => verifyPassword(pass, o.password_hash).ok);
  if (!match) return res.status(401).json({ error: 'Password owner salah.' });
  req.owner = match;
  next();
}

// =====================================================================
//  PUBLIC API (per-account)
// =====================================================================

// Semua data yang dibutuhkan halaman undangan dalam satu request
app.get(
  '/api/invitation',
  publicLimiter,
  requireAccount,
  wrap((req, res) => {
    const id = req.account.id;
    const couple = db.prepare('SELECT * FROM couple WHERE account_id = ?').get(id) || null;
    const events = db.prepare('SELECT * FROM events WHERE account_id = ? ORDER BY sort, date_iso').all(id);
    const gallery = db.prepare('SELECT * FROM gallery WHERE account_id = ? ORDER BY sort').all(id);
    const gifts = db.prepare('SELECT id, type, bank_name, account_no, account_name FROM gifts WHERE account_id = ? ORDER BY sort').all(id);
    const wishes = db
      .prepare('SELECT id, name, message, attending, created_at FROM wishes WHERE account_id = ? ORDER BY created_at DESC LIMIT 100')
      .all(id);
    const stats = {
      hadir: db.prepare("SELECT COALESCE(SUM(pax),0) AS n FROM rsvp WHERE account_id = ? AND attendance='hadir'").get(id).n,
      undangan: db.prepare('SELECT COUNT(*) AS n FROM guests WHERE account_id = ?').get(id).n,
      ucapan: db.prepare('SELECT COUNT(*) AS n FROM wishes WHERE account_id = ?').get(id).n,
    };
    res.json({
      account: { slug: req.account.slug, title: req.account.title, theme: req.account.theme },
      couple,
      events,
      gallery,
      gifts,
      wishes,
      stats,
      settings: publicSettings(req.account),
    });
  })
);

// Info tamu berdasarkan slug (link personal: /u/:slug?to=guest-slug)
app.get(
  '/api/guest/:slug',
  publicLimiter,
  requireAccount,
  wrap((req, res) => {
    const guest = db
      .prepare('SELECT id, slug, name, category, quota FROM guests WHERE account_id = ? AND slug = ?')
      .get(req.account.id, req.query.to || req.query.guest || '');
    if (!guest) return res.status(404).json({ error: 'Tamu tidak ditemukan.' });
    res.json(guest);
  })
);

// Kirim RSVP
app.post(
  '/api/rsvp',
  writeLimiter,
  requireAccount,
  wrap((req, res) => {
    const accId = req.account.id;
    const { name, attendance, pax, message, slug } = req.body || {};
    if (!name || String(name).trim().length < 2) return res.status(400).json({ error: 'Nama wajib diisi.' });
    if (tooLong(name, LIMITS.name)) return res.status(400).json({ error: `Nama maksimal ${LIMITS.name} karakter.` });
    if (message && tooLong(message, LIMITS.message)) return res.status(400).json({ error: `Pesan maksimal ${LIMITS.message} karakter.` });
    if (!['hadir', 'tidak_hadir', 'ragu'].includes(attendance)) return res.status(400).json({ error: 'Status kehadiran tidak valid.' });

    let guestId = null;
    if (slug) {
      const g = db.prepare('SELECT id FROM guests WHERE account_id = ? AND slug = ?').get(accId, slug);
      if (g) guestId = g.id;
    }
    const n = attendance === 'hadir' ? Math.max(1, Math.min(20, parseInt(pax, 10) || 1)) : 0;

    const info = db
      .prepare('INSERT INTO rsvp (account_id, guest_id, name, attendance, pax, message) VALUES (?, ?, ?, ?, ?, ?)')
      .run(accId, guestId, clampStr(name, LIMITS.name), attendance, n, message ? clampStr(message, LIMITS.message) : null);

    res.status(201).json({ ok: true, id: info.lastInsertRowid });
  })
);

// Kirim ucapan / buku tamu
app.post(
  '/api/wishes',
  writeLimiter,
  requireAccount,
  wrap((req, res) => {
    const accId = req.account.id;
    const { name, message, attending, slug } = req.body || {};
    if (!name || !message || String(message).trim().length < 2) return res.status(400).json({ error: 'Nama dan ucapan wajib diisi.' });
    if (tooLong(name, LIMITS.name)) return res.status(400).json({ error: `Nama maksimal ${LIMITS.name} karakter.` });
    if (tooLong(message, LIMITS.message)) return res.status(400).json({ error: `Ucapan maksimal ${LIMITS.message} karakter.` });

    let guestId = null;
    if (slug) {
      const g = db.prepare('SELECT id FROM guests WHERE account_id = ? AND slug = ?').get(accId, slug);
      if (g) guestId = g.id;
    }
    const info = db
      .prepare('INSERT INTO wishes (account_id, guest_id, name, message, attending) VALUES (?, ?, ?, ?, ?)')
      .run(accId, guestId, clampStr(name, LIMITS.name), clampStr(message, LIMITS.message), attending || 'hadir');
    const row = db.prepare('SELECT * FROM wishes WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ ok: true, wish: row });
  })
);

// Statistik ringan (per-account) untuk dashboard live client
app.get(
  '/api/stats',
  requireAccount,
  wrap((req, res) => {
    const id = req.account.id;
    res.json({
      hadir: db.prepare("SELECT COALESCE(SUM(pax),0) AS n FROM rsvp WHERE account_id = ? AND attendance='hadir'").get(id).n,
      undangan: db.prepare('SELECT COUNT(*) AS n FROM guests WHERE account_id = ?').get(id).n,
      ucapan: db.prepare('SELECT COUNT(*) AS n FROM wishes WHERE account_id = ?').get(id).n,
    });
  })
);

// =====================================================================
//  CLIENT ADMIN API
// =====================================================================

app.post(
  '/api/admin/login',
  loginLimiter,
  wrap((req, res) => {
    const account = resolveAccount(req);
    if (!account) return res.status(404).json({ error: 'Undangan tidak ditemukan.' });
    const { password } = req.body || {};
    // Auto-migrasi hash lama bila perlu.
    const stored = account.password_hash;
    const { ok } = verifyPassword(password, stored);
    if (!ok) return res.status(401).json({ error: 'Password salah.' });
    res.json({ ok: true, account: { slug: account.slug, title: account.title, theme: account.theme } });
  })
);

app.get('/api/admin/summary', requireAccountAdmin, wrap((req, res) => {
  const id = req.account.id;
  const byAttendance = db
    .prepare('SELECT attendance, COUNT(*) AS count, COALESCE(SUM(pax),0) AS pax FROM rsvp WHERE account_id = ? GROUP BY attendance')
    .all(id);
  const totals = {
    guests: db.prepare('SELECT COUNT(*) AS n FROM guests WHERE account_id = ?').get(id).n,
    rsvp: db.prepare('SELECT COUNT(*) AS n FROM rsvp WHERE account_id = ?').get(id).n,
    wishes: db.prepare('SELECT COUNT(*) AS n FROM wishes WHERE account_id = ?').get(id).n,
    pax_hadir: db.prepare("SELECT COALESCE(SUM(pax),0) AS n FROM rsvp WHERE account_id = ? AND attendance='hadir'").get(id).n,
  };
  res.json({ totals, byAttendance });
}));

app.get('/api/admin/rsvp', requireAccountAdmin, wrap((req, res) => {
  res.json(db.prepare('SELECT * FROM rsvp WHERE account_id = ? ORDER BY created_at DESC').all(req.account.id));
}));

app.get('/api/admin/guests', requireAccountAdmin, wrap((req, res) => {
  const rows = db
    .prepare(
      `SELECT g.*,
              (SELECT attendance FROM rsvp r WHERE r.guest_id = g.id ORDER BY r.created_at DESC LIMIT 1) AS last_attendance,
              (SELECT COALESCE(SUM(pax),0) FROM rsvp r WHERE r.guest_id = g.id AND r.attendance='hadir') AS confirmed_pax
       FROM guests g WHERE g.account_id = ? ORDER BY g.created_at DESC`
    )
    .all(req.account.id);
  res.json(rows);
}));

app.post('/api/admin/guests', requireAccountActive, wrap((req, res) => {
  const accId = req.account.id;
  const { name, phone, category, quota } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nama tamu wajib diisi.' });

  const limit = req.account.max_guests || 500;
  const count = db.prepare('SELECT COUNT(*) AS n FROM guests WHERE account_id = ?').get(accId).n;
  if (count >= limit) return res.status(400).json({ error: `Batas ${limit} tamu tercapai untuk paket ini.` });

  let base = slugify(name) || 'tamu';
  let slug = base;
  let i = 1;
  while (db.prepare('SELECT 1 FROM guests WHERE account_id = ? AND slug = ?').get(accId, slug)) slug = `${base}-${i++}`;
  const info = db
    .prepare('INSERT INTO guests (account_id, slug, name, phone, category, quota) VALUES (?, ?, ?, ?, ?, ?)')
    .run(accId, slug, String(name).trim(), phone || null, category || 'Tamu', parseInt(quota, 10) || 2);
  res.status(201).json({ ok: true, id: info.lastInsertRowid, slug });
}));

app.delete('/api/admin/guests/:id', requireAccountActive, wrap((req, res) => {
  db.prepare('DELETE FROM guests WHERE id = ? AND account_id = ?').run(req.params.id, req.account.id);
  res.json({ ok: true });
}));

app.get('/api/admin/wishes', requireAccountAdmin, wrap((req, res) => {
  res.json(db.prepare('SELECT * FROM wishes WHERE account_id = ? ORDER BY created_at DESC').all(req.account.id));
}));

app.delete('/api/admin/wishes/:id', requireAccountActive, wrap((req, res) => {
  db.prepare('DELETE FROM wishes WHERE id = ? AND account_id = ?').run(req.params.id, req.account.id);
  res.json({ ok: true });
}));

// Update data mempelai
app.put('/api/admin/couple', requireAccountActive, wrap((req, res) => {
  const accId = req.account.id;
  const fields = [
    'groom_name', 'groom_full', 'groom_ig', 'groom_photo', 'groom_parents',
    'bride_name', 'bride_full', 'bride_ig', 'bride_photo', 'bride_parents', 'love_story',
  ];
  const current = db.prepare('SELECT * FROM couple WHERE account_id = ?').get(accId);
  const merged = { account_id: accId, ...(current || {}) };
  fields.forEach((f) => { if (req.body[f] !== undefined) merged[f] = req.body[f]; });

  if (!current) {
    db.prepare(
      `INSERT INTO couple (account_id, groom_name, groom_full, groom_ig, groom_photo, groom_parents,
        bride_name, bride_full, bride_ig, bride_photo, bride_parents, love_story)
       VALUES (@account_id, @groom_name, @groom_full, @groom_ig, @groom_photo, @groom_parents,
        @bride_name, @bride_full, @bride_ig, @bride_photo, @bride_parents, @love_story)`
    ).run({
      account_id: accId,
      groom_name: merged.groom_name || '', groom_full: merged.groom_full || null, groom_ig: merged.groom_ig || null,
      groom_photo: merged.groom_photo || null, groom_parents: merged.groom_parents || null,
      bride_name: merged.bride_name || '', bride_full: merged.bride_full || null, bride_ig: merged.bride_ig || null,
      bride_photo: merged.bride_photo || null, bride_parents: merged.bride_parents || null, love_story: merged.love_story || null,
    });
  } else {
    db.prepare(
      `UPDATE couple SET groom_name=@groom_name, groom_full=@groom_full, groom_ig=@groom_ig, groom_photo=@groom_photo,
        groom_parents=@groom_parents, bride_name=@bride_name, bride_full=@bride_full, bride_ig=@bride_ig,
        bride_photo=@bride_photo, bride_parents=@bride_parents, love_story=@love_story
       WHERE account_id=@account_id`
    ).run({
      account_id: accId,
      groom_name: merged.groom_name || '', groom_full: merged.groom_full || null, groom_ig: merged.groom_ig || null,
      groom_photo: merged.groom_photo || null, groom_parents: merged.groom_parents || null,
      bride_name: merged.bride_name || '', bride_full: merged.bride_full || null, bride_ig: merged.bride_ig || null,
      bride_photo: merged.bride_photo || null, bride_parents: merged.bride_parents || null, love_story: merged.love_story || null,
    });
  }
  res.json({ ok: true });
}));

// Update setelan account (quote, musik, tema, password)
app.put('/api/admin/settings', requireAccountActive, wrap((req, res) => {
  const accId = req.account.id;
  const allowed = ['music_url', 'quote', 'admin_password', 'theme'];
  const upsert = db.prepare(
    'INSERT INTO settings (account_id, key, value) VALUES (?, ?, ?) ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value'
  );
  Object.entries(req.body || {}).forEach(([k, v]) => {
    if (!allowed.includes(k)) return;
    if (k === 'theme') {
      const t = String(v || '').trim();
      if (['botanical', 'midnight', 'blush', 'javanese', 'minimal', 'baroque'].includes(t)) db.prepare('UPDATE accounts SET theme = ? WHERE id = ?').run(t, accId);
      return;
    }
    if (k === 'admin_password') {
      const raw = String(v);
      if (raw.length < 6) return;
      db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').run(hashPassword(raw), accId);
      return;
    }
    if (v == null || v === '') return;
    if (k === 'music_url') return upsert.run(accId, 'music_url', clampStr(v, LIMITS.url));
    if (k === 'quote') return upsert.run(accId, 'quote', clampStr(v, LIMITS.quote));
  });
  res.json({ ok: true });
}));

// ---------- export CSV (client admin) ----------
function toCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const cell = (v) => {
    const s = v == null ? '' : String(v);
    return /[";,\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [headers.join(',')];
  rows.forEach((r) => lines.push(headers.map((h) => cell(r[h])).join(',')));
  return '\uFEFF' + lines.join('\r\n');
}
function sendCSV(res, filename, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(toCSV(rows));
}

app.get('/api/admin/export/rsvp.csv', requireAccountAdmin, wrap((req, res) => {
  const rows = db
    .prepare(
      `SELECT r.id, r.name, g.category, r.attendance, r.pax, r.message, r.created_at
       FROM rsvp r LEFT JOIN guests g ON g.id = r.guest_id WHERE r.account_id = ? ORDER BY r.created_at DESC`
    )
    .all(req.account.id);
  sendCSV(res, 'rsvp.csv', rows);
}));

app.get('/api/admin/export/guests.csv', requireAccountAdmin, wrap((req, res) => {
  const rows = db
    .prepare('SELECT id, slug, name, phone, category, quota, created_at FROM guests WHERE account_id = ? ORDER BY created_at DESC')
    .all(req.account.id);
  sendCSV(res, 'tamu.csv', rows);
}));

app.get('/api/admin/export/wishes.csv', requireAccountAdmin, wrap((req, res) => {
  const rows = db.prepare('SELECT id, name, message, attending, created_at FROM wishes WHERE account_id = ? ORDER BY created_at DESC').all(req.account.id);
  sendCSV(res, 'ucapan.csv', rows);
}));

// =====================================================================
//  OWNER (SUPER ADMIN) API
// =====================================================================

app.post('/api/owner/login', loginLimiter, wrap((req, res) => {
  const { password } = req.body || {};
  const owners = db.prepare('SELECT * FROM owners').all();
  const match = owners.find((o) => verifyPassword(password, o.password_hash).ok);
  if (!match) return res.status(401).json({ error: 'Password owner salah.' });
  res.json({ ok: true, username: match.username });
}));

// Daftar semua undangan (tenant) + ringkasan singkat
app.get('/api/owner/accounts', requireOwner, wrap((req, res) => {
  const rows = db
    .prepare(
      `SELECT a.id, a.slug, a.title, a.status, a.plan, a.theme, a.max_guests, a.expires_at, a.created_at,
              (SELECT COUNT(*) FROM guests g WHERE g.account_id = a.id) AS guests,
              (SELECT COUNT(*) FROM rsvp r WHERE r.account_id = a.id) AS rsvp,
              (SELECT COUNT(*) FROM wishes w WHERE w.account_id = a.id) AS wishes
       FROM accounts a ORDER BY a.created_at DESC`
    )
    .all();
  // Tambahkan info sisa hari & status efektif (mempertimbangkan expires_at).
  const enriched = rows.map((a) => {
    let daysLeft = null;
    if (a.expires_at) {
      const end = new Date(String(a.expires_at).slice(0, 10) + 'T23:59:59');
      daysLeft = Math.floor((end.getTime() - Date.now()) / 86400000);
    }
    const effective = a.status !== 'active' ? 'suspended' : daysLeft !== null && daysLeft < 0 ? 'expired' : 'active';
    return { ...a, days_left: daysLeft, effective_status: effective };
  });
  res.json(enriched);
}));

// Buat account (undangan) baru untuk client
app.post('/api/owner/accounts', requireOwner, wrap((req, res) => {
  const { slug, title, password, theme, max_guests, withSample, expires_at, days } = req.body || {};
  const cleanSlug = slugify(slug || title || '');
  if (!cleanSlug || cleanSlug.length < 3) return res.status(400).json({ error: 'Slug minimal 3 karakter (huruf/angka).' });
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter.' });
  if (db.prepare('SELECT 1 FROM accounts WHERE slug = ?').get(cleanSlug)) {
    return res.status(409).json({ error: 'Slug sudah dipakai. Pilih yang lain.' });
  }
  const validThemes = ['botanical', 'midnight', 'blush', 'javanese', 'minimal', 'baroque'];
  const chosenTheme = validThemes.includes(theme) ? theme : 'botanical';
  const id = createAccount({
    slug: cleanSlug,
    title: title || cleanSlug,
    password: String(password),
    theme: chosenTheme,
    withSample: !!withSample,
  });
  if (Number.isFinite(Number(max_guests))) {
    db.prepare('UPDATE accounts SET max_guests = ? WHERE id = ?').run(parseInt(max_guests, 10) || 500, id);
  }
  // Masa aktif: prioritas `expires_at`; kalau tidak, hitung dari `days`.
  const expiry = normalizeExpiry(expires_at, days);
  if (expiry) db.prepare('UPDATE accounts SET expires_at = ? WHERE id = ?').run(expiry, id);
  res.status(201).json({ ok: true, id, slug: cleanSlug, expires_at: expiry || null });
}));

// Ubah status / tema default / kuota / reset password account
app.put('/api/owner/accounts/:id', requireOwner, wrap((req, res) => {
  const id = req.params.id;
  const acc = getAccountById(id);
  if (!acc) return res.status(404).json({ error: 'Account tidak ditemukan.' });

  const { status, theme, max_guests, title, expires_at, password, extend_days } = req.body || {};
  const sets = [];
  const vals = [];
  if (status && ['active', 'suspended'].includes(status)) { sets.push('status = ?'); vals.push(status); }
  if (theme && ['botanical', 'midnight', 'blush', 'javanese', 'minimal', 'baroque'].includes(theme)) { sets.push('theme = ?'); vals.push(theme); }
  if (Number.isFinite(Number(max_guests))) { sets.push('max_guests = ?'); vals.push(parseInt(max_guests, 10) || 500); }
  if (title !== undefined) { sets.push('title = ?'); vals.push(clampStr(title, 120)); }
  if (expires_at !== undefined) { sets.push('expires_at = ?'); vals.push(expires_at ? String(expires_at).slice(0, 10) : null); }
  // Perpanjang dari tanggal berakhir yang ada (atau dari hari ini bila sudah lewat/kosong).
  if (extend_days !== undefined) {
    const add = parseInt(extend_days, 10);
    if (Number.isFinite(add) && add !== 0) {
      const baseDate = acc.expires_at && new Date(String(acc.expires_at).slice(0, 10) + 'T23:59:59').getTime() > Date.now()
        ? new Date(String(acc.expires_at).slice(0, 10) + 'T23:59:59')
        : new Date();
      const next = new Date(baseDate.getTime() + add * 86400000);
      sets.push('expires_at = ?'); vals.push(next.toISOString().slice(0, 10));
      if (acc.status !== 'active') { sets.push('status = ?'); vals.push('active'); }
    }
  }
  if (password) {
    if (String(password).length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter.' });
    sets.push('password_hash = ?'); vals.push(hashPassword(String(password)));
  }
  if (!sets.length) return res.json({ ok: true, unchanged: true });
  vals.push(id);
  db.prepare(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  const updated = getAccountById(id);
  res.json({ ok: true, expires_at: updated.expires_at || null, status: updated.status });
}));

// Hapus account beserta seluruh datanya
app.delete('/api/owner/accounts/:id', requireOwner, wrap((req, res) => {
  const id = req.params.id;
  const acc = getAccountById(id);
  if (!acc) return res.status(404).json({ error: 'Account tidak ditemukan.' });
  const tx = db.transaction(() => {
    ['couple', 'events', 'guests', 'rsvp', 'wishes', 'gallery', 'gifts', 'settings'].forEach((t) => {
      db.prepare(`DELETE FROM ${t} WHERE account_id = ?`).run(id);
    });
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  });
  tx();
  res.json({ ok: true });
}));

// Ganti password owner
app.put('/api/owner/password', requireOwner, wrap((req, res) => {
  const { new_password } = req.body || {};
  if (!new_password || String(new_password).length < 6) return res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
  db.prepare('UPDATE owners SET password_hash = ? WHERE id = ?').run(hashPassword(String(new_password)), req.owner.id);
  res.json({ ok: true });
}));

// =====================================================================
//  HALAMAN (HTML)
// =====================================================================

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const INDEX_HTML_PATH = path.join(PUBLIC_DIR, 'index.html');
const OWNER_HTML_PATH = path.join(PUBLIC_DIR, 'owner', 'index.html');
const ADMIN_HTML_PATH = path.join(PUBLIC_DIR, 'admin', 'index.html');

const escapeHtml = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

let indexHtmlCache = null;
function loadIndexHtml() {
  if (indexHtmlCache == null) indexHtmlCache = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
  return indexHtmlCache;
}

/** Halaman netral untuk undangan yang tidak ditemukan / nonaktif / kedaluwarsa. */
function inactivePage(title, message) {
  return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;display:grid;place-items:center;padding:24px;background:#f7f4ec;color:#33352e;
 font-family:'Plus Jakarta Sans',system-ui,sans-serif;text-align:center;line-height:1.6}
.box{max-width:420px;background:#fff;border:1px solid #e2dbc9;border-radius:20px;padding:44px 32px;box-shadow:0 14px 44px rgba(58,54,38,.12)}
.mark{font-size:2.4rem;line-height:1;margin-bottom:14px}
h1{font-family:Georgia,'Cormorant Garamond',serif;font-size:1.5rem;margin-bottom:10px;color:#57684a}
p{color:#61635a;font-size:.95rem}
</style></head>
<body><div class="box"><div class="mark">🙏</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></div></body></html>`;
}

/** Halaman undangan client, dengan injeksi OG meta sesuai data client. */
function renderInvitation(req, res) {
  const account = getAccountBySlug(req.params.slug);
  if (!account) {
    return res.status(404).send(inactivePage('Undangan tidak ditemukan', 'Sepertinya tautan yang Anda buka tidak valid atau undangan telah dihapus.'));
  }
  const life = accountLifecycle(account);
  if (!life.ok) {
    const title = life.reason === 'expired' ? 'Masa Aktif Berakhir' : 'Undangan Tidak Aktif';
    const msg = life.reason === 'expired'
      ? 'Masa aktif undangan ini telah berakhir. Silakan hubungi penyedia undangan untuk memperpanjang.'
      : 'Undangan ini sedang dinonaktifkan sementara. Silakan coba beberapa saat lagi.';
    return res.status(403).send(inactivePage(title, msg));
  }
  let html;
  try {
    html = loadIndexHtml();
  } catch {
    return res.status(500).send('Gagal memuat halaman.');
  }

  const c = db.prepare('SELECT * FROM couple WHERE account_id = ?').get(account.id) || {};
  const ev = db.prepare('SELECT date_iso FROM events WHERE account_id = ? ORDER BY sort LIMIT 1').get(account.id);
  const title = [c.groom_full || c.groom_name, c.bride_full || c.bride_name].filter(Boolean).join(' & ');
  const ogTitle = title ? `Undangan Pernikahan ${title}` : `Undangan Pernikahan ${account.title || ''}`.trim();
  const ogImage = c.bride_photo || c.groom_photo || '';
  const ogDesc = ev
    ? 'Dengan penuh kebahagiaan, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di hari bahagia kami.'
    : 'Undangan pernikahan online.';
  const base = `${req.protocol}://${req.get('host')}`;

  const metaTags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeHtml(ogTitle)}" />`,
    `<meta property="og:description" content="${escapeHtml(ogDesc)}" />`,
    `<meta property="og:url" content="${escapeHtml(base + req.originalUrl)}" />`,
    ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />` : '',
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(ogTitle)}" />`,
    ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />` : '',
    // Client tahu slug-nya sendiri tanpa perlu tanya API.
    `<script>window.__ACCOUNT__=${JSON.stringify({ slug: account.slug, theme: account.theme })};</script>`,
  ].filter(Boolean).join('\n  ');

  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(ogTitle)}</title>\n  ${metaTags}`);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

app.get('/u/:slug', renderInvitation);
app.get('/u/:slug/', renderInvitation);

app.get(['/u/:slug/admin', '/u/:slug/admin/'], (req, res) => {
  const account = getAccountBySlug(req.params.slug);
  if (!account) return res.status(404).send('Undangan tidak ditemukan.');
  res.sendFile(ADMIN_HTML_PATH);
});

app.get(['/owner', '/owner/'], (req, res) => {
  res.sendFile(OWNER_HTML_PATH);
});

// Halaman depan: daftar undangan yang tersedia (halaman navigasi kecil).
app.get(['/', '/index.html'], (req, res) => {
  const accounts = db.prepare("SELECT slug, title FROM accounts WHERE status = 'active' ORDER BY created_at DESC").all();
  const items = accounts.length
    ? accounts.map((a) => `<li><a href="/u/${escapeHtml(a.slug)}">${escapeHtml(a.title || a.slug)}</a> <code>/u/${escapeHtml(a.slug)}</code></li>`).join('')
    : '<li>Belum ada undangan. Buka <a href="/owner">/owner</a> untuk membuat.</li>';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Undangan Online</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 20px;color:#2c2c2c;line-height:1.6}h1{font-family:Georgia,serif}code{background:#f0efe7;padding:2px 6px;border-radius:4px;font-size:.85em}ul{line-height:2}footer{margin-top:32px;color:#888;font-size:.85rem}a{color:#5a7a4e}</style></head>
<body><h1>💍 Undangan Online</h1><p>Daftar undangan aktif:</p><ul>${items}</ul>
<footer>Panel pemilik: <a href="/owner">/owner</a> &middot; Admin undangan: <code>/u/&lt;slug&gt;/admin</code></footer></body></html>`);
});

// ---------- static assets ----------
app.use(express.static(PUBLIC_DIR, { index: false }));

// error handler
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
});

// Auto-setup: owner + (kalau belum ada account) data demo.
ensureOwner();
const accountCount = db.prepare('SELECT COUNT(*) AS c FROM accounts').get().c;
if (accountCount === 0) {
  console.log('ℹ️  Belum ada undangan, memasukkan data contoh...');
  seed();
}

app.listen(PORT, () => {
  const owner = db.prepare('SELECT username FROM owners LIMIT 1').get();
  console.log(`\n💍 Undangan Online berjalan di http://localhost:${PORT}`);
  console.log(`🛡️  Panel pemilik (super admin): http://localhost:${PORT}/owner`);
  console.log(`📇 Contoh undangan: http://localhost:${PORT}/u/demo`);
  console.log(`🔑 Admin contoh   : http://localhost:${PORT}/u/demo/admin`);
  if (owner) console.log(`   Login owner default -> username: ${owner.username} · password: owner123 (GANTI!)`);
  console.log('');
});
