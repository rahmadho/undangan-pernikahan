# 🚀 Panduan Deploy ke VPS — Node LTS + pm2 + Cloudflare

Panduan langkah demi langkah men-deploy aplikasi undangan ke **VPS sendiri**
(Ubuntu/Debian) memakai **SQLite**, **Node.js LTS terbaru**, **pm2** sebagai
process manager, **Nginx** sebagai reverse proxy, dan **Cloudflare** untuk DNS + HTTPS.

> **Stack produksi yang diasumsikan:**
> - Runtime: **Node.js LTS terbaru** (Node 24.x; minimal Node 22.5 — lihat catatan)
> - Process manager: **pm2** (bukan systemd)
> - Web server: **Nginx** (sudah terpasang di server)
> - DNS + HTTPS: **Cloudflare** (bukan certbot/Let's Encrypt)
> - Domain contoh: **undangan.rahmadho.my.id**
> - Database: **SQLite** (satu file)

> ⚠️ **Bun TIDAK BISA dipakai** untuk aplikasi ini. Kode memakai modul bawaan
> Node.js `node:sqlite`, yang **belum ada di Bun**. Jalankan dengan `node`,
> bukan `bun`. Bun tetap boleh ada di server untuk tooling lain — keduanya
> koeksis tanpa konflik.

> **Kenapa SQLite dulu?** Untuk jasa undangan (< ~200 undangan), SQLite adalah
> satu file, sangat cepat, gratis, dan gampang di-backup. Aplikasi dirancang agar
> bisa pindah ke PostgreSQL nanti tanpa mengubah query
> (lihat `README.md` → "Menggunakan PostgreSQL").

---

## 0. Prasyarat

- VPS Ubuntu 22.04 / 24.04 (atau Debian 12). RAM 1 GB sudah cukup.
- Nginx sudah terpasang & jalan.
- Domain `undangan.rahmadho.my.id` sudah dikelola di **Cloudflare**.
- Akses SSH sebagai user dengan `sudo`.

---

## 1. Pasang Node.js LTS terbaru

Aplikasi memakai **`node:sqlite`** yang butuh **Node ≥ 22.5**. Instal **Node 24.x** (LTS terbaru).

```bash
# NodeSource repo untuk Node 24 (LTS terbaru)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs git sqlite3

node -v   # harus v24.x (>= 22.5)
npm -v
```

> **Ingin versi lebih matang?** Node **22.x** juga LTS dan valid — cukup ganti
> `setup_24.x` menjadi `setup_22.x`. Keduanya jalan untuk proyek ini.
>
> **Sudah punya Bun?** Tidak masalah. Kita memakai `node`; Bun dibiarkan apa adanya.

> ℹ️ `node:sqlite` masih berstatus *experimental*, sehingga muncul
> `ExperimentalWarning` di log. Itu **normal & tidak berbahaya**. Bila ingin log
> bersih, jalankan pm2 dengan `--node-args="--no-warnings"` (lihat langkah 5).

---

## 2. Pasang pm2

```bash
sudo npm install -g pm2
pm2 -v
```

> Jalankan pm2 sebagai **user biasa** (bukan root). Gunakan `sudo` hanya untuk
> perintah `pm2 startup` (yang memang mengatur systemd di balik layar).

---

## 3. Ambil kode & pasang dependensi

```bash
sudo mkdir -p /opt/undangan
sudo chown "$USER":"$USER" /opt/undangan
git clone <URL-REPO-ANDA> /opt/undangan
cd /opt/undangan

# Produksi: tanpa devDependencies
npm install --omit=dev
```

---

## 4. Konfigurasi environment (.env)

```bash
cp .env.example .env
nano .env
```

Isi:

```ini
PORT=3000
TRUST_PROXY=1

DB_CLIENT=sqlite
DATABASE_PATH=/opt/undangan/data/wedding.db   # PENTING: path absolut

# Ganti! Ini membuat owner pertama (dipakai hanya saat tabel owners masih kosong)
OWNER_USERNAME=owner
OWNER_PASSWORD=SANDI-KUAT-ANDA-DI-SINI
```

> ⚠️ **`DATABASE_PATH` wajib path absolut** dan direktorinya persisten
> (jangan `/tmp`). Direktori `data/` dibuat otomatis bila belum ada.
>
> ⚠️ **`TRUST_PROXY=1` WAJIB.** Di belakang Cloudflare + Nginx, app harus
> mempercayai satu hop proxy agar IP tamu & rate-limit terbaca benar. Kalau
> salah, semua tamu terlihat sebagai IP Nginx → rate-limit bisa memblokir
> semua orang sekaligus.

---

## 5. Siapkan database (pertama kali)

```bash
npm run migrate        # buat skema + owner + data contoh (bila kosong)

# (opsional) kalau TIDAK mau data contoh:
node server/db/migrate.js --no-seed
```

Setelah ini `data/wedding.db` tercipta.

---

## 6. Jalankan dengan pm2

```bash
cd /opt/undangan
pm2 start server/index.js --name undangan --time --node-args="--no-warnings"
pm2 save
pm2 startup        # ikuti perintah yang dicetak, lalu jalankan baris tsb
```

`pm2 startup` akan menampilkan satu perintah `sudo env ...` — **salin & jalankan**
perintah itu agar pm2 otomatis start saat VPS reboot.

Verifikasi:

```bash
pm2 status          # "undangan" harus status: online
pm2 logs undangan   # lihat log real-time (Ctrl+C untuk keluar)
curl -s http://127.0.0.1:3000/healthz
# -> {"status":"ok","db":"sqlite","uptime":...}
```

Perintah pm2 yang sering dipakai:

| Perintah | Fungsi |
|----------|--------|
| `pm2 status` | Lihat semua proses |
| `pm2 logs undangan` | Lihat log |
| `pm2 restart undangan` | Restart setelah update |
| `pm2 reload undangan` | Restart tanpa downtime (bila cluster) |
| `pm2 stop undangan` | Hentikan sementara |
| `pm2 delete undangan` | Hapus dari daftar pm2 |
| `pm2 save` | Simpan daftar proses saat ini |

---

## 7. Nginx sebagai reverse proxy

```bash
sudo nano /etc/nginx/sites-available/undangan
```

```nginx
server {
    listen 80;
    server_name undangan.rahmadho.my.id;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        # Kunci agar IP asli (dari Cloudflare) diteruskan ke Node:
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktifkan & reload:

```bash
sudo ln -s /etc/nginx/sites-available/undangan /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

> **Jika Nginx-mu sudah punya config "catch-all"/default**, pastikan blok di atas
> **diprioritaskan** untuk `server_name undangan.rahmadho.my.id` (server_name paling
> spesifik biasanya menang). Uji dengan `sudo nginx -T | grep -A5 undangan.rahmadho.my.id`.

---

## 8. Cloudflare (DNS + HTTPS)

Karena Cloudflare menangani HTTPS di edge, **tidak perlu certbot**.

1. **DNS** → tambah record:
   - Type: `A` · Name: `undangan` · Content: `IP-VPS-ANDA`
   - **Proxy status: Proxied** (awan oranye ☁️ menyala)
2. **SSL/TLS → Overview** → set mode **Full**
   - ⚠️ **Jangan "Flexible"** — menyebabkan redirect loop.
   - "Full (strict)" juga OK, **tapi** butuh **Cloudflare Origin Certificate**
     terpasang di Nginx. Untuk kesederhanaan, pakai **Full**.
3. **SSL/TLS → Edge Certificates** → **Always Use HTTPS: ON**.
4. (Opsional) **Speed → Optimization**: biarkan default.

> Origin (Nginx) cukup `listen 80`. Cloudflare yang menyajikan HTTPS ke tamu.

---

## 9. Akses & verifikasi

- Panel owner: **https://undangan.rahmadho.my.id/owner** → login `OWNER_USERNAME` / `OWNER_PASSWORD`
- Health check: **https://undangan.rahmadho.my.id/healthz**
  → harus `{"status":"ok","db":"sqlite"}`

Langkah pasca-deploy:

1. **Ganti password owner** via panel owner (env hanya dipakai saat owner pertama dibuat).
2. Buat akun client pertama, pilih template, berikan `/u/<slug>/admin` + sandi ke client.
3. Bagikan link tamu: `https://undangan.rahmadho.my.id/u/<slug>?to=<slug-tamu>`.

---

## 10. Backup (WAJIB, jangan dilewat)

SQLite = satu file, tapi mode WAL memakai `-wal`/`-shm`. Cara paling aman:
perintah `.backup` bawaan `sqlite3`.

```bash
mkdir -p /opt/undangan/backups
sqlite3 /opt/undangan/data/wedding.db ".backup '/opt/undangan/backups/wedding-$(date +%F).db'"
```

### Backup harian otomatis (cron)

```bash
crontab -e
```

Tambahkan (setiap hari 02:00, simpan 14 hari):

```cron
0 2 * * * sqlite3 /opt/undangan/data/wedding.db ".backup '/opt/undangan/backups/wedding-$(date +\%F).db'" && find /opt/undangan/backups -name 'wedding-*.db' -mtime +14 -delete
```

### Restore

```bash
pm2 stop undangan
cp /opt/undangan/backups/wedding-2025-01-01.db /opt/undangan/data/wedding.db
pm2 start undangan
```

---

## 11. Update aplikasi (redeploy)

```bash
cd /opt/undangan
git pull
npm install --omit=dev
pm2 restart undangan
pm2 save
```

Data di `data/wedding.db` **tidak tersentuh** oleh update (selama `DATABASE_PATH`
tidak diubah). Migrasi skema berjalan otomatis saat start.

---

## 12. Troubleshooting

| Gejala | Penyebab & solusi |
|--------|-------------------|
| `Cannot find module 'node:sqlite'` | Node < 22.5, atau menjalankan dengan `bun`. Pasang Node 24 (langkah 1) & jalankan via `node`/`pm2`. |
| `ERR_REQUIRE_ESM` / error Bun | Dijalankan dengan Bun. Ganti ke `pm2 start server/index.js`. |
| Proses pm2 mati terus | `pm2 logs undangan` untuk lihat error. |
| Tidak auto-start setelah reboot | Jalankan `pm2 startup` dan **jalankan perintah `sudo env ...` yang dicetak**, lalu `pm2 save`. |
| Data hilang setelah restart | `DATABASE_PATH` menunjuk ke disk ephemeral. Pakai path absolut persisten. |
| Redirect loop (ERR_TOO_MANY_REDIRECTS) | Cloudflare SSL mode "Flexible". Ubah ke **Full**. |
| Rate-limit salah / IP `::1` | `TRUST_PROXY` salah. Set `TRUST_PROXY=1` (berlaku karena Nginx 1 hop). |
| 502 Bad Gateway | App tidak jalan / port beda. Cek `pm2 status` & `PORT` di `.env` cocok dengan `proxy_pass`. |
| Port 3000 sudah dipakai | Set `PORT` lain di `.env`, sesuaikan `proxy_pass`, lalu `pm2 restart undangan`. |
| Undangan "Masa Aktif Berakhir" | Perpanjang dari panel owner (tombol +30 hari). |

---

## 13. Nanti: pindah ke PostgreSQL

Bila skala tumbuh, lihat **`README.md` → "Menggunakan PostgreSQL (Produksi)"**.
Ringkasnya: set `DB_CLIENT=postgres` + `DATABASE_URL`, jalankan `npm run migrate`,
dan selesaikan refactor `async/await` pada handler (satu-satunya pekerjaan manual).
Query & struktur tabel tidak perlu dirombak.
