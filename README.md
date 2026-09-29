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
npm run migrate # (opsional) siapkan skema + owner + data contoh di server baru
npm run seed    # (opsional) buat ulang data contoh
```

Buka:
- Panel pemilik: **http://localhost:3000/owner** → login `owner` / `owner123`
- Contoh undangan: **http://localhost:3000/u/demo** (admin: `/u/demo/admin`, sandi `admin123`)
- Health check: **http://localhost:3000/healthz**

> Konfigurasi lewat file **`.env`** (salin dari `.env.example`), mis.: `PORT`, `TRUST_PROXY`,
> `DB_CLIENT`, `DATABASE_PATH`, `DATABASE_URL`, `OWNER_USERNAME`, `OWNER_PASSWORD`.
> ⚠️ **Ganti password owner & client default sebelum publikasi.**

## 🗂️ Struktur

```
undangan-saas/
├── server/
│   ├── env.js            # memuat .env (dotenv / fallback bawaan)
│   ├── index.js          # server Express + semua API (publik, client admin, owner)
│   ├── security.js       # hash password (scrypt), rate limit, security headers
│   └── db/
│       ├── index.js      # pemilih backend (DB_CLIENT=sqlite|postgres)
│       ├── sqlite.js     # adapter SQLite (node:sqlite bawaan, sinkron)
│       ├── postgres.js   # adapter Postgres (driver pg, asinkron) — untuk produksi
│       ├── schema.js     # skema multi-tenant + migrasi otomatis + dialect() SQLite→PG
│       ├── seed.js       # data contoh (owner + account demo)
│       └── migrate.js    # CLI: siapkan skema + seed (npm run migrate)
├── public/
│   ├── index.html        # halaman undangan (mobile-first + nav bawah)
│   ├── css/style.css     # styling + 6 tema
│   ├── js/app.js
│   ├── admin/index.html  # dashboard client (self-contained)
│   └── owner/index.html  # panel pemilik (self-contained)
├── Dockerfile · docker-compose.yml · .dockerignore · .env.example
├── CLAUDE.md             # catatan proyek untuk AI agent
└── data/wedding.db       # database SQLite (auto-dibuat)
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

Ada **6 tema** (dipilih owner saat membuat, bisa diganti client kapan saja). Tiap tema
punya palet **dan** tipografi berbeda:

| Tema | Nuansa | Font judul | Font script |
|------|--------|-----------|-------------|
| **Botanical** (default) | Sage hijau & emas — natural, tenang | Cormorant Garamond | Great Vibes |
| **Midnight Luxe** | Latar gelap & emas — dramatis, mewah | Playfair Display | Great Vibes |
| **Ivory Blush** | Rose & krem — lembut, romantis | Lora | Italianno |
| **Javanese Heritage** | Cokelat batik & kunyit — hangat, tradisional | Marcellus | Pinyon Script |
| **Modern Minimal** | Netral tegas — bersih, kontemporer | Space Grotesk | — |
| **Baroque Gold** | Ungu tua & emas — mewah, klasik | Cormorant Garamond | Tangerine |

Tema didefinisikan sebagai variabel CSS di `public/css/style.css`
(`body.theme-<nama> { ... }`). Menambah tema baru cukup menyalin satu blok
`body.theme-*` + menambahkannya di: `THEMES` (`public/js/app.js`), opsi di
`admin/index.html` & `owner/index.html`, dan `validThemes` di `server/index.js`.

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

## 🚀 Panduan Deploy ke Server

Aplikasi ini **satu proses Node.js** + database. Prinsip utama:

- **Data WAJIB di volume persisten.** Untuk SQLite, `data/wedding.db` harus berada di
  volume (bukan disk sementara/ephemeral container) — kalau tidak, data hilang saat redeploy.
- **Set env** sesuai `.env.example` (salin jadi `.env` untuk lokal; isi langsung di dashboard
  hosting untuk produksi).
- **Ganti kredensial default** (`OWNER_USERNAME`/`OWNER_PASSWORD`) sebelum publik.

### Opsi A — VPS (paling murah, kontrol penuh)

Contoh Ubuntu 22.04+, dengan SQLite:

```bash
git clone <repo> && cd undangan-pernikahan
npm install --omit=dev
cp .env.example .env      # lalu edit: OWNER_PASSWORD, dst.
PORT=3000 node server/index.js   # cek jalan
```

Agar tetap hidup setelah logout, pakai **systemd** (`/etc/systemd/system/undangan.service`):

