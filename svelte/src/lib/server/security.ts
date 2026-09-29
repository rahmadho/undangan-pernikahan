/**
 * security.ts — Utilitas keamanan (port dari server/security.js).
 *
 * - Hash password dengan scrypt (node:crypto).
 * - Rate limiter in-memory (fixed window).
 * - Security headers untuk SvelteKit (dipakai di hooks.server.ts).
 */
import crypto from 'node:crypto';

const SCRYPT_KEYLEN = 64;
const HASH_PREFIX = 'scrypt$';

/** Buat hash password: `scrypt$<saltHex>$<hashHex>`. */
export function hashPassword(password: string): string {
	const salt = crypto.randomBytes(16);
	const derived = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN);
	return `${HASH_PREFIX}${salt.toString('hex')}$${derived.toString('hex')}`;
}

/** Apakah string sudah berupa hash scrypt buatan kita. */
export function isHashed(value: unknown): boolean {
	return typeof value === 'string' && value.startsWith(HASH_PREFIX) && value.split('$').length === 3;
}

/** Verifikasi password terhadap nilai tersimpan (hash scrypt atau plaintext lama). */
export function verifyPassword(password: string, stored: string | null): { ok: boolean; legacy: boolean } {
	if (password == null || stored == null) return { ok: false, legacy: false };

	if (isHashed(stored)) {
		const [, saltHex, hashHex] = stored.split('$');
		const salt = Buffer.from(saltHex, 'hex');
		const expected = Buffer.from(hashHex, 'hex');
		const derived = crypto.scryptSync(String(password), salt, expected.length);
		const ok = derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
		return { ok, legacy: false };
	}

	const a = Buffer.from(String(password));
	const b = Buffer.from(String(stored));
	const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
	return { ok, legacy: true };
}

// ---------------------------------------------------------------------------
// Rate limiter in-memory (fixed window)
// ---------------------------------------------------------------------------

type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Map<string, Hit>>();

/**
 * Cek rate limit. Kembalikan { ok, retryAfter } bila melebihi batas.
 * @param bucket nama bucket (mis. 'rsvp')
 * @param key    pembeda (mis. IP)
 */
export function rateCheck(
	bucket: string,
	key: string,
	{ windowMs, max }: { windowMs: number; max: number }
): { ok: boolean; remaining: number; retryAfter: number } {
	let hits = buckets.get(bucket);
	if (!hits) {
		hits = new Map();
		buckets.set(bucket, hits);
	}
	const now = Date.now();
	let rec = hits.get(key);
	if (!rec || rec.resetAt <= now) {
		rec = { count: 0, resetAt: now + windowMs };
		hits.set(key, rec);
	}
	rec.count += 1;

	// Bersihkan entri kedaluwarsa sesekali (hemat memori).
	if (hits.size > 5000) {
		for (const [k, r] of hits) if (r.resetAt <= now) hits.delete(k);
	}

	const remaining = Math.max(0, max - rec.count);
	if (rec.count > max) {
		return { ok: false, remaining: 0, retryAfter: Math.ceil((rec.resetAt - now) / 1000) };
	}
	return { ok: true, remaining, retryAfter: 0 };
}

/** Header keamanan dasar. */
export function securityHeaders(): Record<string, string> {
	return {
		'X-Content-Type-Options': 'nosniff',
		'X-Frame-Options': 'SAMEORIGIN',
		'Referrer-Policy': 'strict-origin-when-cross-origin',
		'X-XSS-Protection': '0',
		'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
	};
}
