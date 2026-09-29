import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { one } from '$lib/server/db';
import { verifyPassword } from '$lib/server/security';
import { enforceRate } from '$lib/server/auth';

/** POST /api/owner/login — verifikasi password owner. Body: { password }. */
export const POST: RequestHandler = async (event) => {
	enforceRate('owner-login', event, 60_000, 10);
	const b = await event.request.json().catch(() => ({}));
	const row = await one('SELECT * FROM owners ORDER BY id LIMIT 1');
	if (!row) throw error(500, { message: 'Owner belum diatur.' });
	const check = verifyPassword(String(b.password || ''), row.password_hash as string);
	if (!check.ok) throw error(401, { message: 'Password owner salah.' });
	return json({ ok: true });
};
