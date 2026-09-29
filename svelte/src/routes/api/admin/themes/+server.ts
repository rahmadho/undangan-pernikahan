import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { many, run, runReturning, one, type Row } from '$lib/server/db';
import { requireAccountAdmin, enforceRate } from '$lib/server/auth';
import { clampStr, clampInt, slugify, LIMITS } from '$lib/server/util';

/** Kumpulan CSS variable yang boleh di-override tema kustom. */
const ALLOWED_TOKENS = new Set([
	'--cream',
	'--cream-2',
	'--surface',
	'--sage',
	'--sage-dark',
	'--gold',
	'--ink',
	'--ink-soft',
	'--serif',
	'--script',
	'--sans'
]);

/** Bersihkan token: hanya var yang diizinkan + nilai aman (tanpa ; { }). */
function sanitizeTokens(raw: unknown): Record<string, string> {
	const out: Record<string, string> = {};
	if (!raw || typeof raw !== 'object') return out;
	for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
		if (!ALLOWED_TOKENS.has(k)) continue; // buang var liar (anti-inject)
		const val = String(v ?? '').trim().slice(0, 200);
		if (!val || /[;{}<>]/.test(val)) continue; // buang nilai berbahaya
		out[k] = val;
	}
	return out;
}

/** GET /api/admin/themes — daftar tema kustom. */
export const GET: RequestHandler = async (event) => {
	const acc = await requireAccountAdmin(event);
	const rows = await many('SELECT * FROM themes WHERE account_id = $1 ORDER BY created_at', [acc.id]);
	return json(
		rows.map((r) => ({ ...r, tokens: JSON.parse((r.tokens as string) || '{}') }))
	);
};

/** POST /api/admin/themes — buat tema kustom ({ name, base, tokens }). */
export const POST: RequestHandler = async (event) => {
	const acc = await requireAccountAdmin(event);
	enforceRate('admin-write', event, 60_000, 30);
	const b = await event.request.json().catch(() => ({}));
	const name = clampStr(b.name, LIMITS.short) || 'Tema Kustom';
	const base = clampStr(b.base, 40) || 'botanical';
	const tokens = sanitizeTokens(b.tokens);

	let slug = slugify(name) || 'tema';
	const dup = await one('SELECT id FROM themes WHERE account_id = $1 AND slug = $2', [acc.id, slug]);
	if (dup) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

	const row = await runReturning(
		`INSERT INTO themes (account_id, slug, name, base, tokens, is_custom)
		 VALUES ($1,$2,$3,$4,$5,1) RETURNING id, slug, name, base, tokens`,
		[acc.id, slug, name, base, JSON.stringify(tokens)]
	);
	return json({ ...row, tokens }, { status: 201 });
};

/** PUT /api/admin/themes — ubah tema ({ id, name?, base?, tokens? }). */
export const PUT: RequestHandler = async (event) => {
	const acc = await requireAccountAdmin(event);
	enforceRate('admin-write', event, 60_000, 30);
	const b = await event.request.json().catch(() => ({}));
	const id = clampInt(b.id, 1, 1e9, 0);
	if (!id) throw error(400, { message: 'ID tema tidak valid.' });
	const name = clampStr(b.name, LIMITS.short) || 'Tema Kustom';
	const base = clampStr(b.base, 40) || 'botanical';
	const tokens = sanitizeTokens(b.tokens);
	await run(
		'UPDATE themes SET name=$1, base=$2, tokens=$3 WHERE id=$4 AND account_id=$5',
		[name, base, JSON.stringify(tokens), id, acc.id]
	);
	return json({ ok: true });
};

/** DELETE /api/admin/themes?id= — hapus tema. */
export const DELETE: RequestHandler = async (event) => {
	const acc = await requireAccountAdmin(event);
	enforceRate('admin-write', event, 60_000, 30);
	const id = clampInt(event.url.searchParams.get('id'), 1, 1e9, 0);
	if (!id) throw error(400, { message: 'ID tema tidak valid.' });
	await run('DELETE FROM themes WHERE id=$1 AND account_id=$2', [id, acc.id]);
	return json({ ok: true });
};

export type { Row };
