/**
 * theme.ts (client) — terapkan tema preset/kustom + latar kustom + efek &
 * gradasi premium ke <body>. Port dari applyTheme/applyBackground di app.js lama.
 */
import { GRADIENT_STYLES } from '$lib/types';

export const THEMES = [
	// --- Preset lama (JANGAN dihapus/diubah) ---
	'botanical',
	'midnight',
	'blush',
	'javanese',
	'minimal',
	'baroque',
	// --- Tema adat (BARU) ---
	'adat-minang',
	'adat-jawa',
	// --- Tema tambahan (BARU) ---
	'rustic-terracotta',
	'emerald-luxury',
	'rose-gold',
	'dusty-blue',
	'sakura'
] as const;

export const THEME_COLORS: Record<string, string> = {
	// Preset lama
	botanical: '#f7f4ec',
	midnight: '#14131a',
	blush: '#fdf4f1',
	javanese: '#f5ecdd',
	minimal: '#f4f4f5',
	baroque: '#f6f1e7',
	// Tema adat (BARU)
	'adat-minang': '#faf3e6',
	'adat-jawa': '#f7f0e0',
	// Tema tambahan (BARU)
	'rustic-terracotta': '#faf5ef',
	'emerald-luxury': '#f6f4ee',
	'rose-gold': '#fbf3f1',
	'dusty-blue': '#f1f4f6',
	sakura: '#fdf2f4'
};

let customKeys: string[] = [];

/**
 * Terapkan tema ke <body>.
 * @param theme  slug preset atau kustom
 * @param tokens override CSS var (tema kustom)
 * @param base   preset dasar saat tema kustom
 */
export function applyTheme(theme: string, tokens?: Record<string, string> | null, base?: string | null) {
	const body = document.body;
	const isPreset = (THEMES as readonly string[]).includes(theme);
	const effective = isPreset ? theme : (THEMES as readonly string[]).includes(base || '') ? base! : 'botanical';

	THEMES.forEach((n) => body.classList.toggle('theme-' + n, n === effective));
	body.dataset.theme = theme;

	// bersihkan override sebelumnya
	customKeys.forEach((k) => body.style.removeProperty(k));
	customKeys = [];
	if (tokens && typeof tokens === 'object') {
		for (const [k, v] of Object.entries(tokens)) {
			if (!k.startsWith('--')) continue;
			body.style.setProperty(k, v);
			customKeys.push(k);
		}
	}

	const meta = document.querySelector('meta[name="theme-color"]');
	const color = (tokens && (tokens['--cream'] as string)) || THEME_COLORS[effective];
	if (meta && color) meta.setAttribute('content', color);
}

/**
 * Terapkan latar kustom dari settings.
 * Mengikuti struktur Elementor: desktop & mobile terpisah + overlay/position/size/repeat.
 */
export function applyBackground(s: Record<string, string>) {
	const body = document.body;
	const set = (k: string, v: string) => body.style.setProperty(k, v);

	// Desktop
	if (s.background_image) {
		set('--bg-hero', `url("${s.background_image}")`);
		set('--bg-cover', `url("${s.background_image}")`);
	} else {
		body.style.removeProperty('--bg-hero');
		body.style.removeProperty('--bg-cover');
	}
	// Mobile (fallback ke desktop bila kosong)
	const mobile = s.background_image_mobile || s.background_image;
	if (mobile) {
		set('--bg-hero-mobile', `url("${mobile}")`);
		set('--bg-cover-mobile', `url("${mobile}")`);
	} else {
		body.style.removeProperty('--bg-hero-mobile');
		body.style.removeProperty('--bg-cover-mobile');
	}

	// Overlay
	if (s.background_overlay) {
		const op = s.background_overlay_opacity || '0.5';
		set('--bg-overlay', `color-mix(in srgb, ${s.background_overlay} ${Math.round(Number(op) * 100)}%, transparent)`);
	} else {
		body.style.removeProperty('--bg-overlay');
	}

	set('--bg-position', s.background_position || 'center center');
	set('--bg-size', s.background_size || 'cover');
	set('--bg-repeat', s.background_repeat || 'no-repeat');
	set('--bg-attachment', s.background_attachment || 'scroll');
	set('--bg-position-mobile', s.background_position_mobile || s.background_position || 'center center');
	set('--bg-size-mobile', s.background_size_mobile || s.background_size || 'cover');
	set('--bg-repeat-mobile', s.background_repeat_mobile || s.background_repeat || 'no-repeat');
}

