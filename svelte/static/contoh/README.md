# Contoh Data Undangan Premium

Folder ini berisi **contoh undangan premium** yang bisa langsung dipakai:

| Berkas | Isi | Cara pakai |
|---|---|---|
| `undangan-premium-contoh.json` | Format **Elementor/Landingstar** (sama seperti ekspor dari layanan undangan digital) | Panel admin → tab **Impor** → unggah/tempel berkas ini → Pratinjau → Terapkan |
| `undangan-premium-data.json` | Format **data internal** (couple, events, gallery, gifts, settings) — hasil ekspor `GET /api/admin/content` | Untuk seed langsung / backup |

## Isi contoh: "Bagas & Laras"

Contoh ini dirancang agar **terasa seperti undangan nyata berkualitas tinggi**
(bukan data contoh generik), dengan konfigurasi tampilan yang serasi:

- **Tema**: `javanese` (adat Jawa — elegan & kaya), ornamen `floral` + aset `corner-rose`
- **Cover**: foto bentuk `arch` (lengkung) — paling imersif
- **Gradasi**: `luluh` (foto menyatu halus ke halaman), kekuatan `medium`
- **Efek**: parallax halus, transisi `fade`, reveal `rise` (intensitas `subtle`)
- **Animasi ornamen**: masuk `grow`, lalu `sway`
- **Konten realistis**: nama lengkap + gelar, nama orang tua, cerita perjalanan
  3 babak, akad & resepsi dengan venue nyata (Semarang), 6 foto galeri,
  kutipan QS. Ar-Rum: 21, 2 rekening hadiah.

## Kenapa desainnya "premium"

1. **Data nyata & spesifik** — nama, venue, cerita yang masuk akal (bukan "Lorem/Contoh").
2. **Tampilan serasi** — tema, ornamen, gradasi, dan efek saling mendukung (bukan campur acak).
3. **Efek secukupnya** — halus & terkendali; tidak berlebihan (yang berlebihan justru terasa murah).
4. **Foto terkurasi** — nuansa hangat/editorial, bukan stok klise.

## Catatan impor

- Gambar masih berupa **URL Unsplash** (mode `link`). Untuk undangan nyata,
  ganti dengan **foto asli** Anda melalui panel admin (unggah).
- Setelah impor, buka tab **Tampilan** untuk menyetel ulang tema/efek bila ingin
  variasi lain. Bundle preset akan menimpa ornamen/dekorasi; setel ulang setelahnya.

## Regenerasi

```bash
# dari root repo
node _demo/gen-premium-json.mjs     # hasilkan ulang JSON Elementor
node _demo/apply-premium.mjs        # terapkan langsung ke akun "demo"
```
