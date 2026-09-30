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
	},

	/* ------------------------------------------------------------------ *
	 * Tambahan (batch 2) — JANGAN mengubah entri lama di atas.
	 * Ragam: corner (4 sudut) · block (elemen tunggal) · repeat (pola latar).
	 * ------------------------------------------------------------------ */

	/* --- corner (6) --- */
	{
		id: 'corner-fern',
		file: 'corner-fern.svg',
		label: 'Sudut Pakis',
		hint: 'Daun pakis berdaun di tiap sudut',
		kind: 'corner',
		slot: 'both'
	},
	{
		id: 'corner-frame',
		file: 'corner-frame.svg',
		label: 'Bingkai Sudut',
		hint: 'Garis bingkai siku dengan kancing',
		kind: 'corner',
		slot: 'both'
	},
	{
		id: 'corner-bloom',
		file: 'corner-bloom.svg',
		label: 'Sudut Mekar',
		hint: 'Bunga mekar di sudut dengan sulur',
		kind: 'corner',
		slot: 'both'
	},
	{
		id: 'corner-scroll',
		file: 'corner-scroll.svg',
		label: 'Sudut Gulung',
		hint: 'Gulungan klasik pada siku sudut',
		kind: 'corner',
		slot: 'both'
	},
	{
		id: 'corner-geo',
		file: 'corner-geo.svg',
		label: 'Sudut Geometris',
		hint: 'Siku & wajik rapi bergaya modern',
		kind: 'corner',
		slot: 'both'
	},
	{
		id: 'corner-lace',
		file: 'corner-lace.svg',
		label: 'Sudut Renda',
		hint: 'Tepi renda halus bergaris ganda',
		kind: 'corner',
		slot: 'both'
	},

	/* --- block (6) --- */
	{
		id: 'divider-laurel',
		file: 'divider-laurel.svg',
		label: 'Pembatas Laurel',
		hint: 'Garis pembatas dengan daun laurel',
		kind: 'block',
		slot: 'both'
	},
	{
		id: 'divider-diamond',
		file: 'divider-diamond.svg',
		label: 'Pembatas Wajik',
		hint: 'Deret wajik simetris di tengah',
		kind: 'block',
		slot: 'both'
	},
	{
		id: 'divider-ripple',
		file: 'divider-ripple.svg',
		label: 'Pembatas Gelombang',
		hint: 'Garis bergelombang lembut',
		kind: 'block',
		slot: 'both'
	},
	{
		id: 'flourish-garland',
		file: 'flourish-garland.svg',
		label: 'Untai Gantung',
		hint: 'Untai bunga menggantung ke bawah',
		kind: 'block',
		slot: 'both'
	},
	{
		id: 'flourish-leaf',
		file: 'flourish-leaf.svg',
		label: 'Rangkaian Daun',
		hint: 'Rangkaian daun simetris mengarah turun',
		kind: 'block',
		slot: 'both'
	},
	{
		id: 'flourish-medal',
		file: 'flourish-medal.svg',
		label: 'Medali Bintang',
		hint: 'Ornamen medali bintang di tengah',
		kind: 'block',
		slot: 'both'
	},

	/* --- repeat (6) --- */
	{
		id: 'tile-diamond',
		file: 'tile-diamond.svg',
		label: 'Ubin Wajik',
		hint: 'Pola wajik kembang berulang',
		kind: 'repeat',
		slot: 'both'
	},
	{
		id: 'tile-weave',
		file: 'tile-weave.svg',
		label: 'Ubin Anyaman',
		hint: 'Pola anyaman rotan berulang',
		kind: 'repeat',
		slot: 'both'
	},
	{
		id: 'tile-star',
		file: 'tile-star.svg',
		label: 'Ubin Bintang',
		hint: 'Pola bintang empat arah berulang',
		kind: 'repeat',
		slot: 'both'
	},
	{
		id: 'tile-scale',
		file: 'tile-scale.svg',
		label: 'Ubin Sisik',
		hint: 'Pola sisik ikan bertumpuk',
		kind: 'repeat',
		slot: 'both'
	},
	{
		id: 'tile-flower',
		file: 'tile-flower.svg',
		label: 'Ubin Kelopak',
		hint: 'Pola kelopak delapan arah berulang',
		kind: 'repeat',
		slot: 'both'
	},
	{
		id: 'tile-dots',
		file: 'tile-dots.svg',
		label: 'Ubin Titik',
		hint: 'Pola titik & wajik minimalis',
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
