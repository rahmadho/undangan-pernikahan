import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { many, one } from '$lib/server/db';
import { requireAccountAdmin } from '$lib/server/auth';

/** GET /api/admin/summary — ringkasan statistik untuk dasbor. */
export const GET: RequestHandler = async (event) => {
	const acc = await requireAccountAdmin(event);

	const [counts, byAttendance, recentWishes] = await Promise.all([
		one<{ rsvp: string; wishes: string; guests: string; gallery: string; gifts: string }>(
			`SELECT
			   (SELECT COUNT(*) FROM rsvp WHERE account_id=$1) AS rsvp,
			   (SELECT COUNT(*) FROM wishes WHERE account_id=$1) AS wishes,
			   (SELECT COUNT(*) FROM guests WHERE account_id=$1) AS guests,
			   (SELECT COUNT(*) FROM gallery WHERE account_id=$1) AS gallery,
			   (SELECT COUNT(*) FROM gifts WHERE account_id=$1) AS gifts`,
			[acc.id]
		),
		many<{ attendance: string; c: string; pax: string }>(
			`SELECT attendance, COUNT(*) AS c, COALESCE(SUM(pax),0) AS pax
			 FROM rsvp WHERE account_id=$1 GROUP BY attendance`,
			[acc.id]
		),
		many('SELECT id, name, message, attending, created_at FROM wishes WHERE account_id=$1 ORDER BY created_at DESC LIMIT 5', [
			acc.id
		])
	]);

	const att: Record<string, { count: number; pax: number }> = {
		hadir: { count: 0, pax: 0 },
		tidak_hadir: { count: 0, pax: 0 },
		ragu: { count: 0, pax: 0 }
	};
	for (const r of byAttendance) {
		if (att[r.attendance]) att[r.attendance] = { count: Number(r.c), pax: Number(r.pax) };
	}

	return json({
		totals: {
			rsvp: Number(counts?.rsvp || 0),
			wishes: Number(counts?.wishes || 0),
			guests: Number(counts?.guests || 0),
			gallery: Number(counts?.gallery || 0),
			gifts: Number(counts?.gifts || 0)
		},
		byAttendance: att,
		recentWishes
	});
};
