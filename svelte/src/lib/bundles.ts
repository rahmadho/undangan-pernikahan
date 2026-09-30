/**
 * bundles.ts — BUNDLE PRESET: sekali pilih tema, ornamen + bingkai foto +
 * dekorasi ikut berubah otomatis sesuai karakter tema.
 *
 * Latar belakang
 * --------------
 * Sebelum ini, tema hanya mengubah palet warna & font (`theme.ts` /
 * `style.css`), sedangkan ornamen (`decoration`), bingkai foto (`cover_mode`),
 * dan aset dekorasi lokal (`decoration_asset`) harus diatur manual satu per
 * satu di panel admin. Akibatnya tema adat bisa tampil dengan bunga Eropa, dsb.
 *
 * Modul ini memetakan SETIAP tema preset ke satu set pilihan yang SERASI
 * (bundle). Admin cukup menekan "Pakai Bundle" pada sebuah tema, dan ornamen +
 * bingkai foto + dekorasi + animasi diisi otomatis.
 *
 * Prinsip
 * -------
 *  - ADDITIF & AMAN: nilai yang dihasilkan SELALU subset dari nilai yang sudah
 *    divalidasi server (`DECORATIONS`, `COVER_MODES`, `DECO_ASSET_IDS`,
 *    `DECO_SLOTS`). Tidak ada nilai baru yang bocor ke DB/CSS.
 *  - TIDAK merusak tema kustom: bundle hanya mengisi key yang memang diatur
 *    (decoration, cover_mode, decoration_asset, decoration_asset_slot,
 *    decoration_animated). Warna/font tetap milik tema.
 *  - SUMBER KEBENARAN TUNGGAL: dipakai admin (render tombol) & diserbukkan ke
 *    banyak tema. Nilai divalidasi ulang di server saat disimpan.
 *
 * ⚠️ Kalau menambah tema preset: tambahkan entri bundle di sini agar tema
 *    tersebut juga punya setelan serasi (fallback `FALLBACK_BUNDLE` dipakai
 *    bila belum ada — aman, tidak error).
 */

/** Setting keys yang ditulis ulang oleh sebuah bundle. */
export interface BundleSettings {
	decoration: string;
	cover_mode: string;
	decoration_asset: string;
	decoration_asset_slot: string;
	decoration_animated: string;
}

/** Deskriptor satu bundle preset (per tema). */
export interface BundlePreset {
	/** Slug tema preset (harus ada di `THEMES`). */
	theme: string;
	/** Verba pendek untuk tombol (mis. "Pakai Nuansa Adat Minang"). */
	label: string;
	/** Nilai setelan yang diterapkan. */
	settings: BundleSettings;
}

/** Nilai default aman bila tema belum punya bundle eksplisit. */
export const FALLBACK_BUNDLE: BundleSettings = {
	decoration: 'floral',
	cover_mode: 'frame',
	decoration_asset: 'none',
	decoration_asset_slot: 'both',
	decoration_animated: '1'
};

/**
 * 13 BUNDLE PRESET — satu per tema. Urutannya mengikuti `THEMES`
 * (preset lama dulu, lalu adat, lalu tambahan).
 */
