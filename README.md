# 💍 SaaS Undangan Pernikahan Online (Multi-Tenant)

Platform undangan pernikahan digital **multi-tenant**: satu aplikasi melayani **banyak client**
(tiap client punya undangannya sendiri). Dibangun dengan **Node.js + Express + SQLite**,
frontend HTML/CSS/JS tanpa build step.

## 👥 Peran & Alur Kerja

| Peran | Siapa | Bisa apa | Halaman |
|-------|-------|----------|---------|
| **Owner** | Anda (pemilik aplikasi) | Buat akun client, pilih template default, aktif/nonaktifkan, reset sandi client, hapus undangan, lihat semua undangan | `/owner` |
| **Client / Admin Undangan** | Pasangan pengantin | Pilih/ganti template, isi semua konten, kelola tamu, moderasi RSVP & ucapan | `/u/<slug>/admin` |
| **Tamu** | Orang yang diundang | Lihat undangan, konfirmasi kehadiran (RSVP), kirim ucapan | `/u/<slug>` |

**Alur:** Owner buat akun client + pilih template default → client login ke `/u/<slug>/admin`,
ganti template & isi konten → bagikan link `/u/<slug>?to=<slug-tamu>` ke tamu via WhatsApp.

## ✨ Fitur

**Halaman undangan (`/u/<slug>`)**
- Cover pembuka dengan nama tamu otomatis dari link personal (`?to=slug-tamu`)
- **3 pilihan desain/tema** (Botanical, Midnight Luxe, Ivory Blush — masing-masing beda warna & tipografi)
- **Mobile-first** — dioptimalkan untuk HP (mayoritas tamu membuka lewat ponsel)
- **Navigasi antar-bagian (bukan scroll bebas)** — bar menu bawah untuk lompat ke tiap section
- Hero + kutipan, countdown real-time, profil mempelai, cerita cinta
- Rangkaian acara + tombol lokasi Maps, galeri foto
- **Form RSVP** (hadir / ragu / tidak hadir + jumlah orang)
- **Buku tamu / ucapan**, **amplop digital**, **musik latar**, animasi scroll

**Dashboard Client (`/u/<slug>/admin`)** — password dari owner
- Ringkasan statistik dengan **update otomatis (live)**
- Pilih desain (3 tema), edit data mempelai, foto, quote, musik
- Kelola tamu + salin link personal, moderasi RSVP & ucapan
- **Export CSV** (RSVP, tamu, ucapan), ganti password sendiri

**Panel Owner (`/owner`)**
- Ringkasan seluruh aplikasi (jumlah undangan, tamu, RSVP)
- **Buat undangan baru** (nama, slug, password, template default, kuota tamu, **masa aktif**, data contoh)
- Daftar semua undangan: **ubah template** client, **aktif/nonaktifkan**, **perpanjang masa aktif (+30 hari)**, **reset sandi client**, salin URL, **lihat sisa hari / status kedaluwarsa**, hapus
- Ganti password owner

### ⏳ Masa Aktif (Billing) & Kedaluwarsa
Setiap undangan punya `expires_at` (opsional). Bila lewat tanggal itu:
- Halaman undangan menampilkan pesan **"Masa Aktif Berakhir"** (bukan error mentah).
- Client **tetap bisa login & melihat** datanya, tapi **aksi tulis diblokir** (tambah tamu, edit, dll.)
  dengan pesan untuk menghubungi penyedia.
- Owner melihat badge **Kedaluwarsa** + sisa hari, dan bisa **memperpanjang** dengan satu klik.
Set `Tanpa batas waktu` saat membuat akun bila tidak mau memakai masa aktif.

## 🏗️ Arsitektur Multi-Tenant

- **Tenant key = `account_id`.** Semua tabel konten (`couple`, `events`, `guests`, `rsvp`,
  `wishes`, `gallery`, `gifts`, `settings`) punya kolom `account_id`; setiap query difilter
  per-account sehingga data client **terisolasi**.
- **Identifikasi tenant dari request:** header `x-account` (slug) — di-set otomatis oleh
  frontend berdasarkan URL `/u/<slug>`.
- **URL:** `/u/<slug>` (undangan), `/u/<slug>/admin` (dashboard client), `/owner` (panel pemilik).
- **Migrasi data lama otomatis:** bila menjalankan dari versi single-tenant, data lama
  otomatis dipindah ke account `demo` (idempoten, aman dijalankan berkali-kali).

## 🔒 Keamanan

- Password **client & owner** disimpan **ter-hash (scrypt)**, bukan plaintext
- **Rate limiting**: publik (baca), tulis (RSVP/ucapan), login client, login owner
- **Batas panjang input** di server; **security headers**; `trust proxy` untuk reverse proxy

## 🚀 Menjalankan

