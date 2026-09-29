import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { many, run, runReturning, one } from '$lib/server/db';
import { requireAccountAdmin, enforceRate } from '$lib/server/auth';
import { clampStr, clampInt, slugify, LIMITS } from '$lib/server/util';

/** GET /api/admin/guests — daftar tamu + jumlah RSVP. */
export const GET: RequestHandler = async (event) => {
	const acc = await requireAccountAdmin(event);
	const rows = await many(
		`SELECT g.*, (SELECT COUNT(*) FROM rsvp r WHERE r.guest_id = g.id) AS rsvp_count
		 FROM guests g WHERE g.account_id = $1 ORDER BY g.id DESC`,
		[acc.id]
	);
	return json(rows);
};

/** POST /api/admin/guests — tambah tamu ({ name, phone?, category?, quota? }). */
export const POST: RequestHandler = async (event) => {
	const acc = await requireAccountAdmin(event);
	enforceRate('admin-write', event, 60_000, 40);
	const b = await event.request.json().catch(() => ({}));
	const name = clampStr(b.name, LIMITS.short);
	if (!name) throw error(400, { message: 'Nama tamu wajib diisi.' });

	// slug unik dalam account
	let slug = slugify(name) || 'tamu';
	const dup = await one('SELECT id FROM guests WHERE account_id = $1 AND slug = $2', [acc.id, slug]);
	if (dup) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

	const row = await runReturning(
		`INSERT INTO guests (account_id, slug, name, phone, category, quota)
		 VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
		[acc.id, slug, name, clampStr(b.phone, LIMITS.short), clampStr(b.category, LIMITS.medium), clampInt(b.quota, 1, 50, 2)]
	);
	return json(row, { status: 201 });
};

/** PUT /api/admin/guests — ubah tamu ({ id, ... }). */
export const PUT: RequestHandler = async (event) => {
	const acc = await requireAccountAdmin(event);
	enforceRate('admin-write', event, 60_000, 40);
	const b = await event.request.json().catch(() => ({}));
	const id = clampInt(b.id, 1, 1e9, 0);
	if (!id) throw error(400, { message: 'ID tamu tidak valid.' });
	await run(
		`UPDATE guests SET name=$1, phone=$2, category=$3, quota=$4 WHERE id=$5 AND account_id=$6`,
		[
			clampStr(b.name, LIMITS.short),
			clampStr(b.phone, LIMITS.short),
			clampStr(b.category, LIMITS.medium),
			clampInt(b.quota, 1, 50, 2),
			id,
			acc.id
		]
	);
	return json({ ok: true });
};

/** DELETE /api/admin/guests?id= — hapus tamu. */
export const DELETE: RequestHandler = async (event) => {
	const acc = await requireAccountAdmin(event);
	enforceRate('admin-write', event, 60_000, 40);
	const id = clampInt(event.url.searchParams.get('id'), 1, 1e9, 0);
	if (!id) throw error(400, { message: 'ID tamu tidak valid.' });
	await run('DELETE FROM guests WHERE id = $1 AND account_id = $2', [id, acc.id]);
	return json({ ok: true });
};
