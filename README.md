# 💍 Aplikasi Undangan Pernikahan Online

Undangan pernikahan digital full-stack: **Node.js + Express + SQLite**, frontend HTML/CSS/JS tanpa build step.

## ✨ Fitur

**Halaman undangan (`/`)**
- Cover pembuka dengan nama tamu otomatis dari link personal (`/?to=slug`)
- Hero + kutipan (ayat/quote)
- Countdown mundur ke hari-H (real-time, ada pesan "telah berlangsung" bila lewat)
- Profil mempelai + foto + Instagram + nama orang tua
- Cerita cinta
- Rangkaian acara (akad & resepsi) + tombol lokasi Google Maps
- Galeri foto
- **Form RSVP** (hadir / ragu / tidak hadir, jumlah orang)
- **Buku tamu / ucapan** — tampil langsung saat dikirim
- **Amplop digital** (bank & e-wallet) dengan tombol salin nomor
- Musik latar (bisa diputar/dijeda)
- Desain responsif + animasi scroll

**Halaman admin (`/admin`)** — password default `admin123`
- Ringkasan statistik (tamu, RSVP, perkiraan hadir, ucapan)
- Daftar RSVP
- Kelola tamu undangan: tambah, hapus, salin link personal
- Moderasi ucapan (hapus)
- Edit data mempelai, foto, quote, musik, ganti password

## 🚀 Menjalankan

```bash
npm install          # install dependencies
npm run seed         # (opsional) isi data contoh — otomatis jalan saat pertama kali

npm start            # jalankan server
# atau
npm run dev          # mode watch (auto-reload)
```

Buka **http://localhost:3000** — admin di **http://localhost:3000/admin**

> Ganti port: `PORT=3100 npm start`

## 🗂️ Struktur

```
wedding-invitation/
├── server/
│   ├── index.js          # server Express + semua API
│   └── db/
│       ├── schema.js     # skema SQLite + migrasi ringan
│       └── seed.js       # data contoh
├── public/
│   ├── index.html        # halaman undangan
│   ├── css/style.css
│   ├── js/app.js
│   └── admin/index.html  # dashboard admin
└── data/wedding.db       # database (auto-dibuat)
```

## 🔌 API

**Publik**
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/api/invitation` | Semua data undangan (couple, events, gallery, gifts, wishes, stats) |
| GET | `/api/guest/:slug` | Info tamu dari link personal |
| POST | `/api/rsvp` | Kirim konfirmasi kehadiran |
| POST | `/api/wishes` | Kirim ucapan |
| GET | `/api/stats` | Statistik ringan |

**Admin** (header `x-admin-password`)
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| POST | `/api/admin/login` | Cek password |
| GET | `/api/admin/summary` | Ringkasan |
| GET | `/api/admin/rsvp` | Daftar RSVP |
| GET/POST/DELETE | `/api/admin/guests` | Kelola tamu |
| GET/DELETE | `/api/admin/wishes` | Moderasi ucapan |
| PUT | `/api/admin/couple` | Update mempelai |
| PUT | `/api/admin/settings` | Update quote/musik/password |

## 📨 Kirim Undangan Personal

Setiap tamu punya slug unik. Bagikan link berikut via WhatsApp:

```
https://domain-anda.com/?to=budi-santoso
```

Nama tamu akan muncul otomatis di cover & form. Salin link langsung dari halaman admin (tombol **Salin Link**).

## 🎨 Kustomisasi

Ganti warna tema di `public/css/style.css` bagian `:root` (`--sage`, `--gold`, `--cream`, dst). Semua konten dapat diubah lewat halaman admin tanpa menyentuh kode.

## 📝 Catatan Produksi

- **Ganti password admin** (tab Mempelai & Setelan) sebelum publikasi.
- Ganti nomor rekening & foto contoh dengan data asli.
- Untuk hosting: jalankan di VPS/Render/Railway, atau gunakan reverse proxy (Nginx) + HTTPS.
- Backup berkala file `data/wedding.db`.

## 🛠️ Teknologi

Node.js · Express · better-sqlite3 · HTML/CSS/JS vanilla

<!-- pushed via gpush helper -->
