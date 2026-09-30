# Rancangan Fitur: Impor Konfigurasi JSON (Elementor / Landingstar) → Data Undangan Kita

> **Status:** DRAFT — dokumen rancangan, BELUM ada perubahan kode.
> **Ruang lingkup:** desain & spesifikasi. Implementasi menyusul di fase terpisah.
> **Penulis:** riset otomatis atas basis kode `workspace/wedding-invitation`.

---

## 1. Latar Belakang & Tujuan

Banyak calon client sudah punya (atau agensi kirimkan) file ekspor **template undangan
Elementor / Landingstar** berbentuk JSON (hasil "Export Template" atau impor via
`landingstar.id/wedding`). Sampel nyata yang dipakai untuk merancang fitur ini:

- `landingstarwedding (1).json` — judul `LW001`, 8 section, widget lengkap
  (heading, icon-box, divider, image-box, image-carousel, google_maps, button).
- `landingstarwedding (2).json` — judul `LW002`, 6 section, widget
  (heading, icon, image-box, image, button).

**Tujuan:** sediakan alur **"Impor JSON"** di panel admin (`/u/:slug/admin`) yang
memetakan otomatis isi template Elementor/Landingstar → tabel & settings undangan
kita (`couple`, `events`, `gallery`, `gifts`, `settings`), sehingga:

1. Client tidak perlu mengetik ulang nama mempelai, tanggal, venue, galeri, dsb.
2. Hasil impor = **draft**, client me-review & koreksi lewat form admin yang sudah ada.
3. **Tidak menyentuh** data RSVP/ucapan/tamu (data runtime, bukan bagian template).
4. Aman: nilai yang tidak dikenal / berbahaya dibuang, bukan disimpan.

**Bukan tujuan (out of scope):** mereplikasi tata letak/CSS Elementor, mengimpor
widget interaktif (maps embed, carousel JS), atau menyalin foto lintas-domain
otomatis tanpa aksi user.

---

## 2. Kondisi Saat Ini (hasil riset kode)

### 2.1 Model data tujuan (multi-tenant)

Semua tabel konten berkunci `account_id` (`svelte/src/lib/server/schema.ts`,
salinan legacy `server/db/schema.js`):

| Tabel | Kolom relevan | Catatan |
|---|---|---|
| `couple` | `groom_name, groom_full, groom_ig, groom_photo, groom_parents, bride_name, bride_full, bride_ig, bride_photo, bride_parents, love_story` | 1 baris/account (`UNIQUE account_id`) |
| `events` | `key, title, date_iso, time_text, venue, address, maps_url, sort` | `UNIQUE (account_id, key)`; list → replace-all |
| `gallery` | `url, caption, sort` | url wajib aman |
| `gifts` | `type, bank_name, account_no, account_name, sort` | `type` NOT NULL (fallback `'bank'`) |
| `settings` | key-value bebas | **hanya** key di whitelist yang tersimpan |

### 2.2 Titik integrasi yang sudah ada (dipakai ulang, jangan diduplikasi)

- **`PUT /api/admin/content`** (`svelte/src/routes/api/admin/content/+server.ts`)
  — jalur resmi menulis konten. Body: `{ account?, couple?, events[], gallery[], gifts[], settings{} }`.
  Semua nilai lewat `clampStr`/`isSafeUrl` + whitelist enum. **Strategi
  replace-all** untuk list & bersifat **atomik** (`tx`). Ini adalah *satu-satunya*
  pintu tulis yang sebaiknya dipakai importer agar validasi konsisten.
- **`ADMIN_SETTING_KEYS`** (di file content) — whitelist key settings admin.
- **`SETTING_KEYS` / `publicSettings()`** (`svelte/src/lib/server/invitation.ts`).
- **`LIMITS`, `clampStr`, `isSafeUrl`, `slugify`** (`svelte/src/lib/server/util.ts`).
- **`normalizeDecoAsset`/`normalizeDecoSlot`** + `COVER_MODES`/`DECORATIONS`.
- **Auth admin:** `requireAccountAdmin(event)` + `enforceRate(...)` (`lib/server/auth.ts`).
- **Preseden UI impor-ekspor:** tombol `exportCsv()` sudah ada di tab Pengaturan/ucapan
  (`u/[slug]/admin/+page.svelte`); pola serupa dipakai untuk tombol Impor.