/* ============================================================
   GRADASI PREMIUM
   Sistem gradasi yang dapat dikustomisasi (luluh / vignette /
   glow / overlay) untuk latar cover & hero. Semua NONAKTIF
   secara default: tanpa `gradient_enabled = '1'` DAN gaya selain
   'none', tidak ada kelas/variabel yang dipasang sehingga halaman
   tamu tetap ringan & tampil seperti semula.

   Cara kerja: `applyGradient` menempelkan satu kelas
   `gradient-<gaya>` + kelas target (`gradient-on-cover` /
   `gradient-on-hero`) ke <body>, lalu mengeset beberapa CSS var
   (`--grad-ink`, `--grad-accent`, `--grad-strength`,
   `--grad-color`). Semua gaya CSS-nya ada di `style.css` (kelas
   `body.gradient-*`) sehingga tidak ada style inline berat.
   ============================================================ */

/** Intensitas → angka kekuatan gradasi (dipakai var `--grad-strength`). */
const GRADIENT_STRENGTH: Record<string, string> = {
	subtle: '0.35',
	medium: '0.6',
	bold: '0.9'
};

/** Kelas gradasi yang mungkin dipasang (untuk pembersihan idempoten). */
const GRADIENT_CLASSES = [
	'gradient-active',
	'gradient-luluh',
	'gradient-vignette',
	'gradient-glow',
	'gradient-overlay',
	'gradient-on-cover',
	'gradient-on-hero',
	'gradient-custom-color'
];

/**
 * Terapkan gradasi premium sesuai settings.
 * @returns fungsi pembersih (mengembalikan <body> ke keadaan tanpa gradasi).
 *
 * Semua nilai di sini SUDAH dinormalisasi server (`publicSettings`), tetapi
 * tetap dijaga ketat di sisi klien (defense-in-depth): gaya/target/intensitas
 * harus cocok daftar, warna harus hex — jika tidak, diabaikan.
 */
export function applyGradient(s: Record<string, string> | null | undefined): () => void {
	if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
	const body = document.body;

	// Bersihkan dulu (idempoten, aman saat re-init / SSR hydration).
	const clearGradient = () => {
		GRADIENT_CLASSES.forEach((c) => body.classList.remove(c));
		body.style.removeProperty('--grad-strength');
		body.style.removeProperty('--grad-color');
	};
	clearGradient();

	const enabled = isOn(s?.gradient_enabled);
	const style = typeof s?.gradient_style === 'string' ? s!.gradient_style : 'none';
	if (!enabled || style === 'none' || !(GRADIENT_STYLES as readonly string[]).includes(style)) {
		return clearGradient;
	}

	// Target: 'cover' | 'hero' | 'both' (default aman 'both').
	const target = ['cover', 'hero', 'both'].includes(s?.gradient_target || '')
		? (s!.gradient_target as string)
		: 'both';

	// Intensitas → kekuatan (clamp ke nilai dikenal).
	const intensity = (s?.gradient_intensity as string) || 'medium';
	const strength = GRADIENT_STRENGTH[intensity] || GRADIENT_STRENGTH.medium;

	// Pasang kelas gaya & target.
	body.classList.add('gradient-active', 'gradient-' + style);
	if (target === 'cover' || target === 'both') body.classList.add('gradient-on-cover');
	if (target === 'hero' || target === 'both') body.classList.add('gradient-on-hero');

	// Kekuatan dipakai semua gaya (radius/opasitas di CSS).
	body.style.setProperty('--grad-strength', strength);

	// Warna aksen: pakai hex kustom bila valid & paletnya 'custom', jika tidak
	// biarkan kosong → CSS memakai palet tema (--gold/--sage-dark).
	const customHex = (s?.gradient_color || '').trim();
	if (s?.gradient_palette === 'custom' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(customHex)) {
		body.classList.add('gradient-custom-color');
		body.style.setProperty('--grad-color', customHex);
	} else {
		body.classList.remove('gradient-custom-color');
		body.style.removeProperty('--grad-color');
	}

	return clearGradient;
}

