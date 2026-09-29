import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { many } from '$lib/server/db';
import { requireAccountAdmin } from '$lib/server/auth';

/** GET /api/admin/rsvp — daftar konfirmasi kehadiran + statistik. */
export const GET: RequestHandler = async (event) => {
	const acc = await requireAccountAdmin(event);
	const rows = await many(
		'SELECT id, name, attendance, pax, message, created_at FROM rsvp WHERE account_id = $1 ORDER BY created_at DESC',
		[acc.id]
	);
	const stats = {
		total: rows.length,
		hadir: rows.filter((r) => r.attendance === 'hadir').length,
		tidak_hadir: rows.filter((r) => r.attendance === 'tidak_hadir').length,
		ragu: rows.filter((r) => r.attendance === 'ragu').length,
		total_pax: rows.filter((r) => r.attendance === 'hadir').reduce((a, r) => a + Number(r.pax || 0), 0)
	};
	return json({ stats, rows });
};