- **Preseden unggah file:** `POST /api/admin/upload/image` (`lib/server/upload.ts`)
  mengembalikan `{ url }` — dipakai untuk menyelamatkan foto lintas-domain (opsional).

### 2.3 Bentuk JSON sumber (Elementor / Landingstar)

Struktur **rekursif**, level dokumen → section → column → widget:

```jsonc
{
  "title": "LW001",
  "type": "page",
  "version": "0.4",
  "page_settings": {},                 // biasanya kosong
  "content": [                         // array SECTION (top-level)
    {
      "id": "259a481",
      "elType": "section",
      "isInner": false,
      "settings": { "background_image": {"url":"…"}, "background_overlay_color":"#879BAF", … },
      "elements": [
        { "elType": "column", "settings": {…},
          "elements": [
            { "elType": "widget", "widgetType": "heading",
              "settings": { "title":"The Wedding Of", "title_color":"#FFB3B1", … },
              "elements": [] }
          ] }
      ]
    }
  ]
}
```

Widget yang muncul di kedua sampel (yang kita pedulikan untuk mapping):

| `widgetType` | Field kunci di `settings` |
|---|---|
| `heading` | `title` (teks, boleh HTML `<br>/<b>`), `title_color`, tipografi |
| `divider` | `text` (label section, mis. "Detail Pernikahan"), `style` |
| `icon-box` | `selected_icon.value` (mis. `far fa-calendar-alt`), `title_text`, `description_text` |
| `image-box` | `image.url`, `image.id`, `title_text`, `description_text` |
| `image-carousel` | `carousel: [{id,url}, …]` |
| `image` | `image.url` |
| `google_maps` | `address`, `zoom`, `height` |
| `button` | `text`, `selected_icon.value`, `background_color` |
| `spacer` | `space.size` (abaikan) |

> **Penting:** tidak ada field "penanda makna" (mis. `data-bind="groom_name"`).
> Pemetaan harus berbasis **heuristik posisi + isi** (lihat §4). Urutan section di
> sampel konsisten: *cover → detail acara → tentang mempelai → galeri → maps →
> konfirmasi → penutup/doa → footer*.

---

## 3. Arsitektur Usulan

```
[Admin UI: tab baru "Impor"] 
      │  (upload .json ATAU tempel teks)
      ▼
POST /api/admin/import/preview   → server parse + map  → struktur InvitationData + LAPORAN
      │                                                   (status per-field: ok/perlu-review/gagal)
      ▼
[Admin UI: tampilkan pratinjau + laporan, client koreksi]
      ▼
POST /api/admin/import/apply     → server re-validasi + tulis (transaksi)
      │                              ↳ reuse logika PUT /api/admin/content
      ▼
{ ok, applied: {...}, skipped: [...] }
```

**Prinsip kunci:**

1. **Dua fase (preview → apply).** Fase *preview* hanya membaca & mengembalikan
   usulan (tidak menulis apa pun). Fase *apply* menulis. Ini mencegah impor
   "buta" yang menimpa data tanpa persetujuan.
2. **Parser murni & deterministik.** 1 fungsi `parseElementor(json)` → objek
   netral (`ImportDraft`), terpisah dari I/O, mudah diuji unit.
3. **Reuse jalur tulis yang ada.** `apply` pada akhirnya memanggil ulang
   validasi `PUT /api/admin/content` (via helper internal bersama), bukan menulis
   SQL sendiri — agar whitelist/clamp selalu sinkron.
4. **Tidak destruktif terhadap data runtime.** Importer **tidak** menyentuh
   `guests`, `rsvp`, `wishes`. Field yang tidak ada di template → `null`/kosong,
   dan pada apply gunakan **mode merge default = hanya isi yang kosong** (lihat §7).

---

## 4. Strategi Pemetaan (Mapping Engine)