> **Butuh Node.js 22.5.0+** (memakai `node:sqlite` bawaan). Cek dengan `node -v`.
> Tidak ada dependensi native → `npm install` tidak butuh Python/build tools.

```bash
npm install     # install dependencies
npm start       # jalankan server  (atau: npm run dev  untuk auto-reload)
npm run seed    # (opsional) buat ulang data contoh
```

Buka:
- Panel pemilik: **http://localhost:3000/owner** → login `owner` / `owner123`
- Contoh undangan: **http://localhost:3000/u/demo** (admin: `/u/demo/admin`, sandi `admin123`)

> Ganti port: `PORT=3100 npm start`
> ⚠️ **Ganti password owner & client default sebelum publikasi.**

## 🗂️ Struktur

```
undangan-saas/
├── server/
│   ├── index.js          # server Express + semua API (publik, client admin, owner)
│   ├── security.js       # hash password (scrypt), rate limit, security headers
│   └── db/
│       ├── index.js      # pemilih backend (DB_CLIENT=sqlite|postgres)
│       ├── sqlite.js     # adapter SQLite (node:sqlite bawaan, sinkron)
│       ├── postgres.js   # adapter Postgres (driver pg, asinkron) — untuk produksi
│       ├── schema.js     # skema multi-tenant + migrasi otomatis + dialect() SQLite→PG
│       └── seed.js       # data contoh (owner + account demo)
├── public/
│   ├── index.html        # halaman undangan (mobile-first + nav bawah)
│   ├── css/style.css
│   ├── js/app.js
│   ├── admin/index.html  # dashboard client
│   └── owner/index.html  # panel pemilik (super admin)
└── data/wedding.db       # database (auto-dibuat)
```

## 🔌 API

**Publik** (butuh header `x-account: <slug>`)
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/api/invitation` | Semua data undangan 1 account |
| GET | `/api/guest/:slug?to=<slug>` | Info tamu dari link personal |
| POST | `/api/rsvp` | Kirim konfirmasi kehadiran |
| POST | `/api/wishes` | Kirim ucapan |
| GET | `/api/stats` | Statistik ringan |

**Client Admin** (header `x-account` + `x-admin-password`)
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| POST | `/api/admin/login` | Cek password client |
| GET | `/api/admin/summary` \| `/rsvp` \| `/guests` \| `/wishes` | Data dashboard |
| POST/DELETE | `/api/admin/guests` | Kelola tamu |
| DELETE | `/api/admin/wishes/:id` | Moderasi ucapan |
| PUT | `/api/admin/couple` | Update mempelai |
| PUT | `/api/admin/settings` | Update quote/musik/tema/password |
| GET | `/api/admin/export/{rsvp,guests,wishes}.csv` | Export CSV |

**Owner** (header `x-owner-password`)
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| POST | `/api/owner/login` | Cek password owner |
| GET | `/api/owner/accounts` | Daftar semua undangan + ringkasan |
| POST | `/api/owner/accounts` | Buat undangan/akun client baru (`days`/`expires_at` opsional) |
| PUT | `/api/owner/accounts/:id` | Ubah status/**template**/kuota/judul/reset sandi/**perpanjang (`extend_days`)** |
| DELETE | `/api/owner/accounts/:id` | Hapus undangan + seluruh datanya |
| PUT | `/api/owner/password` | Ganti password owner |

## 📨 Kirim Undangan Personal

Setiap tamu punya slug unik **di dalam** undangannya. Bagikan:

```
https://domain-anda.com/u/<slug-undangan>?to=<slug-tamu>
# contoh: https://domain-anda.com/u/rizky-amelia?to=budi-santoso
```

Nama tamu muncul otomatis di cover & form. Salin link dari dashboard client (tombol **Salin Link**).

## 🎨 Pilihan Desain

Ada **3 tema** (dipilih owner saat membuat, bisa diganti client kapan saja). Tiap tema
punya palet **dan** tipografi berbeda:

| Tema | Nuansa | Font judul | Font script |
|------|--------|-----------|-------------|
| **Botanical** (default) | Sage hijau & emas — natural, tenang | Cormorant Garamond | Great Vibes |
| **Midnight Luxe** | Latar gelap & emas — dramatis, mewah | Playfair Display | Great Vibes |
| **Ivory Blush** | Rose & krem — lembut, romantis | Lora | Italianno |

Tema didefinisikan sebagai variabel CSS di `public/css/style.css`
(`body.theme-midnight { ... }`, `body.theme-blush { ... }`).

### 🎵 Backsound / Musik Latar

Diubah lewat **Admin client → tab Mempelai & Setelan → kolom Musik**. Isi dengan URL file
`.mp3`/`.ogg` langsung. **Default:** *Canon in D Major* (Kevin MacLeod, CC / domain publik).

| Nuansa | URL |
|--------|-----|
| Kanon klasik (default) | `https://upload.wikimedia.org/wikipedia/commons/c/c6/Canon_in_D_Major_%28ISRC_USUAN1100301%29.mp3` |
| Kanon aransemen 1694 | `https://upload.wikimedia.org/wikipedia/commons/e/e2/Pachelbel_Canon_1694_arrangement.mp3` |
| Bridal Chorus (Wagner) | `https://upload.wikimedia.org/wikipedia/commons/a/a3/Wagner_Bridal_Chorus_%28ISRC_USUAN1100021%29.mp3` |
| Bridal Chorus (piano) | `https://upload.wikimedia.org/wikipedia/commons/8/80/Wagner_Bridal_Chorus_-_piano_%28ISRC_USUAN1100022%29.mp3` |
| Lembut & tenang | `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3` |

