import { json } from '@sveltejs/kit';
import { ping } from '$lib/server/db';
import { ensureSchema } from '$lib/server/schema';

/** GET /healthz — cek kesehatan app + database. */
export async function GET() {
	try {
		await ensureSchema();
		const dbOk = await ping();
		return json({ status: dbOk ? 'ok' : 'error', db: 'postgres', uptime: Math.round(process.uptime()) });
	} catch (err) {
		return json({ status: 'error', message: (err as Error).message }, { status: 503 });
	}
}