Karena tidak ada penanda semantik, gunakan **analisis terurut atas `content`**:
flatten dokumen menjadi daftar node dengan `path` (index section/column) lalu
klasifikasi per peran menggunakan kombinasi **tipe widget + kata kunci + posisi**.

### 4.1 Helper

- `flatten(content)` → daftar `{ widgetType, settings, sectionIndex, order }`.
- `textOf(widget)` → bersihkan HTML (`<br>`→`\n`, buang tag lain, decode entitas).
- `sectionLabel(section)` → teks `divider` pertama dalam section (kandidat nama section).
- `firstMatch(list, predicate)` / `allMatches`.

### 4.2 Tabel pemetaan

| Peran | Sumber (heuristik) | Target |
|---|---|---|
| **Judul pasangan** | `heading` di section pertama yang teksnya mengandung `&` / `dan` / `And`, atau `heading` dengan font script (`Great Vibes`/`Playfair Display`/`Dancing`) & ukuran ≥ 40px | `couple.bride_name`/`groom_name` (split), `accounts.title` |
| **Nama lengkap mempelai** | `image-box` (atau `heading`) di section ber-`divider` "tentang mempelai"; dua node → pria/wanita (urutan: box pertama = groom, kedua = bride; jika ambiggu → tandai perlu-review) | `couple.groom_full` / `bride_full` |
| **Foto mempelai** | `image-box.image.url` dari node di atas | `couple.groom_photo` / `bride_photo` (setelah §5) |
| **Kutipan/doa** | `heading` panjang (≥120 char) di section penutup, atau section ber-`heading` "Kami Menanti"/ayat | `settings.quote` |
| **Tanggal acara** | `icon-box` dengan ikon `fa-calendar*` → `title_text` (mis. "Jumat, 18 April 2021") | `events[].date_iso` (parse → ISO) |
| **Waktu acara** | `icon-box` ikon `fa-clock*` → `title_text` ("15.00 WIB") | `events[].time_text` |
| **Venue** | `icon-box` ikon `fa-map-marker*` → `title_text`; `google_maps.address` → address lengkap | `events[].venue` / `events[].address` |
| **Peta** | `google_maps.address` → bangun URL pencarian | `events[].maps_url` |
| **Label acara** | teks `divider` sekitar (mis. "Akad"/"Resepsi") atau default `'acara'`, `'resepsi'` | `events[].key`, `events[].title` |
| **Galeri** | semua `image-carousel.carousel[].url` **+** `widget image` di section ber-`divider` "Gallery"/"Galeri", **+** `image-box.image.url` bila tak terpakai sebagai foto mempelai | `gallery[].url`, `gallery[].caption` |
| **Tombol WA/RSVP** | `button` dengan ikon `fa-whatsapp` atau teks "Konfirmasi" | **diabaikan** (RSVP kita sendiri) — catat di laporan sebagai *skipped* |
| **Latar cover/hero** | `section[0].settings.background_image.url` (+ `background_image_mobile.url`, `background_overlay_color`, `background_overlay_opacity`, `background_position/size/repeat/attachment`) | `settings.background_image`, `background_image_mobile`, `background_overlay`, `background_overlay_opacity`, `background_position/size/repeat/attachment` |
| **Warna aksen tema** | `heading.title_color` / `divider.color` paling dominan | *opsional* → usulan tema kustom (§6.4) |
| **Footer copyright** | `heading` teks berawal `©` | **diabaikan** |

### 4.3 Parsing tanggal & waktu (rapuh, wajib defensif)

- **Tanggal** (`"Jumat, 18 April 2021"`): kamus `Bulan Indonesia → MM` +
  regex `(\d{1,2})\s+(\w+)\s+(\d{4})` → `YYYY-MM-DD`. Gagal → `date_iso=''` +
  tandai **perlu-review**. Zona waktu: perlakukan sebagai tanggal kalender lokal.
- **Waktu** (`"15.00 WIB"`): regex `(\d{1,2})[.:](\d{2})` → simpan apa adanya ke
  `time_text` (kita tidak menyimpan jam terstruktur).
- **`date_iso`** untuk form admin memakai `datetime-local` → simpan
  `YYYY-MM-DDTHH:mm` bila jam tersedia, jika tidak `YYYY-MM-DD`.

