import type { RequestHandler } from './$types';
import { many } from '$lib/server/db';
import { requireAccountAdmin } from '$lib/server/auth';
import { error } from '@sveltejs/kit';

/** Serialisasi baris menjadi CSV (dengan BOM agar Excel benar). */
function toCSV(rows: Record<string, unknown>[]): string {
	if (!rows.length) return '\ufeff';
	const headers = Object.keys(rows[0]);
	const esc = (v: unknown) => {
		const s = v == null ? '' : String(v);
		return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
	};
	const lines = [headers.join(',')];
	for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(','));
	return '\ufeff' + lines.join('\r\n');
}

/** GET /api/admin/export/[type].csv — ekspor data ke CSV. */
export const GET: RequestHandler = async (event) => {
	const acc = await requireAccountAdmin(event);
	// Param bisa "rsvp.csv" karena titik dianggap bagian path oleh matcher.
	const type = String(event.params.type || '').replace(/\.csv$/i, '');

	let rows: Record<string, unknown>[] = [];
	if (type === 'rsvp') {
		rows = await many(
			`SELECT r.id, r.name, r.attendance, r.pax, r.message, r.created_at,
			   g.name AS guest_name, g.slug AS guest_slug
			 FROM rsvp r LEFT JOIN guests g ON g.id = r.guest_id
			 WHERE r.account_id=$1 ORDER BY r.created_at DESC`,
			[acc.id]
		);
	} else if (type === 'guests') {
		rows = await many(
			`SELECT g.id, g.slug, g.name, g.phone, g.category, g.quota, g.created_at,
			   (SELECT r.name FROM rsvp r WHERE r.guest_id=g.id ORDER BY r.created_at DESC LIMIT 1) AS last_rsvp_name,
			   (SELECT r.attendance FROM rsvp r WHERE r.guest_id=g.id ORDER BY r.created_at DESC LIMIT 1) AS last_attendance
			 FROM guests g WHERE g.account_id=$1 ORDER BY g.id DESC`,
			[acc.id]
		);
	} else if (type === 'wishes') {
		rows = await many(
			'SELECT id, name, message, attending, created_at FROM wishes WHERE account_id=$1 ORDER BY created_at DESC',
			[acc.id]
		);
	} else {
		throw error(404, { message: 'Jenis ekspor tidak dikenal.' });
	}

	const csv = toCSV(rows);
	const filename = `${acc.slug}-${type}.csv`;
	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Cache-Control': 'no-store'
		}
	});
};
