import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { one } from '$lib/server/db';
import type { Account } from '$lib/server/auth';

/**
 * GET /api/u/[slug]/guest?guest=<slug> — info tamu dari link personal.
 * Dipakai untuk menampilkan "Kepada Bapak/Ibu …" di cover.
 */
export const GET: RequestHandler = async ({ params, url }) => {
	const acc = await one<Account>('SELECT id, slug, status, expires_at FROM accounts WHERE slug=$1', [
		params.slug.toLowerCase().trim()
	]);
	if (!acc) throw error(404, { message: 'Undangan tidak ditemukan.' });

	const guestSlug = (url.searchParams.get('guest') || url.searchParams.get('to') || '').trim();
	if (!guestSlug) return json({ guest: null });

	const g = await one('SELECT id, slug, name, category, quota FROM guests WHERE account_id=$1 AND slug=$2', [
		acc.id,
		guestSlug
	]);
	return json({ guest: g || null });
};
