import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { one, many } from '$lib/server/db';
import { accountLifecycle, type Account } from '$lib/server/auth';
import { getInvitationData, publicSettings, getCustomThemes } from '$lib/server/invitation';

/**
 * GET /api/u/[slug]/invitation — data lengkap undangan untuk halaman tamu.
 * Publik, tapi tetap cek status & masa aktif akun.
 */
export const GET: RequestHandler = async ({ params }) => {
	const acc = await one<Account>('SELECT * FROM accounts WHERE slug = $1', [params.slug.toLowerCase().trim()]);
	if (!acc) throw error(404, { message: 'Undangan tidak ditemukan.' });

	const life = accountLifecycle(acc);
	if (!life.ok) throw error(403, { message: life.reason ?? 'Undangan tidak aktif.' });

	const data = await getInvitationData(acc);
	const themes = await getCustomThemes(acc.id);

	// Sertakan padanan nama tamu bila ?to=<guest-slug> ada (opsional).
	return json({
		account: { id: acc.id, slug: acc.slug, title: acc.title, theme: acc.theme },
		couple: data.couple,
		events: data.events,
		gallery: data.gallery,
		gifts: data.gifts,
		wishes: data.wishes,
		settings: publicSettings(acc, data.settings),
		themes
	});
};
