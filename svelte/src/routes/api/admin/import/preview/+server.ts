import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAccountAdmin, enforceRate } from '$lib/server/auth';
import { parseElementor, detectFormat } from '$lib/importer/elementor';
import { IMPORT_LIMITS } from '$lib/importer/types';

/**
 * POST /api/admin/import/preview
 *
 * Terima ekspor JSON Elementor/Landingstar dan kembalikan `ImportDraft` +
 * laporan pemetaan. **TIDAK menulis apa pun** ke DB (rancangan §3, §6.2).
 *
 * Format body yang diterima:
 *  - `{ json: <objek|string> }` (paling umum), ATAU
 *  - `{ data: <...> }` (alias), ATAU
 *  - body JSON mentah (objek Elementor langsung), ATAU
 *  - `text/plain` berisi JSON sebagai string, ATAU
 *  - `multipart/form-data` dengan field `file`/`json` berisi berkas `.json`.
 *
 * Batas: ukuran body (2 MB) & kedalaman/jumlah node (di parser murni).
 */
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB

export const POST: RequestHandler = async (event) => {
	// Auth admin akun + rate limit (baca-saja, tapi tetap batasi).
	const acc = await requireAccountAdmin(event);
	enforceRate('import-preview', event, 60_000, 30);

	const contentType = event.request.headers.get('content-type') || '';
	let raw: unknown;

	try {
		if (contentType.includes('multipart/form-data')) {
			raw = await readFromForm(event.request);
		} else {
			const text = await readText(event.request);
			raw = extractJsonPayload(text, contentType);
		}
	} catch (e) {
		throw error(400, { message: (e as Error).message });
	}

	// Parser murni: lempar Error Bahasa Indonesia untuk JSON cacat.
	let draft;
	try {
		draft = parseElementor(raw);
	} catch (e) {
		throw error(400, { message: (e as Error).message });
	}

	// Tolak bila format tidak dikenali (bukan Elementor) — informatif.
	if (draft.report.format !== 'elementor' || detectFormat(raw) === 'unknown') {
		// Parser masih mengembalikan draft (dengan report.fatal kosong), tapi
		// kita beri 400 jelas agar client tidak meng-apply sampah.
		if (draft.events.length === 0 && !draft.couple.groom_name && !draft.couple.bride_name) {
			throw error(400, {
				message:
					'Format tidak dikenali sebagai ekspor Elementor/Landingstar (tidak ada pasangan/acara terdeteksi).'
			});
		}
	}

	return json({
		ok: true,
		account: { slug: acc.slug, title: acc.title },
		limits: IMPORT_LIMITS,
		draft
	});
};

/* -------------------------------------------------------------------------- */

/** Baca teks body dengan batas ukuran. */
async function readText(req: Request): Promise<string> {
	const cl = Number(req.headers.get('content-length') || '0');
	if (cl && cl > MAX_BODY_BYTES) throw new Error('Ukuran JSON melebihi 2 MB.');
	const text = await req.text();
	if (text.length > MAX_BODY_BYTES) throw new Error('Ukuran JSON melebihi 2 MB.');
	return text;
}

/** Ambil JSON dari body teks (bisa dibungkus {json}/{data} atau JSON mentah). */
function extractJsonPayload(text: string, contentType: string): unknown {
	const trimmed = text.trim();
	if (!trimmed) throw new Error('Body kosong: sertakan JSON ekspor Elementor.');
	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		// text/plain bisa jadi string JSON ganda-parse.
		throw new Error('JSON tidak valid: gagal di-parse.');
	}
	// Bila dibungkus { json: ... } / { data: ... }, buka.
	if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
		const o = parsed as Record<string, unknown>;
		if ('json' in o) {
			return typeof o.json === 'string' ? safeParse(o.json) : o.json;
		}
		if ('data' in o && !('content' in o)) {
			return typeof o.data === 'string' ? safeParse(o.data) : o.data;
		}
	}
	void contentType;
	return parsed;
}

function safeParse(s: string): unknown {
	try {
		return JSON.parse(s);
	} catch {
		throw new Error('Field "json" bukan string JSON yang valid.');
	}
}

/** Baca JSON dari multipart (field `file` atau `json`). */
async function readFromForm(req: Request): Promise<unknown> {
	const form = await req.formData().catch(() => null);
	if (!form) throw new Error('Form tidak valid.');
	const jsonField = form.get('json');
	if (typeof jsonField === 'string' && jsonField.trim()) {
		return safeParse(jsonField);
	}
	const file = form.get('file');
	if (file instanceof File) {
		if (file.size > MAX_BODY_BYTES) throw new Error('Ukuran berkas JSON melebihi 2 MB.');
		const text = await file.text();
		return safeParse(text);
	}
	throw new Error('Tidak ada berkas JSON (field "file") atau field "json".');
}
