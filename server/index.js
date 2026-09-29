'use strict';

const express = require('express');
const path = require('path');
const { db } = require('./db/schema');
const { seed } = require('./db/seed');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true }));

// ---------- helpers ----------
const slugify = (s) =>
  String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  rows.forEach((r) => (out[r.key] = r.value));
  return out;
}

function publicSettings() {
  const s = getSettings();
  delete s.admin_password;
  return s;
}

function requireAdmin(req, res, next) {
  const pass =
    req.headers['x-admin-password'] ||
    req.query.password ||
    (req.body && req.body.password);
  const expected = getSettings().admin_password || 'admin123';
  if (pass !== expected) {
    return res.status(401).json({ error: 'Password admin salah.' });
  }
  next();
}

const wrap = (fn) => (req, res, next) => {
  try {
    fn(req, res, next);
  } catch (err) {
    next(err);
  }
};

// ================= PUBLIC API =================

// Semua data yang dibutuhkan halaman undangan dalam satu request
app.get(
  '/api/invitation',
  wrap((req, res) => {
    const couple = db.prepare('SELECT * FROM couple WHERE id = 1').get() || null;
    const events = db.prepare('SELECT * FROM events ORDER BY sort, date_iso').all();
    const gallery = db.prepare('SELECT * FROM gallery ORDER BY sort').all();
    const gifts = db.prepare('SELECT id, type, bank_name, account_no, account_name FROM gifts ORDER BY sort').all();
    const wishes = db
      .prepare('SELECT id, name, message, attending, created_at FROM wishes ORDER BY created_at DESC LIMIT 100')
      .all();
    const stats = {
      hadir: db.prepare("SELECT COALESCE(SUM(pax),0) AS n FROM rsvp WHERE attendance='hadir'").get().n,
      undangan: db.prepare('SELECT COUNT(*) AS n FROM guests').get().n,
      ucapan: db.prepare('SELECT COUNT(*) AS n FROM wishes').get().n,
    };
    res.json({ couple, events, gallery, gifts, wishes, stats, settings: publicSettings() });
  })
);

// Info tamu berdasarkan slug (link personal: /?to=slug)
app.get(
  '/api/guest/:slug',
  wrap((req, res) => {
    const guest = db.prepare('SELECT id, slug, name, category, quota FROM guests WHERE slug = ?').get(req.params.slug);
    if (!guest) return res.status(404).json({ error: 'Tamu tidak ditemukan.' });
    res.json(guest);
  })
);

// Kirim RSVP
app.post(
  '/api/rsvp',
  wrap((req, res) => {
    const { name, attendance, pax, message, slug } = req.body || {};
    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ error: 'Nama wajib diisi.' });
    }
    if (!['hadir', 'tidak_hadir', 'ragu'].includes(attendance)) {
      return res.status(400).json({ error: 'Status kehadiran tidak valid.' });
    }
    let guestId = null;
    if (slug) {
      const g = db.prepare('SELECT id FROM guests WHERE slug = ?').get(slug);
      if (g) guestId = g.id;
    }
    const n = attendance === 'hadir' ? Math.max(1, Math.min(20, parseInt(pax, 10) || 1)) : 0;

    const info = db
      .prepare('INSERT INTO rsvp (guest_id, name, attendance, pax, message) VALUES (?, ?, ?, ?, ?)')
      .run(guestId, String(name).trim(), attendance, n, message ? String(message).trim() : null);

    res.status(201).json({ ok: true, id: info.lastInsertRowid });
  })
);

