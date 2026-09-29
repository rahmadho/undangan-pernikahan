import type { PageServerLoad } from './$types';

/** Sediakan slug ke halaman admin. */
export const load: PageServerLoad = async ({ params }) => {
	return { slug: params.slug.toLowerCase().trim() };
};
