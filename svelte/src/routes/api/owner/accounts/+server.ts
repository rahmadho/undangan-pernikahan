import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { many, run, runReturning, one } from '$lib/server/db';
import { requireOwner, enforceRate } from '$lib/server/auth';
import { hashPassword } from '$lib/server/security';
import { clampStr, clampInt, slugify, LIMITS } from '$lib/server/util';

/** GET /api/owner/accounts — daftar semua client + statistik. */
export const GET: RequestHandler = async (event) => {
	await requireOwner(event);
	const rows = await many(
		`SELECT a.id, a.slug, a.title, a.theme, a.status, a.plan, a.expires_at, a.created_at,
		   (SELECT COUNT(*) FROM guests g WHERE g.account_id = a.id) AS guest_count,
		   (SELECT COUNT(*) FROM rsvp r WHERE r.account_id = a.id) AS rsvp_count
		 FROM accounts a ORDER BY a.created_at DESC`
	);
	return json(rows);
};

/** POST /api/owner/accounts — buat client baru. */
export const POST: RequestHandler = async (event) => {
	await requireOwner(event);
	enforceRate('owner-write', event, 60_000, 20);
	const b = await event.request.json().catch(() => ({}));
	const title = clampStr(b.title, LIMITS.medium) || 'Tanpa Judul';
	const password = String(b.password || '').slice(0, 100);
	if (password.length < 5) throw error(400, { message: 'Password minimal 5 karakter.' });

	let slug = slugify(b.slug || title) || 'client';
	const dup = await one('SELECT id FROM accounts WHERE slug = $1', [slug]);
	if (dup) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

	const days = clampInt(b.days, 1, 3650, 90);
	const expiresAt = b.expires_at ? clampStr(b.expires_at, 40) : null;
	const expires = expiresAt || new Date(Date.now() + days * 86400_000).toISOString();
	const theme = clampStr(b.theme, 40) || 'botanical';

	const row = await runReturning(
		`INSERT INTO accounts (slug, title, password_hash, theme, status, plan, expires_at)
		 VALUES ($1,$2,$3,$4,'active',$5,$6) RETURNING id, slug, title, theme, status, expires_at`,
		[slug, title, hashPassword(password), theme, clampStr(b.plan, 40) || 'basic', expires]
	);
	return json(row, { status: 201 });
};

/** PUT /api/owner/accounts — ubah client ({ id, status?, days?, title?, password?, theme? }). */
export const PUT: RequestHandler = async (event) => {
	await requireOwner(event);
	enforceRate('owner-write', event, 60_000, 30);
	const b = await event.request.json().catch(() => ({}));
	const id = clampInt(b.id, 1, 1e9, 0);
	if (!id) throw error(400, { message: 'ID tidak valid.' });

	const acc = await one('SELECT * FROM accounts WHERE id = $1', [id]);
	if (!acc) throw error(404, { message: 'Client tidak ditemukan.' });

	const updates: string[] = [];
	const vals: unknown[] = [];

	if (b.status === 'active' || b.status === 'suspended') {
		updates.push(`status = $${vals.length + 1}`);
		vals.push(b.status);
	}
	if (b.title != null) {
		updates.push(`title = $${vals.length + 1}`);
		vals.push(clampStr(b.title, LIMITS.medium));
	}
	if (b.theme != null) {
		updates.push(`theme = $${vals.length + 1}`);
		vals.push(clampStr(b.theme, 40));
	}
	if (b.password) {
		const pw = String(b.password).slice(0, 100);
		if (pw.length < 5) throw error(400, { message: 'Password minimal 5 karakter.' });
		updates.push(`password_hash = $${vals.length + 1}`);
		vals.push(hashPassword(pw));
	}
	// Perpanjang masa aktif
	if (b.days || b.expires_at) {
		const base = acc.expires_at ? new Date(acc.expires_at as string) : new Date();
		const from = base.getTime() > Date.now() ? base.getTime() : Date.now();
		const next = b.expires_at
			? new Date(String(b.expires_at))
			: new Date(from + clampInt(b.days, 1, 3650, 30) * 86400_000);
		updates.push(`expires_at = $${vals.length + 1}`);
		vals.push(next.toISOString());
	}

	if (!updates.length) throw error(400, { message: 'Tidak ada perubahan.' });
	vals.push(id);
	await run(`UPDATE accounts SET ${updates.join(', ')} WHERE id = $${vals.length}`, vals);
	return json({ ok: true });
};

/** DELETE /api/owner/accounts?id= — hapus client + semua datanya. */
export const DELETE: RequestHandler = async (event) => {
	await requireOwner(event);
	const id = clampInt(event.url.searchParams.get('id'), 1, 1e9, 0);
	if (!id) throw error(400, { message: 'ID tidak valid.' });
	// ON DELETE CASCADE di skema menangani tabel anak.
	await run('DELETE FROM accounts WHERE id = $1', [id]);
	return json({ ok: true });
};
