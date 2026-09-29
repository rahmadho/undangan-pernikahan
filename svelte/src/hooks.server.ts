import type { Handle, HandleServerError } from '@sveltejs/kit';
import { securityHeaders } from '$lib/server/security';
import { ensureSchema } from '$lib/server/schema';

/** Pasang security headers di semua respons + pastikan skema DB siap. */
export const handle: Handle = async ({ event, resolve }) => {
	// Pastikan tabel ada (idempoten, hanya sekali per proses).
	await ensureSchema().catch(() => {});

	const response = await resolve(event);
	const headers = securityHeaders();
	for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
	return response;
};

/** Error handler global: kembalikan JSON yang konsisten untuk API. */
export const handleError: HandleServerError = ({ error: err, status }) => {
	const message =
		(err as { body?: { message?: string } })?.body?.message ||
		(err as Error)?.message ||
		'Terjadi kesalahan pada server.';
	// Pesan multer (upload) diteruskan apa adanya agar ramah client.
	return { message, status };
};