/**
 * Aktifkan animasi reveal saat scroll untuk semua [data-reveal].
 *
 * Opsi:
 *  - `style`     : gaya reveal (menambah kelas `premium-reveal-<style>` di
 *                  <body>); 'fade-up' = perilaku default (tanpa kelas).
 *  - `intensity` : 'subtle' | 'medium' | 'bold' — mengatur besar gerak.
 *  - `enabled`   : bila false, semua elemen langsung ditampilkan (tanpa
 *                  animasi). Dipakai saat efek dimatikan / reduced-motion.
 */
export function initReveal(opts: { style?: string; intensity?: string; enabled?: boolean } = {}): () => void {
	const { style = 'fade-up', intensity = 'medium', enabled = true } = opts;
	const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
	const body = document.body;

	// Bersihkan kelas reveal lama agar tak menumpuk saat re-init.
	body.classList.forEach((c) => {
		if (c.startsWith('premium-reveal-') || c.startsWith('premium-intensity-')) body.classList.remove(c);
	});

	// Tidak ada IntersectionObserver / efek dimatikan → tampilkan apa adanya.
	if (!enabled || !('IntersectionObserver' in window)) {
		els.forEach((el) => el.classList.add('is-visible'));
		return () => {};
	}

	// Pasang kelas gaya & intensitas (hanya bila berbeda dari default).
	if (style && style !== 'fade-up') body.classList.add('premium-reveal-' + style);
	if (intensity && intensity !== 'medium') body.classList.add('premium-intensity-' + intensity);

	const io = new IntersectionObserver(
		(entries) => {
			entries.forEach((e) => {
				if (e.isIntersecting) {
					const el = e.target as HTMLElement;
					const delay = Number(el.dataset.revealDelay || 0);
					setTimeout(() => el.classList.add('is-visible'), delay);
					io.unobserve(el);
				}
			});
		},
		{ threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
	);
	els.forEach((el) => io.observe(el));
	return () => io.disconnect();
}

/**
 * Aktifkan REVEAL ornamen saat section-nya masuk viewport, lalu lanjutkan
 * dengan gerakan lembut ("bergoyang").
 *
 * Berbeda dari `initReveal` (yang menggerakkan teks/konten via kelas
 * `is-visible` pada elemen ber-`[data-reveal]`), sistem ini TUJUH:
 *
 *   1. Menemukan setiap SECTION-scroll (`.hero`, `.section`, `.quote-sec`,
 *      `.closing-sec`; lihat `SECTION_SELECTOR`).
 *   2. Menandai semua ornamen di dalamnya (`[data-reveal]`, `.ornament`,
 *      `.deco-asset`, `.cover-deco`, `.deco-item`) sebagai "menunggu reveal"
 *      (`data-orn="pending"`).
 *   3. Saat section masuk viewport, ornamen diberi `data-orn="visible"`
 *      sehingga CSS memainkan transisi masuk (fade/rise/grow/…). Setelah
 *      transisi selesai, `data-orn="settled"` → animasi goyangan (motion)
 *      dimulai (tanpa konflik dengan transform reveal).
 *
 * Ornamen tersebar di banyak komponen (Ornament.svelte, DecoAsset.svelte,
 * markup halaman). Karena komponen tidak tahu kapan section-nya aktif,
 * `Ornament.svelte` MEWARISI status dari induk terdekat yang ber-`data-orn`
 * (`data-orn=inherit`), jadi satu penanda section cukup untuk semua ornamen
 * di dalamnya — tanpa mengubah komponen/halaman.
 *
 * Opsi:
 *  - `style`     : 'none' | 'fade' | 'rise' | 'drop' | 'grow' | 'slide' |
 *                  'bloom' (lihat `OrnamentReveal`). 'none' = nonaktif.
 *  - `intensity` : 'subtle' | 'medium' | 'bold' — besar/kecepatan gerak.
 *  - `motion`    : 'none' | 'sway' | 'float' | 'pulse' | 'flutter' |
 *                  'inherit' — goyangan setelah reveal. 'inherit' membiarkan
 *                  animasi dekorasi bawaan (`decoration_animated`) bekerja.
 *  - `enabled`   : bila false, semua ornamen langsung tampil (tanpa animasi).
 *
 * @returns fungsi pembersih (mengembalikan keadaan semula).
 */
export function initOrnamentReveal(opts: {
	style?: string;
	intensity?: string;
	motion?: string;
	enabled?: boolean;
} = {}): () => void {
	if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
	const { style = 'none', intensity = 'medium', motion = 'inherit', enabled = true } = opts;
	const body = document.body;

	// Selalu bersihkan kelas utilitas lama (idempoten, aman saat re-init).
	ORNAMENT_BODY_CLASSES.forEach((c) => body.classList.remove(c));

	// Elemen ornamen yang ikut sistem ini (di dalam section-scroll).
	const ornSel = '[data-reveal], .ornament, .deco-asset, .cover-deco, .deco-item';

	// Bersihkan penanda reveal lama dari <body> + semua elemen ornamen.
	const cleanAttrs = () => {
		body.removeAttribute('data-orn');
		body.removeAttribute('data-orn-busy');
		document.querySelectorAll<HTMLElement>(`${ornSel}, [data-orn-scope]`).forEach((el) => {
			el.removeAttribute('data-orn');
			el.removeAttribute('data-orn-scope');
		});
	};
	cleanAttrs();

	// Nonaktif / tanpa observer / reduced-motion → tampilkan langsung, tanpa
	// kelas gaya apa pun (halaman kembali persis seperti default).
	if (!enabled || style === 'none' || !('IntersectionObserver' in window)) {
		return () => {};
	}

	// Pasang kelas: aktif + gaya + intensitas + gerakan (hanya yang non-default).
	body.classList.add('orn-reveal-active', 'orn-reveal-' + style);
	if (intensity === 'subtle' || intensity === 'bold') body.classList.add('orn-intensity-' + intensity);
	if (motion && motion !== 'none' && motion !== 'inherit') body.classList.add('orn-motion-' + motion);

	const styleDur = ORNAMENT_STYLE_DURATION[style] || 700;
	const thresh = style === 'grow' || style === 'bloom' ? 0.05 : 0.12;
	const settleDur = styleDur + 60;

	const io = new IntersectionObserver(
		(entries) => {
			entries.forEach((e) => {
				if (!e.isIntersecting) return;
				const section = e.target as HTMLElement;
				const orns = Array.from(section.querySelectorAll<HTMLElement>(ornSel));
				orns.forEach((el) => {
					el.setAttribute('data-orn', 'pending');
					el.setAttribute('data-orn-scope', ''); // penanda induk untuk `inherit`
				});
				// Saat "berhenti" (keluar viewport) → sembunyikan lagi agar
				// transisi masuk TERPUTAR ULANG tiap section kembali terlihat.
				const hideOrm = () => orns.forEach((el) => el.setAttribute('data-orn', 'pending'));
				if (orns.length) io.observe(section); // sudah, aman (idempoten)
				// Reveal: pindah ke 'visible' setelah satu frame (agar transisi
				// dari keadaan awal benar-benar main).
				requestAnimationFrame(() => {
					orns.forEach((el) => {
						if (el.getAttribute('data-orn') === 'pending') el.setAttribute('data-orn', 'visible');
					});
				});
				// Setelah transisi selesai → 'settled' (mulai goyangan).
				window.setTimeout(() => {
					orns.forEach((el) => {
						if (el.getAttribute('data-orn') === 'visible') el.setAttribute('data-orn', 'settled');
					});
				}, settleDur);
				io.unobserve(section);
				// Observer kedua: pantau keluar-viewport untuk reset (replay).
				const ioOut = new IntersectionObserver(
					(es) => {
						es.forEach((ev) => {
							if (!ev.isIntersecting) {
								hideOrm();
								ioOut.disconnect();
								io.observe(section); // pasang lagi agar reveal berikutnya jalan
							}
						});
					},
					{ threshold: 0 }
				);
				ioOut.observe(section);
			});
		},
		{ threshold: thresh, rootMargin: '0px 0px -6% 0px' }
	);

	const sections = Array.from(document.querySelectorAll<HTMLElement>(SECTION_SELECTOR));
	sections.forEach((sec) => io.observe(sec));

	return () => {
		io.disconnect();
		ORNAMENT_BODY_CLASSES.forEach((c) => body.classList.remove(c));
		cleanAttrs();
	};
}

/** Apakah pengguna meminta animasi dikurangi? (aman untuk SSR). */
export function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined' || !window.matchMedia) return false;
	try {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	} catch {
		return false;
	}
}