### 4.4 Kasus ambigu & kebijakan

| Kasus | Kebijakan |
|---|---|
| Dua `image-box` tanpa label gender | Asumsi **groom = node pertama**, **bride = kedua** — beri badge "perlu-review" di pratinjau |
| `heading` judul tak punya pemisah `&` | Taruh seluruh teks di `bride_name`, kosongkan `groom_name`, tandai review |
| Lebih dari satu venue / tidak ada `icon-box` | Buat **satu** `events` default `key='acara'`, sisanya tandai review |
| Gambar lintas-domain (http/https pihak ketiga) | Jangan simpan langsung; tawarkan **"Simpan lokal"** (§5) atau simpan URL + peringatan |
| Widget tak dikenal (`icon`, `spacer`, `text-editor`, dst.) | Abaikan, catat di `skipped[]` |

---

## 5. Penanganan Gambar (penting)

Sampel memakai URL lintas-domain (`nikahan.vercell.my.id`, `landingstar.id`).
Menyimpan URL pihak ketiga apa adanya → gambar bisa hilang (hotlink/nanti dihapus).

**Rekomendasi (default: tawarkan, bukan paksa):**

1. Fase *preview*: tandai setiap gambar dengan sumbernya
   (`remote`/`local`/`unknown`).
2. Fase *apply* opsi **`imageMode`**:
   - `"link"` (default, cepat): simpan URL apa adanya (lolos `isSafeUrl`).
   - `"download"` (disarankan): server `fetch()` tiap gambar remote → simpan via
     `upload.ts` ke `data/uploads/img-<uniq>.<ext>` → simpan `/uploads/…`.
     - Batas: MIME gambar (JPG/PNG/WEBP/AVIF/GIF, **tanpa SVG**), maks per file
       `IMAGE_MAX_MB`, timeout fetch, total maks N gambar.
     - **SSRF guard:** hanya izinkan host publik; tolak IP privat/loopback/
       `169.254.*`/`file:`; ikuti redirect terbatas.
3. Klien bisa membatalkan unduhan per-gambar di UI pratinjau.

> Alternatif non-teknis: instruct client untuk mengunggah foto sendiri via tab
> Tampilan/unggah yang sudah ada.

---

## 6. Detail Perubahan (fase implementasi, TIDAK dikerjakan di dokumen ini)

### 6.1 Parser bersama (baru)

- `svelte/src/lib/importer/elementor.ts` — `parseElementor(json): ImportDraft`.
  - Murni, tanpa I/O, tanpa `$env`. Ekspor juga `detectFormat()` (Elementor vs
    varian lain) untuk 400 yang informatif.
- `svelte/src/lib/importer/types.ts` — `ImportDraft`, `ImportReport`,
  `FieldStatus = 'ok'|'review'|'skipped'|'error'`.
- Tipe `ImportDraft` = subset `InvitationData` (couple/events/gallery/settings)
  **+** `report` (per-field) **+** `images[]` (url, source, usedFor).

### 6.2 Endpoint (baru)

| Method | Path | Fungsi |
|---|---|---|
| `POST` | `/api/admin/import/preview` | Terima JSON (body `{json}` ATAU `multipart` file), kembalikan `ImportDraft` + laporan. **Tidak menulis.** |
| `POST` | `/api/admin/import/apply` | Terima `ImportDraft` (yang sudah dikoreksi client) + `{mode, imageMode}`; validasi & tulis. |

Keduanya:
- Auth `requireAccountAdmin(event)`; `enforceRate('admin-write', …)` di apply.
- Batas ukuran body JSON (mis. 2 MB) & kedalaman rekursi flatten (mis. 12 level,
  cegah DoS `elements` bersarang). **Wajib**: guard kedalaman & jumlah node.
- Tanpa key baru di whitelist selain key settings yang **sudah** ada di
  `ADMIN_SETTING_KEYS`.

### 6.3 Integrasi tulis (`apply`)

Agar validasi satu sumber, refactor `PUT /api/admin/content` → fungsi inti
`applyContent(accountId, payload)` yang dipakai **baik** oleh PUT maupun import.
`apply` tinggal menyusun `payload` dari `ImportDraft` lalu memanggilnya.