// Kirim ucapan / buku tamu
app.post(
  '/api/wishes',
  wrap((req, res) => {
    const { name, message, attending, slug } = req.body || {};
    if (!name || !message || String(message).trim().length < 2) {
      return res.status(400).json({ error: 'Nama dan ucapan wajib diisi.' });
    }
    let guestId = null;
    if (slug) {
      const g = db.prepare('SELECT id FROM guests WHERE slug = ?').get(slug);
      if (g) guestId = g.id;
    }
    const info = db
      .prepare('INSERT INTO wishes (guest_id, name, message, attending) VALUES (?, ?, ?, ?)')
      .run(guestId, String(name).trim(), String(message).trim(), attending || 'hadir');
    const row = db.prepare('SELECT * FROM wishes WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ ok: true, wish: row });
  })
);

// ================= ADMIN API =================

app.post(
  '/api/admin/login',
  wrap((req, res) => {
    const { password } = req.body || {};
    const expected = getSettings().admin_password || 'admin123';
    if (password !== expected) return res.status(401).json({ error: 'Password salah.' });
    res.json({ ok: true });
  })
);

app.get(
  '/api/admin/summary',
  requireAdmin,
  wrap((req, res) => {
    const byAttendance = db
      .prepare("SELECT attendance, COUNT(*) AS count, COALESCE(SUM(pax),0) AS pax FROM rsvp GROUP BY attendance")
      .all();
    const totals = {
      guests: db.prepare('SELECT COUNT(*) AS n FROM guests').get().n,
      rsvp: db.prepare('SELECT COUNT(*) AS n FROM rsvp').get().n,
      wishes: db.prepare('SELECT COUNT(*) AS n FROM wishes').get().n,
      pax_hadir: db.prepare("SELECT COALESCE(SUM(pax),0) AS n FROM rsvp WHERE attendance='hadir'").get().n,
    };
    res.json({ totals, byAttendance });
  })
);

app.get(
  '/api/admin/rsvp',
  requireAdmin,
  wrap((req, res) => {
    const rows = db.prepare('SELECT * FROM rsvp ORDER BY created_at DESC').all();
    res.json(rows);
  })
);

app.get(
  '/api/admin/guests',
  requireAdmin,
  wrap((req, res) => {
    const rows = db
      .prepare(
        `SELECT g.*,
                (SELECT attendance FROM rsvp r WHERE r.guest_id = g.id ORDER BY r.created_at DESC LIMIT 1) AS last_attendance,
                (SELECT COALESCE(SUM(pax),0) FROM rsvp r WHERE r.guest_id = g.id AND r.attendance='hadir') AS confirmed_pax
         FROM guests g ORDER BY g.created_at DESC`
      )
      .all();
    res.json(rows);
  })
);

app.post(
  '/api/admin/guests',
  requireAdmin,
  wrap((req, res) => {
    const { name, phone, category, quota } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Nama tamu wajib diisi.' });
    let base = slugify(name) || 'tamu';
    let slug = base;
    let i = 1;
    while (db.prepare('SELECT 1 FROM guests WHERE slug = ?').get(slug)) slug = `${base}-${i++}`;
    const info = db
      .prepare('INSERT INTO guests (slug, name, phone, category, quota) VALUES (?, ?, ?, ?, ?)')
      .run(slug, String(name).trim(), phone || null, category || 'Tamu', parseInt(quota, 10) || 2);
    res.status(201).json({ ok: true, id: info.lastInsertRowid, slug });
  })
);

app.delete(
  '/api/admin/guests/:id',
  requireAdmin,
  wrap((req, res) => {
    db.prepare('DELETE FROM guests WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  })
);

app.delete(
  '/api/admin/wishes/:id',
  requireAdmin,
  wrap((req, res) => {
    db.prepare('DELETE FROM wishes WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  })
);

app.get(
  '/api/admin/wishes',
  requireAdmin,
  wrap((req, res) => {
    res.json(db.prepare('SELECT * FROM wishes ORDER BY created_at DESC').all());
  })
);

// Update data mempelai & setelan
app.put(
  '/api/admin/couple',
  requireAdmin,
  wrap((req, res) => {
    const fields = [
      'groom_name', 'groom_full', 'groom_ig', 'groom_photo', 'groom_parents',
      'bride_name', 'bride_full', 'bride_ig', 'bride_photo', 'bride_parents', 'love_story',
    ];
    const current = db.prepare('SELECT * FROM couple WHERE id = 1').get() || {};
    const merged = { ...current };
    fields.forEach((f) => {
      if (req.body[f] !== undefined) merged[f] = req.body[f];
    });
    db.prepare(
      `UPDATE couple SET groom_name=@groom_name, groom_full=@groom_full, groom_ig=@groom_ig, groom_photo=@groom_photo,
        groom_parents=@groom_parents, bride_name=@bride_name, bride_full=@bride_full, bride_ig=@bride_ig,
        bride_photo=@bride_photo, bride_parents=@bride_parents, love_story=@love_story
       WHERE id = 1`
    ).run({
      groom_name: merged.groom_name || '',
      groom_full: merged.groom_full || null,
      groom_ig: merged.groom_ig || null,
      groom_photo: merged.groom_photo || null,
      groom_parents: merged.groom_parents || null,
      bride_name: merged.bride_name || '',
      bride_full: merged.bride_full || null,
      bride_ig: merged.bride_ig || null,
      bride_photo: merged.bride_photo || null,
      bride_parents: merged.bride_parents || null,
      love_story: merged.love_story || null,
    });
    res.json({ ok: true });
  })
);

app.put(
  '/api/admin/settings',
  requireAdmin,
  wrap((req, res) => {
    const allowed = ['music_url', 'quote', 'admin_password'];
    const upsert = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );
    Object.entries(req.body || {}).forEach(([k, v]) => {
      if (allowed.includes(k)) upsert.run(k, v == null ? null : String(v));
    });
    res.json({ ok: true });
  })
);

// Statistik ringan untuk dashboard live
app.get(
  '/api/stats',
  wrap((req, res) => {
    res.json({
      hadir: db.prepare("SELECT COALESCE(SUM(pax),0) AS n FROM rsvp WHERE attendance='hadir'").get().n,
      undangan: db.prepare('SELECT COUNT(*) AS n FROM guests').get().n,
      ucapan: db.prepare('SELECT COUNT(*) AS n FROM wishes').get().n,
    });
  })
);

// ---------- static ----------
app.use(express.static(path.join(__dirname, '..', 'public')));

// SPA-ish fallback untuk admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin', 'index.html'));
});

// error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
});

// Auto-seed kalau DB kosong, lalu jalankan server
const coupleCount = db.prepare('SELECT COUNT(*) AS c FROM couple').get().c;
if (coupleCount === 0) {
  console.log('ℹ️  Database kosong, memasukkan data contoh...');
  seed();
}

app.listen(PORT, () => {
  console.log(`\n💍 Undangan Pernikahan berjalan di http://localhost:${PORT}`);
  console.log(`🔑 Halaman admin: http://localhost:${PORT}/admin  (password: admin123)\n`);
});