> 🎧 **Cara paling aman:** unduh mp3 legal → taruh di `public/music/lagu.mp3` → isi kolom Musik
> dengan `/music/lagu.mp3`. Jangan hotlink Pixabay (diblokir). Sumber gratis: Pixabay Music,
> Free Music Archive, Uppbeat.

## 🐘 Migrasi ke PostgreSQL (Produksi)

Aplikasi dirancang agar mudah pindah dari SQLite ke Postgres:

1. **Semua akses DB terpusat** di `server/db/schema.js` (koneksi) + pola `db.prepare(...)`
   bergaya better-sqlite3 (`.run/.get/.all`).
2. Untuk pindah: sediakan **adapter dengan API sama** di atas driver `pg`/`postgres`
   (ubah `?` → `$1`, `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`,
   `datetime('now')` → `now()`, tipe `TEXT` → `text`), lalu set `DATABASE_PATH`/koneksi
   via env. Schema & query aplikasi tidak perlu dirombak.
3. Atau gunakan layanan seperti Supabase/Neon dan ganti layer koneksi saja.

> Struktur tabel & isolasi tenant (`account_id`) sudah kompatibel dengan Postgres.

## 🐘 Migrasi ke PostgreSQL (Produksi)

Aplikasi sudah menyiapkan **layer adapter** sehingga pindah backend = ganti konfigurasi,
bukan rombak query:

- `server/db/index.js` — memilih backend dari env `DB_CLIENT` (`sqlite` default, atau `postgres`).
- `server/db/sqlite.js` — adapter SQLite (`node:sqlite` bawaan, **sinkron**).
- `server/db/postgres.js` — adapter Postgres (driver `pg`, **asinkron**). Sudah menerjemahkan
  `?`/`@name` → `$1, $2, ...` otomatis.
- `server/db/schema.js` — skema + fungsi `dialect()` yang mengubah DDL SQLite
  (`AUTOINCREMENT`, `datetime('now')`, `TEXT`) → Postgres (`SERIAL`, `now()`, `text`).

### Langkah pindah

1. **Install driver:** `npm i pg`
2. **Set env:** `DB_CLIENT=postgres` dan `DATABASE_URL=postgres://user:pass@host:5432/dbname`
3. **Buat skema:** jalankan sekali `node -e "require('./server/db/schema')"` (tabel dibuat otomatis).
4. **⚠️ Wajib: ubah handler Express menjadi `async`.** SQLite sinkron, Postgres asinkron —
   `db.prepare(sql).get()` harus jadi `await db.prepare(sql).get()`, dan handler-nya `async`.
   Pola `wrap((req,res)=>{...})` diganti menjadi `wrapAsync(async (req,res)=>{...})`.
   Ini satu-satunya pekerjaan manual; semua SQL & struktur data sudah kompatibel.

> **Kenapa tidak otomatis 100%?** `node:sqlite` sinkron sedangkan `pg` asinkron — perbedaan
> ini hanya bisa dijembatani dengan menjadikan handler `async`. Struktur tabel, isolasi tenant
> (`account_id`), dan seluruh query sudah disiapkan agar tidak perlu dirombak.

> 💡 **Alternatif tanpa ubah kode:** tetap pakai SQLite untuk skala < ~200 undangan (sudah
> sangat cukup & gratis). Pindah ke Postgres saat trafik/tim sudah butuh multi-server.

## 📝 Catatan Produksi

- **Ganti password owner** (`/owner`) & semua sandi client default.
- Ganti nomor rekening & foto contoh dengan data asli tiap client.
- Hosting: VPS/Render/Railway, reverse proxy (Nginx) + HTTPS. Untuk skala besar, pindah ke Postgres.
- Backup berkala `data/wedding.db` (atau DB Postgres Anda).

## 🛠️ Teknologi

Node.js (>= 22.5) · Express · `node:sqlite` (bawaan) · HTML/CSS/JS vanilla · multi-tenant
