/**
 * auth.ts — Helper autentikasi per-request untuk API SvelteKit.
 *
 * Meniru pola lama (header-based, bukan cookie):
 *   Client : x-account: <slug> + x-admin-password
 *   Owner  : x-owner-password
 *
 * Setiap helper mengembalikan objek account/owner atau melempar Response error
 * (yang otomatis ditangkap SvelteKit).
 */
import { error, type RequestEvent } from '@sveltejs/kit';
import { one, type Row } from './db';
import { verifyPassword, rateCheck } from './security';

export interface Account extends Row {
	id: number;
	slug: string;
	title: string | null;
	password_hash: string;
	status: 'active' | 'suspended';
	theme: string;
	expires_at: string | null;
	max_guests: number;
}

/** Ambil slug account dari header x-account, query ?account=, ATAU path param [slug]. */
export function resolveSlug(event: RequestEvent): string {
	return (
		event.request.headers.get('x-account') ||
		event.url.searchParams.get('account') ||
		(event.params?.slug as string) ||
		''
	)
		.toLowerCase()
		.trim();
}

/** Ambil account dari slug (header/query/path). */
export async function getAccountBySlugHeader(event: RequestEvent): Promise<Account | null> {
	const slug = resolveSlug(event);
	if (!slug) return null;
	return await one<Account>('SELECT * FROM accounts WHERE slug = $1', [slug]);
}

/** Status akun: aktif & belum kedaluwarsa? */
export function accountLifecycle(acc: Account): { ok: boolean; reason?: string } {
	if (!acc) return { ok: false, reason: 'Akun tidak ditemukan.' };
	if (acc.status !== 'active') return { ok: false, reason: 'Akun sedang dinonaktifkan.' };
	if (acc.expires_at && new Date(acc.expires_at).getTime() < Date.now()) {
		return { ok: false, reason: 'Masa aktif akun telah berakhir.' };
	}
	return { ok: true };
}

/**
 * Wajib: account valid + password admin benar.
 * Dipakai endpoint admin (isi konten).
 */
export async function requireAccountAdmin(event: RequestEvent): Promise<Account> {
	const acc = await getAccountBySlugHeader(event);
	if (!acc) throw error(404, { message: 'Akun tidak ditemukan.' });

	const pw = event.request.headers.get('x-admin-password') || '';
	const check = verifyPassword(pw, acc.password_hash);
	if (!check.ok) throw error(401, { message: 'Password admin salah.' });
	return acc;
}

/**
 * Wajib: account aktif (tanpa cek password). Untuk endpoint publik-penulisan
 * (RSVP, ucapan) — sekaligus cek masa aktif.
 */
export async function requireAccountActive(event: RequestEvent): Promise<Account> {
	const acc = await getAccountBySlugHeader(event);
	if (!acc) throw error(404, { message: 'Akun tidak ditemukan.' });
	const life = accountLifecycle(acc);
	if (!life.ok) throw error(403, { message: life.reason ?? 'Akun tidak aktif.' });
	return acc;
}

/** Wajib: owner (super admin) dengan password benar. */
export async function requireOwner(event: RequestEvent): Promise<Row> {
	const pw = event.request.headers.get('x-owner-password') || '';
	const rows = await one<Row>('SELECT * FROM owners ORDER BY id LIMIT 1');
	if (!rows) throw error(500, { message: 'Owner belum diatur.' });
	const check = verifyPassword(pw, rows.password_hash as string);
	if (!check.ok) throw error(401, { message: 'Password owner salah.' });
	return rows;
}

/**
 * Terapkan rate limit. Lempar 429 bila lewat batas.
 * @param bucket nama bucket unik
 * @param event  untuk ambil IP
 */
export function enforceRate(bucket: string, event: RequestEvent, windowMs: number, max: number): void {
	const ip = event.getClientAddress?.() || 'unknown';
	const r = rateCheck(bucket, ip, { windowMs, max });
	if (!r.ok) {
		throw error(429, { message: 'Terlalu banyak permintaan. Coba lagi nanti.' });
	}
}