- List (`events`,`gallery`) memakai **replace-all atomik** (perilaku existing).
- `settings` memakai upsert per-key (existing).
- `mode`:
  - `"fill-empty"` (default): hanya tulis field yang saat ini **kosong**;
    field existing yang terisi tidak ditimpa. Paling aman untuk client lama.
  - `"overwrite"`: timpa seperti `PUT` biasa (dengan konfirmasi eksplisit di UI).

### 6.4 UI Admin (tab baru "Impor")

Mengikuti gaya tab existing (`tabs`, kartu, `btn/ghost`):

1. Area unggah drag-drop `.json` **atau** textarea tempel JSON.
2. Tombol **Pratinjau** → render:
   - Ringkasan: nama pasangan, jumlah event, galeri, kutipan, jumlah gambar.
   - Daftar field dengan badge status (✅ ok, ⚠️ perlu-review, ⏭️ dilewati).
   - Form inline untuk koreksi cepat (mirip field tab Konten).
   - Thumbnail gambar + centang "unduh lokal".
3. Pilih `mode` & `imageMode`, tekan **Terapkan**.
4. Toast hasil: `X field ditulis, Y dilewati`.

### 6.5 (Opsional) Usulan tema kustom

Jika warna aksen terdeteksi (`title_color`/`color` dominan), tampilkan usulan
tema kustom via `POST /api/admin/themes` → `{ base:'botanical', tokens:{'--gold':color} }`.
**Fase 2**, tidak wajib.

---

## 7. Keamanan & Validasi (daftar periksa)

- [ ] Terapkan `clampStr` + `LIMITS` pada semua teks (nama, venue, alamat, kutipan).
- [ ] `isSafeUrl` untuk **semua** URL (foto, galeri, background, maps_url).
- [ ] Enum: `cover_mode`, `decoration`, `decoration_animated` dilewatkan
      `normalize*` existing; nilai asing → default.
- [ ] `background_overlay_opacity` di-clamp 0–1.
- [ ] **Buang HTML** dari teks (`textOf`), jangan pernah render HTML mentah
      Elementor (cegah XSS tersimpan).
- [ ] Batas: ukuran JSON, jumlah node, kedalaman rekursi, jumlah gambar unduhan.
- [ ] SSRF guard pada mode `download` (host publik saja, tanpa redirect ke privat).
- [ ] Rate-limit + auth admin; hanya menulis ke `account_id` milik sesi.
- [ ] Jangan sentuh `guests/rsvp/wishes` (data runtime) — hanya konten template.
- [ ] Idempoten: apply dua kali dengan `mode=fill-empty` tidak menggandakan
      (list replace-all → aman; settings upsert → aman).

---

## 8. Contoh Pemetaan (sampel `LW001`)

| Sumber (JSON) | Nilai | Target |
|---|---|---|
| `section[0] heading "Fajira & Dion"` (Great Vibes 92px) | `Fajira & Dion` | `couple.bride_name=Fajira`, `groom_name=Dion`, `accounts.title` |
| `icon-box fa-calendar "Jumat, 18 April 2021"` | → `2021-04-18` | `events[acara].date_iso` |
| `icon-box fa-clock "15.00 WIB"` | `15.00 WIB` | `events[acara].time_text` |
| `icon-box fa-map-marker "Hotel Indonesia, Jakarta"` | — | `events[acara].venue` |
| `google_maps.address` | alamat lengkap | `events[acara].address`, `maps_url` (query) |
| `image-box "Dion Cahya Putra"` (foto 12) | — | `couple.groom_full`, `groom_photo` |
| `image-box "Fajira Dian Eka"` (foto 13) | — | `couple.bride_full`, `bride_photo` |
| `image-carousel.carousel[]` (5 url) | — | `gallery[]` |
| `heading` doa panjang (>120 char) | teks doa | `settings.quote` |
| `section[0].settings.background_image` | `…pexels-min-an-758898.jpg` | `settings.background_image` |
| `button "Konfirmasi Via Whatsapp"` | — | **skipped** (RSVP internal) |
| `heading "© 2021 Wedding Of …"` | — | **skipped** (footer) |

