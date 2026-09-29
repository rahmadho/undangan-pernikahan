import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { one } from '$lib/server/db';
import { verifyPassword } from '$lib/server/security';
import { enforceRate, type Account } from '$lib/server/auth';
import { clampStr } from '$lib/server/util';

/**
 * POST /api/admin/login — cek kredensial admin untuk sebuah slug.
 * Body: { slug, password }
 * Tidak memakai cookie (header-based, sesuai desain lama) — hanya memverifikasi.
 */
export const POST: RequestHandler = async (event) => {
	enforceRate('login', event, 60_000, 10);
	const b = await event.request.json().catch(() => ({}));
	const slug = clampStr(b.slug, 80).toLowerCase();
	const password = String(b.password || '');

	const acc = await one<Account>('SELECT * FROM accounts WHERE slug = $1', [slug]);
	if (!acc) throw error(404, { message: 'Undangan tidak ditemukan.' });

	const check = verifyPassword(password, acc.password_hash);
	if (!check.ok) throw error(401, { message: 'Password salah.' });

	return json({
		ok: true,
		account: { slug: acc.slug, title: acc.title, theme: acc.theme, status: acc.status, expires_at: acc.expires_at }
	});
};
