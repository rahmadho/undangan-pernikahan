# CLAUDE.md — Catatan Proyek untuk AI Agent

> Dokumen ini merangkum arsitektur, keputusan desain, dan perubahan terbaru
> agar agent lain (Claude, Hermes, dsb.) dapat melanjutkan pekerjaan tanpa
> menebak-nebak. **Baca ini dulu sebelum mengubah kode.**

## 1. Ringkasan Proyek

**SaaS Undangan Pernikahan Digital (multi-tenant), Bahasa Indonesia.**

Model bisnis: pemilik aplikasi (**Owner**) menjual jasa; ia membuat akun untuk
client. Client (**Pasangan pengantin**) login dan mengisi konten sendiri.
**Tamu** membuka undangan lewat link & mengisi RSVP/ucapan.

Stack: **Node.js + Express + `node:sqlite`** (bawaan Node ≥ 22.5, tanpa native
build). Frontend **HTML/CSS/JS vanilla** (tanpa build step). Opsional **Postgres**
via adapter `pg`.

## 2. Struktur Folder

```
server/
  env.js            # muat .env (dotenv / fallback bawaan) — di-require paling awal
  index.js          # server Express + semua API + render HTML undangan
  security.js       # hash password (scrypt), rate limit, security headers
  db/
    index.js        # pemilih backend: DB_CLIENT=sqlite|postgres
    sqlite.js       # adapter sinkron di atas node:sqlite (API ala better-sqlite3)
    postgres.js     # adapter ASINKRON di atas driver `pg`
    schema.js       # DDL multi-tenant + migrasi legacy + dialect() SQLite→PG
    seed.js         # data contoh (owner + account demo)
    migrate.js      # CLI: siapkan skema + seed (npm run migrate)
public/
  index.html        # halaman undangan tamu
  css/style.css     # semua styling + 6 tema
  js/app.js         # frontend undangan (fetch API, scroll-spy nav, RSVP)
  admin/index.html  # dashboard client (self-contained: HTML+CSS+JS inline)
  owner/index.html  # panel owner (self-contained)
Dockerfile, docker-compose.yml, .dockerignore, .env.example
```

## 3. Model Multi-Tenant

- **Tenant key = `account_id`.** Tabel konten: `couple`, `events`, `guests`,
  `rsvp`, `wishes`, `gallery`, `gifts`, `settings` — semua punya `account_id`.
- Tabel `accounts` (client) & `owners` (super admin).
- **Auth (per-request, bukan session cookie):**
  - Client  : header `x-account: <slug>` + `x-admin-password`
  - Owner   : header `x-owner-password`
- **Rute:** `/` · `/u/:slug` · `/u/:slug/admin` · `/owner` · `/healthz`
- Password disimpan **scrypt hash** (`scrypt$salt$hash`), via `security.js`.

## 4. Yang Sudah Dikerjakan (jangan diulang)

- Migrasi otomatis single-tenant → multi-tenant (idempoten, `migrateLegacy()`).
- Owner panel: buat akun, ganti template, aktif/nonaktif, perpanjang masa aktif,
  reset sandi, hapus; masa aktif (`expires_at` + `accountLifecycle()`).
- Keamanan: scrypt, rate limit (publik/tulis/login), batas input, security headers.
- **6 tema** (dulu 3): `botanical`, `midnight`, `blush`, `javanese`, `minimal`,
  `baroque`. Tiap tema = blok CSS `body.theme-<nama>` yang menimpa variabel
  `--serif`/`--script` + palet. Validasi tema ada di **3 tempat** (server:
  `validThemes` di POST & PUT owner + admin settings; frontend: `THEMES` di
  `app.js`; label: `THEME_LABEL`/`THEMES` di `owner/index.html`). **Kalau
  menambah tema, ubah SEMUA lokasi itu + swatch di admin & owner.**
- Navigasi section: bottom bar mobile, **5 tombol** (Beranda/Mempelai/Acara/
  Galeri/Ucapan), **indikator pil geser** (`.nav-ind`), scroll-spy dengan
  `getBoundingClientRect` + `pendingUntil` lock + resync (load/fonts/scrollend).
- Form RSVP: 3 `.choice-card` (chip + `choice-mark` centang) + stepper jumlah
  orang; **mobile-first: choice-grid 2 baris** (≤560px).
