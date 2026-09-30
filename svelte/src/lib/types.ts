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

/**
 * Mode efek foto (filter CSS) untuk foto galeri, mempelai, & cover.
 * - none    : tanpa efek (foto apa adanya)
 * - warm    : hangat keemasan (sepia halus)
 * - cool    : sejuk kebiruan
 * - mono    : hitam-putih elegan
 * - vintage : pudar klasik ala film
 * - vivid   : kontras & saturasi dinaikkan
 * - soft    : lembut, sedikit buram & cerah
 */
export type PhotoFilter = 'none' | 'warm' | 'cool' | 'mono' | 'vintage' | 'vivid' | 'soft';

/** Intensitas efek premium (mengatur besar/kecepatan). */
export type EffectIntensity = 'subtle' | 'medium' | 'bold';

/**
 * Gaya animasi reveal saat scroll (X-axis masuk + varian lain).
 * Nilai lama `[data-reveal]` tetap dipakai sebagai default (`fade-up`).
 */
export type RevealStyle = 'fade-up' | 'fade' | 'zoom' | 'flip' | 'slide' | 'blur';

/**
 * Gaya transisi antar-section.
 * - none  : potongan keras (default, hemat daya)
 * - wave  : pembatas gelombang
 * - fade  : gradasi lembut antar latar
 * - curve : lengkung halus
 */
export type SectionTransition = 'none' | 'wave' | 'fade' | 'curve';

/** Nilai default efek premium (semua NONAKTIF kecuali transisi minimal). */
export const DEFAULT_PHOTO_FILTER: PhotoFilter = 'none';
export const DEFAULT_EFFECT_INTENSITY: EffectIntensity = 'medium';
export const DEFAULT_REVEAL_STYLE: RevealStyle = 'fade-up';
export const DEFAULT_SECTION_TRANSITION: SectionTransition = 'none';

/**
 * Deskriptor opsi efek premium untuk dirender jadi kartu/chip di panel admin.
 * SUMBER KEBENARAN TUNGGAL untuk label UI (halaman tamu hanya membaca nilai).
 */
export interface EffectOption<T extends string> {
	value: T;
	label: string;
	hint: string;
	icon: string;
}

export const PHOTO_FILTER_OPTIONS: EffectOption<PhotoFilter>[] = [
	{ value: 'none', label: 'Asli', hint: 'Tanpa filter', icon: '🚫' },
	{ value: 'warm', label: 'Hangat', hint: 'Keemasan lembut', icon: '🌅' },
	{ value: 'cool', label: 'Sejuk', hint: 'Nuansa kebiruan', icon: '❄️' },
	{ value: 'mono', label: 'Monokrom', hint: 'Hitam-putih', icon: '⚫' },
	{ value: 'vintage', label: 'Vintage', hint: 'Pudar klasik', icon: '📼' },
	{ value: 'vivid', label: 'Vivid', hint: 'Kontras & tajam', icon: '🌈' },
	{ value: 'soft', label: 'Lembut', hint: 'Cerah & buram', icon: '☁️' }
];

export const EFFECT_INTENSITY_OPTIONS: EffectOption<EffectIntensity>[] = [
	{ value: 'subtle', label: 'Halus', hint: 'Efek minimal', icon: '🪶' },
	{ value: 'medium', label: 'Sedang', hint: 'Seimbang', icon: '⚖️' },
	{ value: 'bold', label: 'Kuat', hint: 'Efek mencolok', icon: '💥' }
];

export const REVEAL_STYLE_OPTIONS: EffectOption<RevealStyle>[] = [
	{ value: 'fade-up', label: 'Naik', hint: 'Muncul dari bawah', icon: '⬆️' },
	{ value: 'fade', label: 'Pudar', hint: 'Hanya memudar', icon: '🌫️' },
	{ value: 'zoom', label: 'Zoom', hint: 'Membesar lembut', icon: '🔍' },
	{ value: 'flip', label: 'Balik', hint: 'Putar 3D halus', icon: '🔄' },
	{ value: 'slide', label: 'Geser', hint: 'Masuk dari samping', icon: '➡️' },
	{ value: 'blur', label: 'Blur', hint: 'Kabur lalu tajam', icon: '💨' }
];

