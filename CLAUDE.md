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
- **6 tema preset** (dulu 3): `botanical`, `midnight`, `blush`, `javanese`, `minimal`,
  `baroque`. Tiap tema = blok CSS `body.theme-<nama>` yang menimpa variabel
  `--serif`/`--script` + palet. Validasi tema preset ada di **3 tempat** (server:
  `validThemes` di POST & PUT owner + admin settings; frontend: `THEMES` di
  `app.js`; label: `THEME_LABEL`/`THEMES` di `owner/index.html`). **Kalau
  menambah tema preset, ubah SEMUA lokasi itu + swatch di admin & owner.**
- **TEMA KUSTOM (modular, BARU):** client bisa membuat tema sendiri dari admin
  (kartu "✨ Buat Tema Sendiri"). Alur:
  - Tabel `themes` (per-account): `slug`, `name`, `base` (preset dasar),
    `tokens` (JSON override CSS var). Query: `getCustomThemes(accountId)`.
  - Endpoint: `GET/POST /api/admin/themes`, `PUT/DELETE /api/admin/themes/:id`,
    `POST /api/admin/themes/:id/activate` (set `accounts.theme = slug`).
  - Token di-whitelist di `THEME_TOKEN_KEYS` (server) & disanitasi `sanitizeTokens()`
    (buang `{ } < > ;` → cegah CSS injection). **Update whitelist di server kalau
    menambah var baru yang boleh di-override.**
  - Frontend: `applyTheme(theme, tokens, base)` di `app.js` — kalau `theme` bukan
    preset, pakai kelas preset `base` lalu terapkan `tokens` via
    `body.style.setProperty()`. Token dikirim server lewat
    `settings.theme_tokens`/`theme_base` (`publicSettings()`).
  - Admin: customizer di `public/admin/index.html` (`CZ_DEFAULT` mirror palet
    preset → **jaga sinkron dengan `style.css`**), preview langsung, daftar tema
    dengan tombol Pakai/Edit/Hapus.
- **UPLOAD MUSIK (BARU):** admin bisa unggah file audio (bukan hanya URL).
  - `server/upload.js` (multer diskStorage) → `data/uploads/music-<uniq>.<ext>`,
    whitelist MIME+ext audio, batas `UPLOAD_MAX_MB` (default 10 MB).
  - Endpoint `POST /api/admin/upload/music` (auth admin + account aktif) →
    simpan ke `settings.music_url` sebagai `/uploads/<nama>`.
  - File disajikan statis di `/uploads` (di `index.js`), `X-Content-Type-Options: nosniff`.
  - Error multer (413 terlalu besar / 400 format salah) ditangani di error handler.
- **UPLOAD GAMBAR LATAR (BARU):** admin bisa unggah gambar background (desktop & mobile).
  - `uploadImage` di `server/upload.js` → `data/uploads/img-<uniq>.<ext>`.
    Whitelist MIME+ext gambar (**JPG/PNG/WEBP/AVIF/GIF — TANPA SVG**, cegah XSS),
    batas `IMAGE_MAX_MB` (default 6 MB).
  - Endpoint `POST /api/admin/upload/image` mengembalikan `{url}`; admin menyimpan
    URL-nya bersama setelan lain (endpoint ini **tidak** menulis settings sendiri,
    berbeda dari musik).
- **LATAR BELAKANG KUSTOM (BARU):** pengaturan gambar latar per-account,
  terpisah dari tema. Disimpan di tabel `settings` (key-value):
  `background_image` (desktop), `background_image_mobile`, `background_overlay`
  (hex), `background_overlay_opacity` (0–1), `background_position`, `background_size`,
  `background_repeat`, `background_attachment`. Divalidasi/di-whitelist di
  `PUT /api/admin/settings` (nilai enum; overlay opacity di-clamp 0–1).
  - Dikirim ke halaman tamu lewat `publicSettings()` (`server/index.js`).
  - `public/js/app.js`: `applyBackground(settings)` mengeset CSS var di `<body>`:
    `--bg-hero`/`--bg-cover` (desktop), `--bg-hero-mobile`/`--bg-cover-mobile`
    (mobile; fallback ke desktop), `--bg-overlay`, `--bg-position`, `--bg-size`,
    `--bg-repeat`, `--bg-attachment`. Nilai kosong = pakai gambar bawaan tema.
  - `public/css/style.css`: `:root` mendefinisikan default `--bg-hero: var(--hero-img)`
    dst. `.cover` & `.hero` memakai var `--bg-*` (mobile), dan pada `@media (min-width:900px)`
    memakai var desktop. **Jangan hardcode `var(--hero-img)` lagi di `.hero`/`.cover`.**
  - Struktur field mengikuti pola Elementor (desktop vs mobile terpisah, overlay,
    position/size/repeat/attachment) — lihat catatan referensi di bawah.
- **ADMIN PANEL (REDESIGN, BARU):** `public/admin/index.html` dirombak (editorial-wedding,
  mobile-first). Font **Fraunces** (display) + **Plus Jakarta Sans** (UI). Semua
  CSS+JS tetap **inline/self-contained**. Tab bar jadi underline (bukan pil),
  sticky save bar, kartu bertumpuk berirama. **Semua `id` yang dipakai JS
