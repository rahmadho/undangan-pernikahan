import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { one, run, runReturning } from '$lib/server/db';
import { accountLifecycle, requireAccountActive, enforceRate, type Account } from '$lib/server/auth';
import { clampStr, clampInt, LIMITS } from '$lib/server/util';

/**
 * POST /api/u/[slug]/rsvp — konfirmasi kehadiran.
 * Body: { name, attendance: hadir|tidak_hadir|ragu, pax, message?, guest_slug? }
 */
export const POST: RequestHandler = async (event) => {
	const acc = await requireAccountActive(event);
	enforceRate('rsvp', event, 60_000, 8);

	const body = await event.request.json().catch(() => ({}));
	const name = clampStr(body.name, LIMITS.short);
	if (!name) throw error(400, { message: 'Nama wajib diisi.' });

	const attendance = String(body.attendance || '');
	if (!['hadir', 'tidak_hadir', 'ragu'].includes(attendance)) {
		throw error(400, { message: 'Status kehadiran tidak valid.' });
	}

	const pax = attendance === 'hadir' ? clampInt(body.pax, 1, 20, 1) : 0;
	const message = clampStr(body.message, LIMITS.message) || null;

	// Tautkan ke guest bila diberi guest_slug.
	let guestId: number | null = null;
	if (body.guest_slug) {
		const g = await one<{ id: number }>('SELECT id FROM guests WHERE account_id = $1 AND slug = $2', [
			acc.id,
			clampStr(body.guest_slug, 100)
		]);
		guestId = g?.id ?? null;
	}

	const row = await runReturning(
		`INSERT INTO rsvp (account_id, guest_id, name, attendance, pax, message)
		 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at`,
		[acc.id, guestId, name, attendance, pax, message]
	);

	return json({ ok: true, id: row!.id, created_at: row!.created_at }, { status: 201 });
};