---

## 9. Kriteria Penerimaan (Acceptance)

1. Impor `LW001.json` → pratinjau menampilkan nama pasangan benar, 1 event dengan
   tanggal `2021-04-18`, ≥5 galeri, kutipan doa, latar cover — semua bertanda ✅/⚠️.
2. `LW002.json` (6 section, `image` tunggal tanpa carousel) juga terparsing tanpa error.
3. Apply dengan `mode=fill-empty` pada account **kosong** → seluruh field terisi;
   pada account **berisi** → tidak ada data lama yang tertimpa.
4. `guests/rsvp/wishes` **tidak berubah** setelah impor.
5. JSON cacat (bukan Elementor / rusak / terlalu dalam) → `400` dengan pesan
   Indonesia jelas, **tanpa** efek tulis.
6. Tidak ada tag HTML Elementor yang tersisa di DB (terbukti dengan uji unit `textOf`).
7. Gambar `imageMode=download` tersimpan di `/uploads/` & tampil di halaman tamu.
8. `npm run check` (svelte-check) hijau; uji unit parser hijau.

---

## 10. Rencana Uji

- **Unit (parser):** fixtures = `LW001.json`, `LW002.json`, + kasus tepi
  (kosong, `content` bukan array, judul tanpa `&`, tanggal tak dikenal,
  carousel kosong, `elements` dalam 50 level).
- **Integrasi (endpoint):** preview tidak menulis (cek row count), apply idempoten,
  otorisasi (tanpa `x-admin-password` → 401), rate-limit.
- **E2E manual:** unggah → pratinjau → koreksi → apply → cek halaman `/u/:slug`.

---

## 11. Fase Implementasi (usulan)

| Fase | Isi | Keluaran |
|---|---|---|
| **F1** | Parser murni + tipe + fixtures + uji unit | `elementor.ts` lulus unit test |
| **F2** | Endpoint `preview` (baca saja) + refactor `applyContent` | API pratinjau |
| **F3** | Endpoint `apply` + `mode` fill-empty/overwrite | API tulis |
| **F4** | Tab UI "Impor" (unggah, pratinjau, koreksi, apply) | fitur end-to-end |
| **F5** | `imageMode=download` + SSRF guard | gambar lokal |
| **F6** | (opsional) usulan tema kustom dari warna | nice-to-have |

---

## 12. Risiko & Mitigasi

| Risiko | Tingkat | Mitigasi |
|---|---|---|
| Heuristik salah pasang groom/bride | Sedang | Badge perlu-review + form koreksi; jangan auto-commit tanpa preview |
| Tanggal format bebas / bahasa lain | Sedang | Parser defensif; gagal → tandai review, isi manual |
| Hotlink mati / domain mati | Sedang | `imageMode=download` default-disarankan |
| XSS dari HTML Elementor | Tinggi | `textOf` buang tag + escape saat render |
| JSON raksasa / rekursif | Sedang | Batas ukuran, node, kedalaman |
| Duplikasi logika validasi | Sedang | Reuse `applyContent` tunggal |
| Perbedaan skema legacy (`server/db`) vs SvelteKit | Rendah | Fitur baru **hanya** di SvelteKit; legacy tak disentuh |

---

## 13. Referensi Berkas (tidak diubah oleh dokumen ini)

- Skema: `svelte/src/lib/server/schema.ts`, `server/db/schema.js`
- Tulis konten: `svelte/src/routes/api/admin/content/+server.ts`
- Data & settings: `svelte/src/lib/server/invitation.ts`
- Util: `svelte/src/lib/server/util.ts`
- Unggah: `svelte/src/lib/server/upload.ts`
- Auth: `svelte/src/lib/server/auth.ts`
- Tipe: `svelte/src/lib/types.ts`
- UI admin: `svelte/src/routes/u/[slug]/admin/+page.svelte`
- Preseden ekspor: `svelte/src/routes/api/admin/export/[type]/+server.ts`
- Sampel sumber: `landingstarwedding (1).json` (`LW001`), `landingstarwedding (2).json` (`LW002`)
```