/** Normalisasi saklar setting ('1'/'true' → aktif). */
function isOn(v: unknown): boolean {
	return v === '1' || v === true || v === 'true';
}

/** Nilai default efek premium (semua nonaktif kecuali pilihan enum). */
const EFFECT_DEFAULTS = {
	transition: 'none',
	reveal: 'fade-up',
	intensity: 'medium',
	photoFilter: 'none'
} as const;

/* ============================================================
   ANIMASI REVEAL ORNAMEN (BARU)
   Ornamen (bunga/daun/aset) muncul dengan transisi saat section-nya
   aktif/di-scroll, lalu lanjut bergoyang. Semua NONAKTIF secara
   default: tanpa `ornament_reveal` selain 'none' (atau tanpa
   `effects_enabled`), tidak ada kelas/penanda yang dipasang sehingga
   halaman tamu tetap tampil seperti semula.

   Kelas gaya (di <body>) + penanda per-elemen (`data-orn`) diatur di
   `initOrnamentReveal`; aturan CSS-nya ada di `style.css` sehingga tak
   ada style inline berat.
   ============================================================ */

/** Section-scroll yang ornamennya ikut sistem reveal (lihat halaman tamu). */
const SECTION_SELECTOR = '.hero, .section, .quote-sec, .closing-sec';

