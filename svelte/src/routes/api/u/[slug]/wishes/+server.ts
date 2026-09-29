import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { many, one, runReturning } from '$lib/server/db';
import { requireAccountActive, enforceRate } from '$lib/server/auth';
import { clampStr, LIMITS } from '$lib/server/util';

/** GET /api/u/[slug]/wishes — daftar ucapan (publik). */
export const GET: RequestHandler = async ({ params }) => {
	const acc = await one<{ id: number }>('SELECT id FROM accounts WHERE slug = $1', [
		params.slug.toLowerCase().trim()
	]);
	if (!acc) throw error(404, { message: 'Undangan tidak ditemukan.' });
	const rows = await many(
		'SELECT id, name, message, attending, created_at FROM wishes WHERE account_id = $1 ORDER BY created_at DESC LIMIT 100',
		[acc.id]
	);
	return json(rows);
};

/** POST /api/u/[slug]/wishes — kirim ucapan (publik, rate-limited). */
export const POST: RequestHandler = async (event) => {
	const acc = await requireAccountActive(event);
	enforceRate('wishes', event, 60_000, 8);

	const body = await event.request.json().catch(() => ({}));
	const name = clampStr(body.name, LIMITS.short);
	const message = clampStr(body.message, LIMITS.message);
	if (!name) throw error(400, { message: 'Nama wajib diisi.' });
	if (!message) throw error(400, { message: 'Ucapan tidak boleh kosong.' });

	const attending = ['hadir', 'tidak_hadir', 'ragu'].includes(body.attending) ? body.attending : 'hadir';

	let guestId: number | null = null;
	if (body.guest_slug) {
		const g = await one<{ id: number }>('SELECT id FROM guests WHERE account_id = $1 AND slug = $2', [
			acc.id,
			clampStr(body.guest_slug, 100)
		]);
		guestId = g?.id ?? null;
	}

	const row = await runReturning(
		`INSERT INTO wishes (account_id, guest_id, name, message, attending)
		 VALUES ($1,$2,$3,$4,$5) RETURNING id, name, message, attending, created_at`,
		[acc.id, guestId, name, message, attending]
	);
	return json(row, { status: 201 });
};