- **Deploy readiness:** `dotenv` + `.env.example`, `Dockerfile`,
  `docker-compose.yml` (app + Postgres), `.dockerignore`, `/healthz`,
  `server/db/migrate.js` (`npm run migrate`), owner awal via env
  `OWNER_USERNAME`/`OWNER_PASSWORD`.
- **Panduan deploy VPS** ada di **`DEPLOY.md`** — stack final: **Node.js LTS terbaru
  (24.x) + pm2 + Nginx + Cloudflare**, backup otomatis, update, troubleshooting.
- **Runtime produksi = `node` (via pm2), BUKAN `bun`** — kode memakai `node:sqlite`
  (belum tersedia di Bun). Domain target: `undangan.rahmadho.my.id`.

## 8. Keputusan Terkini (PENTING)

- **Produksi SAAT INI memakai SQLite** (bukan Postgres). User memutuskan pakai
  SQLite dulu; Postgres ditunda. **Jangan** mengubah default `DB_CLIENT`.
- **Kode server masih SINKRON (100%)** — belum di-refactor ke async. Jadi
  memindahkan ke Postgres = ganti env **DAN** refactor handler ke `async/await`.
  Jalur yang disetujui bila nanti dibutuhkan: **refactor async** (Opsi 1),
  bukan shim sync-over-async.
- Semua data SQLite ada di satu file (`DATABASE_PATH`). Deploy = volume persisten.
- **Belum diimplementasi & jangan lakukan tanpa konfirmasi:** template modular
  (`layout_config` JSON), dan refactor async.

## 5. Perubahan Sesi Terakhir (2025) — ringkas untuk agent lain

1. `npm install` diperbaiki: tidak ada dependensi native; `express` + `dotenv`.
   `pg` dipindah ke **optionalDependencies** (agar `npm install` ringan).
2. `server/env.js` memuat `.env` sebelum modul lain (urutan require penting:
   `require('./env').loadEnv()` harus **sebelum** `require('./db/schema')`).
3. `PORT` di-guard `Number(...) || 3000`; `TRUST_PROXY` dari env.
4. Navigasi: `sec-rsvp` tombol dihapus (5 tombol), indikator geser ditambah,
   `navReservedBottom()` dipakai untuk `padding-bottom` `.main` di mobile.
5. 3 tema baru + font (Marcellus/Pinyon Script, Space Grotesk, Tangerine).
6. RSVP UI: `.choice-mark`, grid 2 baris, stepper full-width.

## 6. Konvensi & Pitfall

- **SQLite sinkron vs Postgres asinkron** — kode saat ini 100% sinkron. Untuk
  benar-benar pindah ke Postgres, semua handler yang menyentuh DB harus jadi
  `async` + `await` (lihat README "Migrasi PostgreSQL"). **Jangan klaim
  Postgres "langsung jalan" tanpa refactor ini.**
- `--white: var(--surface)` diulang di tiap blok tema (jangan pindah ke `:root`).
- Jangan hapus `id` elemen di `index.html` (dipakai `app.js`): `rsvpForm`,
  `rsvpName`, `rsvpPax`, `wishForm`, `wishesList`, `heroNames`, `coverGuestName`,
  `openBtn`, `musicBtn`, `bgMusic`, `countdown`, `sectionNav`, dl.
- `admin/index.html` & `owner/index.html` **self-contained** (CSS/JS inline).
  Jangan asumsikan `style.css`/`app.js` termuat di sana.
- Env dibaca kode: `PORT`, `DB_CLIENT`, `DATABASE_URL`, `PGSSL`, `TRUST_PROXY`,
  `DATABASE_PATH`, `OWNER_USERNAME`, `OWNER_PASSWORD`.
- Sandbox dev: `npm run start/seed` bisa gagal spawn node; jalankan manual
  `PORT=xxxx node server/index.js` lalu `curl`. Selalu `taskkill //F //IM node.exe`
  sebelum tes (port bentrok). Background process mati antar tool-call → jalankan
  server + semua tes dalam SATU perintah terminal.
- Reset DB SQLite: `rm -f data/wedding.db*` (gagal bila node hidup).
- **Belum diimplementasi (diminta "jelaskan dulu"):** template modular
  (layout_config JSON). **Jangan implementasi tanpa konfirmasi user.**

## 7. Perintah Berguna

```bash
npm install            # dependencies
npm start              # jalankan server (atau: npm run dev untuk watch)
npm run migrate        # siapkan skema + seed (untuk server produksi)
npm run seed           # data contoh
docker compose up -d --build   # app + Postgres (opsional)
```
