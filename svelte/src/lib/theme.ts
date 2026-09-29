/**
 * theme.ts (client) — terapkan tema preset/kustom + latar kustom ke <body>.
 * Port dari applyTheme/applyBackground di app.js lama.
 */

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

/** Aktifkan animasi reveal saat scroll untuk semua [data-reveal]. */
export function initReveal(): () => void {
	const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
	if (!('IntersectionObserver' in window)) {
		els.forEach((el) => el.classList.add('is-visible'));
		return () => {};
	}
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
