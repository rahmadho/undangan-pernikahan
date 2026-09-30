# `src/lib/importer/` — Parser Impor Elementor/Landingstar

Parser **murni** (tanpa I/O, tanpa DB) yang memetakan ekspor JSON
Elementor/Landingstar → `ImportDraft` siap direview client sebelum ditulis.

Rujukan rancangan: `docs/import-json-rancangan.md` (Fase F1).

## Berkas

| Berkas | Isi |
|---|---|
| `types.ts` | Tipe `ImportDraft`, `ImportReport`, `FieldStatus`, `ImageRef`, `IMPORT_LIMITS`. |
| `elementor.ts` | `parseElementor()`, `detectFormat()` + helper murni (`textOf`, `parseDateId`, `parseTimeId`, `splitCouple`, `imageUrl`, `imageSource`). |
| `elementor.test.ts` | Uji unit (`node:test`) — termasuk bukti pada JSON nyata user. |
| `fixtures/LW001.json` | Ekspor nyata user, tema LW001 ("Fajira & Dion"). |
| `fixtures/LW002.json` | Ekspor nyata user, tema LW002 ("Gilbert & Hana"). |

## Menjalankan uji unit

```bash
# dari folder svelte/
node --test --experimental-strip-types src/lib/importer/elementor.test.ts
```

Node ≥ 22.6 diperlukan (`--experimental-strip-types`).

## Karakteristik

- **Murni & deterministik** — input tak dimutasi; dua kali parse → hasil identik.
- **Defensif** — toleran `elements` list-of-list, batas kedalaman (`maxDepth`) &
  jumlah node (`maxNodes`), pesan galat Bahasa Indonesia.
- **Anti-XSS** — semua teks lewat `textOf()` (HTML dibuang, entity didecode);
  tidak pernah ada markup Elementor yang lolos.
- **Tidak menulis apa pun** — hanya menyusun draft + laporan; fase `apply`
  (endpoint, fase berikutnya) yang memvalidasi ulang lewat `PUT /api/admin/content`.

## Peran pria/wanita (groom/bride)

Urutan kartu mempelai (`image-box`: kartu pertama = **pria**, kedua = **wanita**)
adalah sinyal **otoritatif** `groom_*`/`bride_*`. Judul pasangan dipisah jadi dua
sisi; bila salah satu sisi judul cocok dengan nama lengkap mempelai di profil,
`resolveTitleOrientation()` memakai peran dari profil. Ini menangani tema yang
menulis **"Bride & Groom"** (wanita lebih dulu), mis. **LW001 "Fajira & Dion"**
(&rarr; `groom=Dion`, `bride=Fajira`). Bila tidak ada info profil, konvensi
lazim "Groom & Bride" (kiri = pria) dipakai. Uji regresi: `elementor.test.ts`
§6b + uji nyata LW001.
