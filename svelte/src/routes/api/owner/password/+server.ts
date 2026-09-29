import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { one, run } from '$lib/server/db';
import { requireOwner, enforceRate } from '$lib/server/auth';
import { hashPassword } from '$lib/server/security';

/** PUT /api/owner/password — ganti password owner. Body: { password }. */
export const PUT: RequestHandler = async (event) => {
	const owner = await requireOwner(event);
	enforceRate('owner-write', event, 60_000, 10);
	const b = await event.request.json().catch(() => ({}));
	const pw = String(b.password || '').slice(0, 100);
	if (pw.length < 6) throw error(400, { message: 'Password minimal 6 karakter.' });
	await run('UPDATE owners SET password_hash=$1 WHERE id=$2', [hashPassword(pw), owner.id]);
	return json({ ok: true });
};