dipertahankan** (tambah: `czContrast`/`czContrastSw`/`czContrastText`,
  `bgDesktop`/`bgMobile`/`bgDesktopFile`/`bgMobileFile`/`bgDesktopThumb`/`bgMobileThumb`,
  `bgDesktopLabel`/`bgMobileLabel`, `bgOverlay`/`bgOverlayOpacity`/`bgPosition`/
  `bgSize`/`bgRepeat`/`bgAttachment`). Class `.music-row` dioleh jadi `.media-row`.
- **KONTRAS TEMA KUSTOM (BARU):** `updateContrast(ink, bg)` menghitung rasio WCAG
  (perkiraan) dan menampilkan peringatan ok/warn/bad di `#czContrast`. `fillCustomizerFromBase()`
  mengisi token dari `CZ_DEFAULT[base]` — **default sudah benar** (base gelap → `--ink`
  terang, base terang → `--ink` gelap). **Jangan ubah `CZ_DEFAULT` tanpa menjaga
  sinkron dengan palet `style.css`.**
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
  File upload musik ada di `data/uploads/` — **volume persisten juga**.
- **Belum diimplementasi & jangan lakukan tanpa konfirmasi:** template modular
  (`layout_config` JSON — mengatur URUTAN/SUSUNAN section, berbeda dari tema
  kustom yang hanya warna/font), dan refactor async.
- **Tema kustom (warna/font) SUDAH ada** (lihat bagian 4) — jangan bingung dengan
  `layout_config` yang masih tertunda.

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
7. **Tema kustom** (tabel `themes` + customizer admin) & **upload musik**
   (`server/upload.js` + `multer`) — lihat bagian 4.
8. Dependensi baru: **`multer`** (upload musik). Tetap tanpa dependensi native.

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
- **Panel dashboard pakai pola `<template>` (WAJIB dipertahankan).** Struktur
  dashboard (di `admin`: `#dashView`; di `owner`: `#dashView`) **tidak boleh ada
  di DOM sebelum login**. Markup-nya disimpan di `<template id="dashTemplate">`
  (inert) dan baru di-`cloneNode` ke `<div id="app"></div>` oleh
  `enterDashboard()`/`showDash()` **setelah** autentikasi sukses. Semua
  `addEventListener` khusus dashboard **harus** berada di
  `bindDashboard()`/`bindOwnerDashboard()` (dipanggil sekali setelah injeksi),
  BUKAN di top-level — kalau di top-level akan throw `null` saat elemen belum ada.
  Jangan kembali ke `display:none`/`.hidden` + `classList` (bocor lewat Inspect
  Element). Binding login (`#loginBtn`, `#pw`, `#pwToggle`, `#username`) tetap
  top-level karena form login selalu ada.
- Env dibaca kode: `PORT`, `DB_CLIENT`, `DATABASE_URL`, `PGSSL`, `TRUST_PROXY`,
  `DATABASE_PATH`, `OWNER_USERNAME`, `OWNER_PASSWORD`, `UPLOAD_MAX_MB`, `UPLOAD_DIR`.
- Sandbox dev: `npm run start/seed` bisa gagal spawn node; jalankan manual
  `PORT=xxxx node server/index.js` lalu `curl`. Selalu taskkill node sebelum tes
  (port bentrok). Background process mati antar tool-call → jalankan server +
  semua tes dalam SATU perintah terminal.
- Reset DB SQLite: `rm -f data/wedding.db*` (gagal bila node hidup).
- **Tema kustom & preset**: `CZ_DEFAULT` di `admin/index.html` harus **sinkron**
  dengan palet di `style.css`; whitelist token (`THEME_TOKEN_KEYS`) ada di server.
  Jangan pakai backtick di komentar yang berada di dalam template literal SQL.
- **Upload musik**: `data/uploads/` & `data/*.backup*` di-`.gitignore`. Pastikan
  volume persisten saat deploy. Uji format/ukuran via error handler multer.
- **Latar kustom & tema kustom itu BEDA**: tema kustom = warna/font (tabel `themes`,
  token CSS); latar kustom = gambar background (tabel `settings`, key `background_*`).
  Tidak saling menimpa. `.cover`/`.hero` **wajib** memakai var `--bg-*` (bukan
  `--hero-img`/`--cover-img` langsung) agar latar kustom ikut terpakai.
- **Referensi struktur latar** (ide dari export Elementor LANDINGSTAR WEDDING,
  hanya STRUKTUR bukan gaya): field `background_image` + `background_image_mobile`
  terpisah; kontrol `background_overlay_color`+`opacity`, `background_position`,
  `background_size`, `background_repeat`, `background_attachment`. Palet contoh
  (`#FFFFFF`,`#F7CAC9`,`#2C2C2C`) **tidak** dipakai — kita pakai palet tema sendiri.
- **Belum diimplementasi (diminta jelaskan dulu):** template modular
  (`layout_config` JSON — urutan section, BUKAN warna). **Jangan implementasi
  tanpa konfirmasi user.**

## 7. Perintah Berguna

```bash
npm install            # dependencies
npm start              # jalankan server (atau: npm run dev untuk watch)
npm run migrate        # siapkan skema + seed (untuk server produksi)
npm run seed           # data contoh
docker compose up -d --build   # app + Postgres (opsional)
```
