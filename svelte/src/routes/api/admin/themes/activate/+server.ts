import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { one, run } from '$lib/server/db';
import { requireAccountAdmin, enforceRate } from '$lib/server/auth';
import { clampInt } from '$lib/server/util';

/** POST /api/admin/themes/activate — jadikan sebuah tema kustom sebagai tema aktif. */
export const POST: RequestHandler = async (event) => {
	const acc = await requireAccountAdmin(event);
	enforceRate('admin-write', event, 60_000, 30);
	const b = await event.request.json().catch(() => ({}));
	const id = clampInt(b.id, 1, 1e9, 0);
	if (!id) throw error(400, { message: 'ID tema tidak valid.' });

	const t = await one<{ slug: string }>('SELECT slug FROM themes WHERE id=$1 AND account_id=$2', [id, acc.id]);
	if (!t) throw error(404, { message: 'Tema tidak ditemukan.' });

	await run('UPDATE accounts SET theme=$1 WHERE id=$2', [t.slug, acc.id]);
	return json({ ok: true, theme: t.slug });
};