```ini
[Unit]
Description=Undangan SaaS
After=network.target

[Service]
WorkingDirectory=/opt/undangan-pernikahan
EnvironmentFile=/opt/undangan-pernikahan/.env
ExecStart=/usr/bin/node server/index.js
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

Lalu `systemctl enable --now undangan`. Di depannya pasang **Nginx** (reverse proxy) +
**HTTPS Let's Encrypt**, dan arahkan `proxy_pass http://127.0.0.1:3000;` dengan
header `Host`/`X-Forwarded-*` (aplikasi sudah `trust proxy`).

### Opsi B — Docker (VPS / cloud apa saja)

```bash
docker compose up -d --build     # app + (opsional) Postgres
```

- Default compose memakai **SQLite** dengan volume `app-data` (persisten).
- Untuk **Postgres**: aktifkan blok `DB_CLIENT=postgres` + `DATABASE_URL` di
  `docker-compose.yml`, tambahkan `depends_on: [db]`, lalu
  `docker compose exec app node server/db/migrate.js` untuk membuat skema.

### Opsi C — Platform (Render / Railway / Fly.io)

Semua platform ini mendukung **Node + volume persisten** dan mengisi `$PORT` otomatis.

1. **Build:** `npm install` · **Start:** `npm start` · **Health check:** `/healthz`.
2. Tambahkan **Persistent Volume**, mount ke `/data`, dan set `DATABASE_PATH=/data/wedding.db`.
3. Isi env: `OWNER_USERNAME`, `OWNER_PASSWORD`, `TRUST_PROXY=1` (dan DB bila memakai Postgres).
4. Deploy → buka `/owner`, buat akun client pertama.

> ⚠️ Pastikan **Node ≥ 22.5** terpasang/terpilih (memakai `node:sqlite`). Di Render set
> `NODE_VERSION=22`, di Railway pilih image Node 22, Fly.io gunakan `Dockerfile` ini.

## 🐘 Menggunakan PostgreSQL (Produksi, skala besar)

SQLite **sangat cukup** untuk < ~200 undangan (rekomendasi default). Pindah ke Postgres
saat butuh multi-server / trafik tinggi / replikasi.

### Pengaturan Postgres

1. Sediakan server Postgres (Neon/Supabase/RDS/Docker). Dapatkan **connection string**.
2. Pastikan driver terpasang: `npm i pg` (sudah ada di `optionalDependencies`, tapi
   `npm install --omit=optional` tidak memasangnya — jadi install eksplisit bila perlu).
3. Set env (di `.env` atau dashboard hosting):

   ```
   DB_CLIENT=postgres
   DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME
   PGSSL=false              # hanya bila Postgres lokal tanpa SSL (docker-compose)
   ```

4. **Buat skema:** `node server/db/migrate.js` (atau otomatis saat `npm start` pertama).
5. Selesai. Adapter `server/db/postgres.js` menerjemahkan `?`/`@name` → `$1,$2,...` otomatis.

### ⚠️ Satu langkah manual (WAJIB)

`node:sqlite` **sinkron**, sedangkan `pg` **asinkron**. Agar benar-benar jalan di Postgres,
seluruh handler Express yang menyentuh DB harus diubah jadi `async` + `await`:

```js
// dari:
wrap((req, res) => { const row = db.prepare('SELECT 1').get(); ... })
// menjadi:
wrapAsync(async (req, res) => { const row = await db.prepare('SELECT 1').get(); ... })
```

Struktur tabel, isolasi tenant (`account_id`), dan semua SQL sudah kompatibel — hanya
butuh penambahan `async/await` (lihat `wrap`/`wrapAsync` di `server/index.js`).

> 💡 **Jujur soal ini:** tanpa refactor async tersebut, aplikasi **belum** benar-benar
> berjalan di atas `pg`. Karena itu untuk produksi cepat, **SQLite + volume persisten**
> (semua data satu file, gampang di-backup) seringkali pilihan paling praktis.

## 📝 Catatan Produksi

- **Ganti password owner** (`/owner`) & semua sandi client default. Set `OWNER_PASSWORD`
  di env **sebelum** start pertama (dipakai hanya saat tabel `owners` masih kosong).
- Ganti nomor rekening & foto contoh dengan data asli tiap client.
- Backup berkala `data/wedding.db` (atau DB Postgres Anda).
- Health check tersedia di `/healthz` untuk load balancer / platform.
- `npm run migrate` menyiapkan skema + owner + data contoh di server baru.

## 🛠️ Teknologi

Node.js (>= 22.5) · Express · `node:sqlite` (default) / PostgreSQL `pg` (opsional) ·
HTML/CSS/JS vanilla · multi-tenant · Docker