export const SECTION_TRANSITION_OPTIONS: EffectOption<SectionTransition>[] = [
	{ value: 'none', label: 'Tanpa', hint: 'Potongan keras', icon: '⬜' },
	{ value: 'wave', label: 'Gelombang', hint: 'Pembatas ombak', icon: '🌊' },
	{ value: 'fade', label: 'Gradasi', hint: 'Memudar lembut', icon: '🌁' },
	{ value: 'curve', label: 'Lengkung', hint: 'Sudut membulat', icon: '◠' }
];

/** Nilai filter foto yang valid (untuk pemakaian runtime aman). */
export const PHOTO_FILTERS: readonly PhotoFilter[] = [
	'none', 'warm', 'cool', 'mono', 'vintage', 'vivid', 'soft'
];

/** Nilai intensitas yang valid. */
export const EFFECT_INTENSITIES: readonly EffectIntensity[] = ['subtle', 'medium', 'bold'];

/** Nilai gaya reveal yang valid. */
export const REVEAL_STYLES: readonly RevealStyle[] = ['fade-up', 'fade', 'zoom', 'flip', 'slide', 'blur'];

/** Nilai transisi section yang valid. */
export const SECTION_TRANSITIONS: readonly SectionTransition[] = ['none', 'wave', 'fade', 'curve'];

/* ============================================================
   GRADASI PREMIUM (BARU)
   Pencampuran warna luluh/vignette/glow/overlay pada latar hero
   & cover. Semua NONAKTIF secara default (default aman & hemat
   kinerja); tanpa `gradient_enabled = '1'` halaman tamu tetap
   tampil seperti semula.
   ============================================================ */

/**
 * Gaya gradasi premium (mengubah cara warna dilebur ke latar).
 * - none     : tanpa gradasi (default)
 * - luluh    : warna tema melebur lembut dari satu sisi (soft bleed)
 * - vignette : gelap di tepi, terang di tengah (fokus sinematik)
 * - glow     : pendar warna aksen hangat dari tepi/tengah
 * - overlay  : selubung warna rata (tint) untuk menyatukan nuansa
 */
export type GradientStyle = 'none' | 'luluh' | 'vignette' | 'glow' | 'overlay';

/**
 * Di mana gradasi dipasang.
 * - cover : hanya pada layar pembuka (cover)
 * - hero  : hanya pada bagian atas undangan (hero)
 * - both  : cover & hero (default)
 */
export type GradientTarget = 'cover' | 'hero' | 'both';

/** Basis warna gradasi: memakai palet tema atau warna kustom. */
export type GradientPalette = 'auto' | 'custom';

/** Nilai default gradasi premium (semua NONAKTIF). */
export const DEFAULT_GRADIENT_STYLE: GradientStyle = 'none';
export const DEFAULT_GRADIENT_INTENSITY: EffectIntensity = 'medium';
export const DEFAULT_GRADIENT_TARGET: GradientTarget = 'both';
export const DEFAULT_GRADIENT_PALETTE: GradientPalette = 'auto';

/** Opsi gaya gradasi (sumber tunggal untuk label UI). */
export const GRADIENT_STYLE_OPTIONS: EffectOption<GradientStyle>[] = [
	{ value: 'none', label: 'Tanpa', hint: 'Nonaktif', icon: '⬜' },
	{ value: 'luluh', label: 'Luluh', hint: 'Warna melebur lembut', icon: '🌫️' },
	{ value: 'vignette', label: 'Vignette', hint: 'Gelap di tepi', icon: '🌑' },
	{ value: 'glow', label: 'Glow', hint: 'Pendar aksen hangat', icon: '✨' },
	{ value: 'overlay', label: 'Overlay', hint: 'Selubung warna rata', icon: '🎨' }
];

