import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAccountAdmin, enforceRate } from '$lib/server/auth';
import { applyContent, type ContentPayload } from '$lib/server/content';
import { revalidateDraft, draftToPayload, type RevalidateOptions } from '$lib/server/importer/apply';
import type { ImportDraft } from '$lib/importer/types';

/**
 * POST /api/admin/import/apply
 *
 * Terima `ImportDraft` (hasil preview, boleh sudah dikoreksi client) dan tulis
 * ke konten account. **Selalu validasi ULANG** nilai di server (jangan percaya
 * draft kiriman client) lewat jalur tulis tunggal `applyContent()`
 * (rancangan §6.3).
 *
 * Body:
 *   {
 *     draft: ImportDraft,             // wajib
 *     mode: 'fill-empty'|'overwrite', // default 'fill-empty' (aman)
 *     imageMode: 'link'|'download',   // default 'link'
 *     account?: { title }             // opsional: ikut setel judul undangan
 *   }
 *
 * Respons: { ok, applied: { written, settings, ... }, skipped: [...], images: [...] }
 */
export const POST: RequestHandler = async (event) => {
	const acc = await requireAccountAdmin(event);
	enforceRate('admin-write', event, 60_000, 30);

	const body = (await event.request.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body || typeof body !== 'object') throw error(400, { message: 'Body JSON tidak valid.' });

	const draft = body.draft as ImportDraft | undefined;
	if (!draft || typeof draft !== 'object' || !draft.couple || !Array.isArray(draft.events)) {
		throw error(400, {
			message: 'Field "draft" wajib berisi hasil preview (couple & events). Jalankan /import/preview dulu.'
		});
	}

	const mode = body.mode === 'overwrite' ? 'overwrite' : 'fill-empty';
	const imageMode = body.imageMode === 'download' ? 'download' : 'link';

	// 1) Re-validasi & sanitasi draft (jangan percaya client).
	const opts: RevalidateOptions = { imageMode };
	let validated;
	try {
		validated = await revalidateDraft(draft, opts);
	} catch (e) {
		throw error(400, { message: (e as Error).message });
	}

	// 2) Susun payload tulis dari draft yang sudah bersih.
	const payload: ContentPayload = draftToPayload(validated);
	// Judul undangan opsional (mis. judul template / nama pasangan).
	if (body.account && typeof body.account === 'object') {
		const t = (body.account as Record<string, unknown>).title;
		if (t != null && String(t).trim()) payload.account = { title: String(t) };
	}

	// 3) Tulis lewat SATU pintu (validasi whitelist/clamp tetap di applyContent).
	const result = await applyContent(acc.id, payload, { mode });

	return json({
		ok: true,
		mode,
		imageMode,
		applied: {
			written: result.written,
			couple: validated.couple.groom_name || validated.couple.bride_name ? 1 : 0,
			events: validated.events.length,
			gallery: validated.gallery.length,
			settings: Object.values(validated.settings).filter((v) => v !== '').length
		},
		skippedExisting: result.skippedExisting,
		images: validated.images
	});
};
