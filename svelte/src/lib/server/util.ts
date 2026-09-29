/**
 * util.ts — Helper validasi & batas input (port dari server/index.js LIMITS/clampStr).
 */

/** Batas panjang field. */
export const LIMITS = {
	short: 120, // nama
	medium: 240, // kategori, nama bank
	url: 500,
	message: 1000,
	quote: 500,
	story: 3000
} as const;

/** Potong & rapikan string dengan batas panjang. */
export function clampStr(v: unknown, max: number): string {
	if (v == null) return '';
	return String(v).trim().slice(0, max);
}

/** Angka dalam rentang. */
export function clampInt(v: unknown, min: number, max: number, def = min): number {
	const n = Number(v);
	if (!Number.isFinite(n)) return def;
	return Math.max(min, Math.min(max, Math.trunc(n)));
}

/** Ubah teks menjadi slug URL yang aman. */
export function slugify(s: string): string {
	return String(s || '')
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

/** Validasi URL (http/https atau relatif /uploads). */
export function isSafeUrl(u: unknown): boolean {
	const s = String(u || '').trim();
	if (!s) return true;
	if (s.startsWith('/uploads/')) return true;
	try {
		const parsed = new URL(s);
		return parsed.protocol === 'http:' || parsed.protocol === 'https:';
	} catch {
		return false;
	}
}