/** Durasi transisi masuk per gaya (ms) — dipakai untuk jeda `settled`. */
const ORNAMENT_STYLE_DURATION: Record<string, number> = {
	fade: 620,
	rise: 720,
	drop: 720,
	grow: 760,
	slide: 720,
	bloom: 820
};

/** Kelas <body> yang mungkin dipasang sistem reveal ornamen (untuk bersih-bersih). */
const ORNAMENT_BODY_CLASSES = [
	'orn-reveal-active',
	'orn-reveal-fade',
	'orn-reveal-rise',
	'orn-reveal-drop',
	'orn-reveal-grow',
	'orn-reveal-slide',
	'orn-reveal-bloom',
	'orn-intensity-subtle',
	'orn-intensity-bold',
	'orn-motion-sway',
	'orn-motion-float',
	'orn-motion-pulse',
	'orn-motion-flutter'
];

const KENBURNS_CLASS = 'premium-kenburns';

/**
 * Terapkan SEMUA efek premium sesuai settings, dan kembalikan fungsi
 * pembersih. Semua efek NONAKTIF secara default:
 *
 *  - `effects_enabled`      : gerbang utama (bila '0'/kosong → tiada efek).
 *  - `effects_parallax`     : latar hero bergerak saat scroll.
 *  - `effects_kenburns`     : zoom sinematik pada latar hero/cover.
 *  - `effects_transition_enabled` + `effects_transition` : pembatas antar-section.
 *  - `effects_photo_filter_enabled` + `effects_photo_filter` : filter foto.
 *  - `effects_reveal` + `effects_intensity` : gaya animasi scroll.
 *
 * Bila pengguna memilih `prefers-reduced-motion: reduce`, SEMUA efek gerak
 * dimatikan (parallax/ken-burns/reveal/transisi) — elemen langsung tampil.
 * Filter foto tetap diterapkan karena bukan gerak.
 */
