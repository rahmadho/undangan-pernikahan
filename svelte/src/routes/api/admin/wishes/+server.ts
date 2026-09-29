import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { many, run } from '$lib/server/db';
import { requireAccountAdmin, enforceRate } from '$lib/server/auth';
import { clampInt } from '$lib/server/util';

/** GET /api/admin/wishes — semua ucapan account (untuk moderasi). */
export const GET: RequestHandler = async (event) => {
	const acc = await requireAccountAdmin(event);
	const rows = await many(
		'SELECT id, name, message, attending, created_at FROM wishes WHERE account_id=$1 ORDER BY created_at DESC',
		[acc.id]
	);
	return json(rows);
};

/** DELETE /api/admin/wishes?id= — hapus ucapan (moderasi). */
export const DELETE: RequestHandler = async (event) => {
	const acc = await requireAccountAdmin(event);
	enforceRate('admin-write', event, 60_000, 40);
	const id = clampInt(event.url.searchParams.get('id'), 1, 1e9, 0);
	if (!id) return json({ ok: false }, { status: 400 });
	await run('DELETE FROM wishes WHERE id=$1 AND account_id=$2', [id, acc.id]);
	return json({ ok: true });
};
