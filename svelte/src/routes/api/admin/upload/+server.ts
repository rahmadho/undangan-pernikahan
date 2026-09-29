import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAccountAdmin, enforceRate } from '$lib/server/auth';
import { saveUpload, type UploadKind } from '$lib/server/upload';

/**
 * POST /api/admin/upload — terima file (form field "file", query ?kind=audio|image).
 * Mengembalikan { url } untuk dipakai di settings/konten.
 */
export const POST: RequestHandler = async (event) => {
	const acc = await requireAccountAdmin(event);
	enforceRate('upload', event, 60_000, 12);

	const kind = (event.url.searchParams.get('kind') || 'audio') as UploadKind;
	if (kind !== 'audio' && kind !== 'image') throw error(400, { message: 'Jenis upload tidak valid.' });

	const form = await event.request.formData().catch(() => null);
	if (!form) throw error(400, { message: 'Form tidak valid.' });
	const file = form.get('file');
	if (!(file instanceof File) || file.size === 0) throw error(400, { message: 'Tidak ada file yang diunggah.' });

	try {
		const res = await saveUpload(file, kind);
		return json({ ok: true, ...res });
	} catch (e) {
		throw error(400, { message: (e as Error).message });
	}
};
