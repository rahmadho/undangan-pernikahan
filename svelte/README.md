# 💍 Undangan Pernikahan Online — SvelteKit + PostgreSQL

Platform SaaS undangan pernikahan digital. Frontend **SvelteKit (Svelte 5)**, backend menyatu di dalam SvelteKit (API routes), database **PostgreSQL**.

> Versi lama (Express + SQLite) tetap ada di root repo sebagai referensi. Aplikasi ini adalah **versi 2.0**.

## ✨ Fitur

**Halaman undangan (tamu)** — `/u/[slug]`
- Cover dengan nama tamu personal (`?to=<slug>`), animasi masuk, tombol *Buka Undangan*
- **Opsi foto cover 7 gaya**: bundar, bingkai kartu, tanpa bingkai+bayangan, polaroid, lengkung (arch), lingkaran emas, tanpa foto
- **Dekorasi bergerak** (daun/bunga berayun) — floral, sulur daun, batik Jawa, songket Minang
- Countdown hari-H real-time + *Save the Date* (.ics)
- Profil mempelai (foto, orang tua, Instagram)
- Love story, kutipan/ayat
- Detail acara (akad & resepsi) + Google Maps
- Galeri foto + lightbox
- **Galeri video** (YouTube/Vimeo/MP4) & **live streaming**
- Amplop digital: bank/e-wallet + **QRIS** + **alamat kirim hadiah** + tombol salin
- RSVP + buku tamu (ucapan) real-time
- Musik latar (upload file atau URL)
- **Tema modular**: 6 preset + tema kustom (warna & font sendiri)
- **Latar belakang kustom** desktop & mobile terpisah + overlay/opacity/position/size/repeat
- Animasi *reveal* saat scroll + ornamen floral
- Watermark

**Panel admin (client)** — `/u/[slug]/admin`
- Dasbor statistik
- Kelola konten (mempelai, acara, galeri, amplop, video, live, kutipan)
- Kelola tampilan (latar, musik, watermark)
- Customizer tema (buat/simpan/pakai tema sendiri)
- Kelola tamu (link undangan personal per tamu)
- Kelola RSVP & moderasi ucapan
- Ekspor CSV (RSVP, tamu, ucapan)
- Ganti password admin

**Panel owner (SaaS)** — `/owner`
- Buat/kelola banyak client
- Aktif/nonaktif, perpanjang masa aktif, ganti password
- Statistik per client

## 🚀 Menjalankan

```bash
cd svelte
npm install
cp .env.example .env      # lalu sesuaikan kredensial
npm run dev               # http://localhost:3300

# Sekali saja: buat skema + seed data contoh
curl -X POST http://localhost:3300/api/setup
```

### Produksi

```bash
npm run build
npm run start             # PORT default 3300
```

Butuh `@sveltejs/adapter-node` (sudah terpasang) dan proxy (Nginx) di depannya.

## 🔐 Login default (GANTI!)

| Peran | URL | Kredensial |
|---|---|---|
| Owner | `/owner` | `owner123` (dari `OWNER_PASSWORD`) |
| Admin client (demo) | `/u/demo/admin` | `admin123` |
| Tamu | `/u/demo?to=budi-santoso` | — |

## 🗂️ Struktur

```
svelte/
├── src/
│   ├── lib/
│   │   ├── server/          # kode server (tidak pernah ke client)
│   │   │   ├── db.ts        # pool PostgreSQL
│   │   │   ├── schema.ts    # DDL + auto-init
│   │   │   ├── auth.ts      # autentikasi header-based
│   │   │   ├── security.ts  # scrypt, rate limit, headers
│   │   │   ├── invitation.ts# query data undangan
│   │   │   ├── upload.ts    # simpan file upload
│   │   │   └── seed.ts      # data contoh
│   │   ├── components/      # komponen Svelte
│   │   ├── styles/style.css # CSS global + tema
│   │   ├── theme.ts         # applyTheme/applyBackground/reveal
│   │   ├── api.ts           # helper fetch client
│   │   └── types.ts
│   └── routes/
│       ├── u/[slug]/        # halaman undangan + admin
│       ├── owner/           # panel owner
│       ├── api/             # semua endpoint API
│       ├── uploads/[file]/  # sajikan file upload
│       └── healthz/         # cek kesehatan
├── .env.example
└── package.json
```

## 🎨 Tema

**13 preset tema:**
- Klasik: `botanical`, `midnight`, `blush`, `javanese`, `minimal`, `baroque`
- Baru: `adat-minang` (marun + emas + songket), `adat-jawa` (sogan + emas + batik),
  `rustic-terracotta`, `emerald-luxury`, `rose-gold`, `dusty-blue`, `sakura`

Tema kustom disimpan di tabel `themes` (per-account) dengan override CSS variable
yang **di-whitelist** (anti CSS-injection).

**Dekorasi bergerak**: ornamen floral/adat berayun pelan (`sway`, `flutter`, `drift`,
`bloom-pulse`) — 9 varian ornamen termasuk `batik-kawung`, `songket`, `corner-adat`,
`peacock`, `leaf-vine`, `flower-cluster`.

**Template demo** (HTML statis untuk referensi pilihan): lihat folder `../template-tema/` (8 tema).

## 🗄️ Database

PostgreSQL. Skema dibuat otomatis di schema `PGSCHEMA` (default `wedding`).
Tabel: `owners, accounts, couple, events, gallery, gifts, guests, rsvp, settings, themes, wishes`.

**Penting:** folder `UPLOAD_DIR` (`data/uploads/`) harus **volume persisten** di produksi.

## 🔒 Keamanan

- Password di-hash dengan **scrypt**
- Auth **header-based**: `x-account` + `x-admin-password` (client), `x-owner-password` (owner)
- **Rate limiting** per-IP (tulis 8/menit, login 10/menit, upload 12/menit)
- **Isolasi tenant**: setiap query difilter `account_id`
- Whitelist token tema & validasi tipe file upload
- Security headers + CSRF check
