import { json } from '@sveltejs/kit';
import { ensureSchema } from '$lib/server/schema';
import { seedAll } from '$lib/server/seed';

/** POST /api/setup — siapkan skema + seed data contoh (idempoten). */
export async function POST() {
	try {
		await ensureSchema();
		await seedAll();
		return json({ ok: true });
	} catch (err) {
		return json({ error: (err as Error).message }, { status: 500 });
	}
}