export function applyPremiumEffects(s: Record<string, string> | null | undefined): () => void {
	if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

	const body = document.body;
	const reduce = prefersReducedMotion();
	const master = isOn(s?.effects_enabled);
	// Gerbang master: tanpa `effects_enabled`, semua efek gerak mati.
	const motionOk = master && !reduce;

	const settings = {
		transition: (s?.effects_transition as string) || EFFECT_DEFAULTS.transition,
		reveal: (s?.effects_reveal as string) || EFFECT_DEFAULTS.reveal,
		intensity: (s?.effects_intensity as string) || EFFECT_DEFAULTS.intensity,
		photoFilter: (s?.effects_photo_filter as string) || EFFECT_DEFAULTS.photoFilter
	};

	// ---- Bersihkan kelas efek lama (idempoten, aman saat re-init) ----
	const clear = () => {
		[...body.classList]
			.filter((c) => c.startsWith('premium-'))
			.forEach((c) => body.classList.remove(c));
		body.style.removeProperty('--parallax-y');
	};
	clear();

	// ---- Reveal (selalu diinisialisasi; efek gerak dimatikan bila perlu) ----
	const stopReveal = initReveal({
		style: settings.reveal,
		intensity: settings.intensity,
		enabled: motionOk
	});

	// ---- Reveal + goyangan ORNAMEN (BARU) ----
	// Ornamen muncul dengan transisi saat section aktif, lalu bergoyang.
	// Nonaktif bila `ornament_reveal` = 'none' (default) atau efek gerak mati.
	const ornamentReveal = (s?.ornament_reveal as string) || 'none';
	const stopOrnamentReveal = initOrnamentReveal({
		style: ornamentReveal,
		intensity: settings.intensity,
		motion: (s?.ornament_motion as string) || 'inherit',
		enabled: motionOk && ornamentReveal !== 'none'
	});

	let stopParallax: () => void = () => {};
	let stopKenburns: () => void = () => {};

	// ---- Parallax halus ----
	if (motionOk && isOn(s?.effects_parallax)) {
		body.classList.add('premium-parallax');
		let raf = 0;
		const onScroll = () => {
			if (raf) return;
			raf = requestAnimationFrame(() => {
				raf = 0;
				// Faktor pergeseran menyesuaikan intensitas.
				const factor = settings.intensity === 'bold' ? 0.45 : settings.intensity === 'subtle' ? 0.18 : 0.3;
				body.style.setProperty('--parallax-y', `${window.scrollY * factor}px`);
			});
		};
		window.addEventListener('scroll', onScroll, { passive: true });
		onScroll();
		stopParallax = () => {
			window.removeEventListener('scroll', onScroll);
			if (raf) cancelAnimationFrame(raf);
		};
	}

	// ---- Ken-Burns ----
	if (motionOk && isOn(s?.effects_kenburns)) {
		body.classList.add(KENBURNS_CLASS);
	}

	// ---- Transisi antar-section ----
	if (motionOk && isOn(s?.effects_transition_enabled) && settings.transition !== 'none') {
		body.classList.add('premium-transition-' + settings.transition);
	}

	// ---- Filter foto (tanpa gerak; tetap aktif walau reduced-motion) ----
	if (master && isOn(s?.effects_photo_filter_enabled) && settings.photoFilter !== 'none') {
		body.classList.add('premium-filter', 'premium-filter-' + settings.photoFilter);
	}

	return () => {
		stopReveal();
		stopOrnamentReveal();
		stopParallax();
		stopKenburns();
		clear();
	};
}