export const BUNDLE_PRESETS: BundlePreset[] = [
	{
		// Botanical: bunga & sulur Eropa, bingkai foto arch (taman).
		theme: 'botanical',
		label: 'Taman Botani',
		settings: {
			decoration: 'floral',
			cover_mode: 'arch',
			decoration_asset: 'corner-vine',
			decoration_asset_slot: 'both',
			decoration_animated: '1'
		}
	},
	{
		// Midnight: gelap elegan, bingkai lingkaran emas + sparkle.
		theme: 'midnight',
		label: 'Malam Berkilau',
		settings: {
			decoration: 'floral',
			cover_mode: 'circle',
			decoration_asset: 'flourish',
			decoration_asset_slot: 'both',
			decoration_animated: '1'
		}
	},
	{
		// Blush: lembut romantis, polaroid + sebaran kelopak.
		theme: 'blush',
		label: 'Sendu Romantis',
		settings: {
			decoration: 'floral',
			cover_mode: 'polaroid',
			decoration_asset: 'petals-scatter',
			decoration_asset_slot: 'both',
			decoration_animated: '1'
		}
	},
	{
		// Javanese: batik & sogan, bingkai arch + ubin kawung.
		theme: 'javanese',
		label: 'Batik Jawa',
		settings: {
			decoration: 'ethnic-jawa',
			cover_mode: 'arch',
			decoration_asset: 'kawung-tile',
			decoration_asset_slot: 'both',
			decoration_animated: '0'
		}
	},
	{
		// Minimal: bersih & tenang, tanpa ornamen, bingkai bayangan.
		theme: 'minimal',
		label: 'Minimalis Tenang',
		settings: {
			decoration: 'none',
			cover_mode: 'shadow',
			decoration_asset: 'none',
			decoration_asset_slot: 'both',
			decoration_animated: '0'
		}
	},
	{
		// Baroque: mewah klasik, bunga flourish + bingkai kartu.
		theme: 'baroque',
		label: 'Barok Mewah',
		settings: {
			decoration: 'floral',
			cover_mode: 'frame',
			decoration_asset: 'flourish',
			decoration_asset_slot: 'both',
			decoration_animated: '0'
		}
	},
	{
		// Adat Minang: songket emas, bingkai arch + pembatas motif.
		theme: 'adat-minang',
		label: 'Nuansa Adat Minang',
		settings: {
			decoration: 'ethnic-minang',
			cover_mode: 'arch',
			decoration_asset: 'divider-motif',
			decoration_asset_slot: 'both',
			decoration_animated: '0'
		}
	},
	{
		// Adat Jawa: songket kawung, bingkai arch + ubin kawung.
		theme: 'adat-jawa',
		label: 'Nuansa Adat Jawa',
		settings: {
			decoration: 'ethnic-jawa',
			cover_mode: 'arch',
			decoration_asset: 'kawung-tile',
			decoration_asset_slot: 'both',
			decoration_animated: '0'
		}
	},
	{
		// Rustic Terracotta: bumi & dedaunan, bingkai polaroid + sulur.
		theme: 'rustic-terracotta',
		label: 'Rustic Bumi',
		settings: {
			decoration: 'leaves-sway',
			cover_mode: 'polaroid',
			decoration_asset: 'vine-left',
			decoration_asset_slot: 'both',
			decoration_animated: '1'
		}
	},
	{
		// Emerald Luxury: hijau zamrud & emas, lingkaran emas + flourish.
		theme: 'emerald-luxury',
		label: 'Zamrud Mewah',
		settings: {
			decoration: 'floral',
			cover_mode: 'circle',
			decoration_asset: 'flourish',
			decoration_asset_slot: 'both',
			decoration_animated: '0'
		}
	},
	{
		// Rose Gold: mawar keemasan, bingkai lengkung + sudut sulur.
		theme: 'rose-gold',
		label: 'Rose Gold',
		settings: {
			decoration: 'floral',
			cover_mode: 'arch',
			decoration_asset: 'corner-vine',
			decoration_asset_slot: 'both',
			decoration_animated: '1'
		}
	},
	{
		// Dusty Blue: biru kelabu sejuk, bingkai bayangan + sebaran kelopak.
		theme: 'dusty-blue',
		label: 'Biru Senja',
		settings: {
			decoration: 'leaves-sway',
			cover_mode: 'shadow',
			decoration_asset: 'petals-scatter',
			decoration_asset_slot: 'both',
			decoration_animated: '1'
		}
	},
	{
		// Sakura: kelopak merah muda Jepang, bingkai lengkung + kelopak.
		theme: 'sakura',
		label: 'Sakura Jepang',
		settings: {
			decoration: 'floral',
			cover_mode: 'arch',
			decoration_asset: 'petals-scatter',
			decoration_asset_slot: 'both',
			decoration_animated: '1'
		}
	}
];

/** Peta cepat theme → bundle. */
const BY_THEME = new Map<string, BundlePreset>(BUNDLE_PRESETS.map((b) => [b.theme, b]));

/**
 * Ambil setelan bundle untuk sebuah tema.
 * Selalu mengembalikan objek valid (fallback bila tema belum punya bundle).
 */
export function getBundle(theme: string | null | undefined): BundleSettings {
	const t = typeof theme === 'string' ? theme.trim() : '';
	const b = BY_THEME.get(t);
	return b ? { ...b.settings } : { ...FALLBACK_BUNDLE };
}

/** Ambil deskriptor bundle (untuk UI); fallback dibuat on-the-fly. */
export function getBundlePreset(theme: string | null | undefined): BundlePreset {
	const t = typeof theme === 'string' ? theme.trim() : '';
	return BY_THEME.get(t) ?? { theme: t, label: t, settings: { ...FALLBACK_BUNDLE } };
}

/** Apakah tema punya bundle eksplisit? */
export function hasBundle(theme: string | null | undefined): boolean {
	return BY_THEME.has(typeof theme === 'string' ? theme.trim() : '');
}