/** Opsi target gradasi. */
export const GRADIENT_TARGET_OPTIONS: EffectOption<GradientTarget>[] = [
	{ value: 'cover', label: 'Cover', hint: 'Hanya layar pembuka', icon: '🚪' },
	{ value: 'hero', label: 'Hero', hint: 'Hanya bagian atas', icon: '🖼️' },
	{ value: 'both', label: 'Keduanya', hint: 'Cover & hero', icon: '∬' }
];

/** Opsi basis warna. */
export const GRADIENT_PALETTE_OPTIONS: EffectOption<GradientPalette>[] = [
	{ value: 'auto', label: 'Otomatis', hint: 'Ikut palet tema', icon: '🎯' },
	{ value: 'custom', label: 'Kustom', hint: 'Pilih warna sendiri', icon: '🖌️' }
];

/** Nilai gaya gradasi yang valid. */
export const GRADIENT_STYLES: readonly GradientStyle[] = ['none', 'luluh', 'vignette', 'glow', 'overlay'];
/** Nilai target gradasi yang valid. */
export const GRADIENT_TARGETS: readonly GradientTarget[] = ['cover', 'hero', 'both'];
/** Nilai basis warna gradasi yang valid. */
export const GRADIENT_PALETTES: readonly GradientPalette[] = ['auto', 'custom'];

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

	// ---------- EFEK PREMIUM (nonaktif secara default) ----------
	// Semua saklar memakai '1' (aktif) / '0' atau '' (nonaktif). Halaman tamu
	// hanya mengaktifkan efek bila nilainya '1' DAN pengguna tidak meminta
	// reduced-motion (lihat theme.ts: applyPremiumEffects).
	/** '1' = aktifkan animasi reveal saat scroll (IntersectionObserver). */
	effects_enabled: string;
	/** '1' = gerakkan latar hero saat scroll (parallax halus). */
	effects_parallax: string;
	/** '1' = efek ken-burns (zoom lambat) pada foto hero/cover. */
	effects_kenburns: string;
	/** '1' = tampilkan pembatas/transisi antar-section. */
	effects_transition_enabled: string;
	/** '1' = terapkan filter foto pada foto mempelai/galeri/cover. */
	effects_photo_filter_enabled: string;
	/** Gaya transisi antar-section: lihat `SectionTransition`. */
	effects_transition: SectionTransition;
	/** Gaya animasi reveal: lihat `RevealStyle`. */
	effects_reveal: RevealStyle;
	/** Intensitas efek: lihat `EffectIntensity`. */
	effects_intensity: EffectIntensity;
	/** Filter foto: lihat `PhotoFilter`. */
	effects_photo_filter: PhotoFilter;

	// ---------- GRADASI PREMIUM (nonaktif secara default) ----------
	// Saklar memakai '1' (aktif) / '0' atau '' (nonaktif). Halaman tamu hanya
	// mengaktifkan gradasi bila `gradient_enabled` = '1' DAN gayanya bukan
	// 'none' (lihat theme.ts: applyGradient).
	/** '1' = aktifkan sistem gradasi premium. */
	gradient_enabled: string;
	/** Gaya gradasi: lihat `GradientStyle`. */
	gradient_style: GradientStyle;
	/** Intensitas gradasi: lihat `EffectIntensity`. */
	gradient_intensity: EffectIntensity;
	/** Di mana gradasi dipasang: lihat `GradientTarget`. */
	gradient_target: GradientTarget;
	/** Basis warna: 'auto' (palet tema) atau 'custom' (warna di bawah). */
	gradient_palette: GradientPalette;
	/** Warna aksen gradasi (hex) saat `gradient_palette = 'custom'`. */
	gradient_color: string;
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
