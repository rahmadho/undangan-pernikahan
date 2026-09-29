import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { one } from '$lib/server/db';
import { accountLifecycle, type Account } from '$lib/server/auth';
import { getInvitationData, publicSettings, getCustomThemes } from '$lib/server/invitation';

/** Load data undangan (SSR) — halaman /u/[slug]. */
export const load: PageServerLoad = async ({ params }) => {
	const acc = await one<Account>('SELECT * FROM accounts WHERE slug = $1', [
		params.slug.toLowerCase().trim()
	]);
	if (!acc) throw error(404, { message: 'Undangan tidak ditemukan.' });

	const life = accountLifecycle(acc);
	if (!life.ok) throw error(403, { message: life.reason ?? 'Undangan tidak aktif.' });

	const data = await getInvitationData(acc);
	const themes = await getCustomThemes(acc.id);

	return {
		account: { id: acc.id, slug: acc.slug, title: acc.title, theme: acc.theme },
		couple: data.couple,
		events: data.events,
		gallery: data.gallery,
		gifts: data.gifts,
		wishes: data.wishes,
		settings: publicSettings(acc, data.settings),
		themes
	};
};
