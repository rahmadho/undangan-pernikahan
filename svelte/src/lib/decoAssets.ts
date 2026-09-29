/**
 * decoAssets.ts — KATALOG ASET DEKORASI LOKAL (self-hosted).
 *
 * Latar belakang & tujuan
 * -----------------------
 * Dekorasi bawaan (`Ornament.svelte`) adalah SVG inline yang diwarnai via
 * `currentColor` — itu tetap menjadi dekorasi UTAMA dan TIDAK diubah sama
 * sekali oleh fitur ini. Modul ini menambah lapisan dekorasi **opsional**
 * berbasis file SVG lokal di `static/deco/` yang di-*mask* warna tema.
 *
 * Mengapa file statis lokal (bukan URL/upload)?
 *  - Aman: tidak ada nilai sembarang dari user yang masuk ke DOM/CSS. Hanya
 *    `id` dari katalog ini yang diterima; server memetakan `id` → path tetap.
 *  - Offline-friendly: tidak bergantung CDN pihak ketiga.
 *  - CSP-friendly: di-*mask* lewat CSS `mask-image` (butuh img-src/style-src
 *    hanya untuk origin sendiri).
 *
 * SUMBER KEBENARAN TUNGGAL untuk daftar aset. Dipakai oleh:
 *  - server: validasi `decoration_asset` (lihat api/admin/content/+server.ts)
 *  - admin : render picker
 *  - tamu  : validasi ulang sebelum render (defense-in-depth)
 *
 * ⚠️ Kalau menambah aset: letakkan SVG di `svelte/static/deco/<file>` dan
 * tambahkan entri di bawah. JANGAN mengubah/menghapus entri lama (bisa
 * memecah setelan undangan yang sudah memakainya).
 */

export interface DecoAsset {
	/** ID stabil yang disimpan ke settings `decoration_asset`. */
	id: string;
	/** Nama file di `static/deco/` (tanpa leading slash). */
	file: string;
	/** Label singkat di UI. */
	label: string;
	/** Keterangan kecil. */
	hint: string;
	/**
	 * Cara aset diterapkan.
	 * - 'block'  : elemen tunggal (mis. flourish/sudut) di satu slot.
	 * - 'corner' : diulang di 4 sudut (diputar per sudut via CSS).
	 * - 'repeat' : dijadikan pola berulang (mask repeat) sebagai lapisan latar.
	 */
	kind: 'block' | 'corner' | 'repeat';
	/** Slot tampilan yang disarankan (UI saja, tidak dipakai logika render). */
	slot: 'cover' | 'hero' | 'both';
}

/** Nilai sentinel: tidak ada aset dekorasi lokal (default & aman). */
export const DECO_ASSET_NONE = 'none';

export const DECO_ASSETS: DecoAsset[] = [
	{
		id: 'corner-vine',
		file: 'corner-vine.svg',
		label: 'Sudut Sulur',
		hint: 'Sulur bunga di setiap sudut',
		kind: 'corner',
		slot: 'both'
	},
	{
		id: 'flourish',
		file: 'flourish.svg',
		label: 'Flourish Tengah',
		hint: 'Ornamen bunga simetris di tengah',
		kind: 'block',
		slot: 'both'
	},
	{
		id: 'vine-left',
		file: 'vine-left.svg',
		label: 'Sulur Menjuntai',
		hint: 'Ranting daun panjang di tepi',
		kind: 'block',
		slot: 'both'
	},
	{
		id: 'divider-motif',
		file: 'divider-motif.svg',
		label: 'Pembatas Motif',
		hint: 'Garis pembatas dengan hiasan tengah',
		kind: 'block',
		slot: 'both'
	},
	{
		id: 'petals-scatter',
		file: 'petals-scatter.svg',
		label: 'Sebaran Kelopak',
		hint: 'Kelopak tersebar di latar',
		kind: 'repeat',
		slot: 'both'
	},
	{
		id: 'kawung-tile',
		file: 'kawung-tile.svg',
		label: 'Ubin Kawung',
		hint: 'Pola batik kawung berulang',
		kind: 'repeat',
		slot: 'both'
	}
];

/** Set id valid untuk validasi cepat. */
export const DECO_ASSET_IDS = new Set<string>([DECO_ASSET_NONE, ...DECO_ASSETS.map((a) => a.id)]);

/** Cari aset berdasarkan id (undefined bila 'none'/tidak dikenal). */
export function getDecoAsset(id: string | null | undefined): DecoAsset | undefined {
	if (!id) return undefined;
	return DECO_ASSETS.find((a) => a.id === id);
}

/** Validasi id aset; kembalikan id bila valid, selain itu 'none'. */
export function normalizeDecoAsset(id: unknown): string {
	const v = typeof id === 'string' ? id.trim() : '';
	return DECO_ASSET_IDS.has(v) ? v : DECO_ASSET_NONE;
}

/** URL publik file aset (dipakai CSS mask). Selalu path relatif tetap. */
export function decoAssetUrl(asset: DecoAsset): string {
	return `/deco/${asset.file}`;
}
