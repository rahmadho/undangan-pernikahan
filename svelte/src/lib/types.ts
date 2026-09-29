/** Tipe data undangan (dipakai frontend & API). */

export interface Couple {
	groom_name: string;
	groom_full?: string;
	groom_ig?: string;
	groom_photo?: string;
	groom_parents?: string;
	bride_name: string;
	bride_full?: string;
	bride_ig?: string;
	bride_photo?: string;
	bride_parents?: string;
	love_story?: string;
}

export interface EventItem {
	id: number;
	key: string;
	title: string;
	date_iso: string;
	time_text?: string;
	venue?: string;
	address?: string;
	maps_url?: string;
}

export interface GalleryItem {
	id: number;
	url: string;
	caption?: string;
}

export interface GiftItem {
	id: number;
	type: string;
	bank_name?: string;
	account_no?: string;
	account_name?: string;
}

export interface WishItem {
	id: number;
	name: string;
	message: string;
	attending?: string;
	created_at?: string;
}

/**
 * Mode tampilan foto cover (lihat CoverPhoto.svelte).
 * - plain    : foto bulat sederhana di tengah
 * - frame    : bingkai persegi rounded + border putih (kartu foto)
 * - shadow   : foto tanpa bingkai, bayangan lembut menonjol
 * - polaroid : gaya polaroid (bingkai putih tebal, caption di bawah)
 * - arch     : lengkung atas (arch/gate) khas undangan adat
 * - circle   : lingkaran penuh dengan ring emas
 * - none     : tanpa foto (hanya latar)
 */
export type CoverMode = 'plain' | 'frame' | 'shadow' | 'polaroid' | 'arch' | 'circle' | 'none';

/** Pilihan ornamen/dekorasi cover. */
export type Decoration = 'floral' | 'leaves-sway' | 'ethnic-jawa' | 'ethnic-minang' | 'none';

/** Nilai default bila setting belum diisi. */
export const DEFAULT_COVER_MODE: CoverMode = 'plain';
export const DEFAULT_DECORATION: Decoration = 'floral';

/** Deskriptor opsi cover untuk dirender jadi kartu pilihan di panel admin. */
export interface CoverPhotoOption {
	/** Nilai yang disimpan ke settings.cover_mode. */
	value: CoverMode;
	/** Label singkat di UI. */
	label: string;
	/** Keterangan kecil di bawah label. */
	hint: string;
	/** Ikon/emoji pratinjau. */
	icon: string;
}

/** Daftar opsi foto cover (sumber tunggal untuk UI picker). */
export const COVER_PHOTO_OPTIONS: CoverPhotoOption[] = [
	{ value: 'plain', label: 'Bulat', hint: 'Foto bulat sederhana', icon: '⚪' },
	{ value: 'frame', label: 'Bingkai', hint: 'Kartu foto berbingkai', icon: '🖼️' },
	{ value: 'shadow', label: 'Bayangan', hint: 'Tanpa bingkai, bayangan tebal', icon: '🌑' },
	{ value: 'polaroid', label: 'Polaroid', hint: 'Bingkai putih ala polaroid', icon: '📸' },
	{ value: 'arch', label: 'Lengkung', hint: 'Arch/gate khas adat', icon: '🕌' },
	{ value: 'circle', label: 'Lingkaran Emas', hint: 'Bulat + ring emas', icon: '🟡' },
	{ value: 'none', label: 'Tanpa Foto', hint: 'Hanya latar (tanpa foto)', icon: '🚫' }
];

/** Deskriptor opsi dekorasi cover. */
export const DECORATION_OPTIONS: { value: Decoration; label: string }[] = [
	{ value: 'floral', label: 'Bunga Floral' },
	{ value: 'leaves-sway', label: 'Daun Berayun' },
	{ value: 'ethnic-jawa', label: 'Adat Jawa' },
	{ value: 'ethnic-minang', label: 'Adat Minang' },
	{ value: 'none', label: 'Tanpa Dekorasi' }
];

export interface Settings {
	music_url: string;
	quote: string;
	theme: string;
	video_url: string;
	live_url: string;
	live_text: string;
	qris_image: string;
	gift_address: string;
	gift_enabled: string;
	watermark_text: string;
	watermark_enabled: string;
	background_image: string;
	background_image_mobile: string;
	background_overlay: string;
	background_overlay_opacity: string;
	background_position: string;
	background_size: string;
	background_repeat: string;
	background_attachment: string;
	background_position_mobile: string;
	background_size_mobile: string;
	background_repeat_mobile: string;
	// Opsi foto & dekorasi cover (fitur baru)
	/** Mode tampilan foto cover. */
	cover_mode: CoverMode;
	/** URL foto cover (kosong = hanya latar). */
	cover_photo: string;
	/** Jenis ornamen dekorasi. */
	decoration: Decoration;
	/** '1' = dekorasi bergerak, '0' = diam. */
	decoration_animated: string;
	/**
	 * Dekorasi tambahan dari ASET FILE LOKAL (opsional, di atas Ornament inline).
	 * Nilai = id dari katalog `decoAssets.ts`, atau 'none' (default).
	 */
	decoration_asset: string;
	/** Di mana aset lokal ditampilkan: 'both' | 'cover' | 'hero'. */
	decoration_asset_slot: string;
}

export interface CustomTheme {
	id: number;
	slug: string;
	name: string;
	base: string;
	tokens: Record<string, string>;
}

export interface InvitationData {
	account: { id: number; slug: string; title?: string; theme: string };
	couple: Couple | null;
	events: EventItem[];
	gallery: GalleryItem[];
	gifts: GiftItem[];
	wishes: WishItem[];
	settings: Settings;
	themes: CustomTheme[];
}
