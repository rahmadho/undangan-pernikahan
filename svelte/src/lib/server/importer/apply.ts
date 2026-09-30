/**
 * apply.ts — Jembatan antara `ImportDraft` (hasil parser murni / koreksi client)
 * dan payload tulis `applyContent()`.
 *
 * Dua tanggung jawab:
 *  1. `revalidateDraft(draft, opts)` — validasi ULANG & sanitasi seluruh nilai
 *     draft di sisi server (jangan percaya kiriman client): clamp panjang,
 *     `isSafeUrl`, parsing ulang tanggal, buang field kosong, dan resolve gambar
 *     sesuai `imageMode` (`link` simpan apa adanya; `download` unduh ke lokal
 *     lewat guard SSRF).
 *  2. `draftToPayload(validated)` — susun `ContentPayload` (couple/events/gallery/
 *     settings) yang siap diberikan ke `applyContent()`.
 *
 * Tidak menulis DB sendiri — itu tugas `applyContent`.
 */
import { clampStr, isSafeUrl, LIMITS } from '$lib/server/util';
import { parseDateId, parseTimeId } from '$lib/importer/elementor';
import { IMPORT_LIMITS, type ImportDraft, type ImageRef } from '$lib/importer/types';
import { fetchImage } from './ssrf';
import { saveImageBytes } from '$lib/server/upload';
import { env } from '$env/dynamic/private';

export interface RevalidateOptions {
	imageMode: 'link' | 'download';
}

/** Hasil draft yang sudah tervalidasi (subset aman untuk ditulis). */
export interface ValidatedDraft {
	couple: {
		groom_name: string;
		groom_full: string;
		groom_photo: string;
		groom_parents: string;
		bride_name: string;
		bride_full: string;
		bride_photo: string;
		bride_parents: string;
	};
	events: {
		key: string;
		title: string;
		date_iso: string;
		time_text: string;
		venue: string;
		address: string;
		maps_url: string;
	}[];
	gallery: { url: string; caption: string }[];
	settings: Record<string, string>;
	images: ImageRef[];
	/** Catatan gambar yang gagal diunduh (mode download) beserta alasannya. */
	imageErrors: { url: string; reason: string }[];
}

/** Batas jumlah gambar yang boleh diunduh (cegah DoS). */
const MAX_DOWNLOADS = 30;

/**
 * Validasi ulang & sanitasi draft. Bila `imageMode='download'`, gambar remote
 * diunduh & disimpan lokal, lalu URL di draft diganti `/uploads/...`.
 */
export async function revalidateDraft(
	draft: ImportDraft,
	opts: RevalidateOptions
): Promise<ValidatedDraft> {
	const out: ValidatedDraft = {
		couple: {
			groom_name: clampStr(draft.couple?.groom_name, LIMITS.short),
			groom_full: clampStr(draft.couple?.groom_full, LIMITS.medium),
			groom_photo: safeUrl(draft.couple?.groom_photo, LIMITS.url),
			groom_parents: clampStr(draft.couple?.groom_parents, LIMITS.medium),
			bride_name: clampStr(draft.couple?.bride_name, LIMITS.short),
			bride_full: clampStr(draft.couple?.bride_full, LIMITS.medium),
			bride_photo: safeUrl(draft.couple?.bride_photo, LIMITS.url),
			bride_parents: clampStr(draft.couple?.bride_parents, LIMITS.medium)
		},
		events: [],
		gallery: [],
		settings: {},
		images: [],
		imageErrors: []
	};

	// -- Events: validasi ulang tanggal (paling rapuh) --
	const seenKeys = new Set<string>();
	for (const e of Array.isArray(draft.events) ? draft.events : []) {
		const dateRaw = clampStr(e?.date_iso, 40);
		// Terima ISO yang sudah benar (YYYY-MM-DD atau YYYY-MM-DDTHH:mm); bila
		// tidak, coba parse ulang teksnya. Gagal → '' (biar client isi manual).
		const dateIso = normalizeIsoDate(dateRaw);
		let key = clampStr(e?.key, 40) || 'acara';
		// Cegah kunci duplikat (UNIQUE account_id,key) → sufiks.
		let base = key;
		let n = 2;
		while (seenKeys.has(key)) key = `${base}-${n++}`;
		seenKeys.add(key);
		out.events.push({
			key,
			title: clampStr(e?.title, LIMITS.short) || 'Acara',
			date_iso: dateIso,
			time_text: clampStr(e?.time_text, LIMITS.short),
			venue: clampStr(e?.venue, LIMITS.medium),
			address: clampStr(e?.address, LIMITS.medium),
			maps_url: safeUrl(e?.maps_url, LIMITS.url)
		});
	}

	// -- Images: kumpulkan URL yang perlu diproses (mode download) --
	// Peta url → url-akhir (lokal) agar bisa diganti konsisten di couple/galeri.
	const remap = new Map<string, string>();
	if (opts.imageMode === 'download') {
		const urls = collectRemoteUrls(draft);
		let count = 0;
		const maxBytes = (Number(env.IMAGE_MAX_MB) || 6) * 1024 * 1024;
		for (const url of urls) {
			if (count >= MAX_DOWNLOADS) {
				out.imageErrors.push({ url, reason: `Melebihi batas ${MAX_DOWNLOADS} gambar unduhan.` });
				continue;
			}
			count++;
			try {
				const img = await fetchImage(url, { maxBytes });
				const saved = await saveImageBytes(img.bytes, img.ext);
				remap.set(url, saved.url);
				out.images.push({ url: saved.url, source: 'local', usedFor: 'downloaded' });
			} catch (e) {
				out.imageErrors.push({ url, reason: (e as Error).message });
				// Mode download: gambar gagal → jangan simpan URL remote (demi
				// mencegah hotlink mati). Kosongkan agar client unggah manual.
				remap.set(url, '');
			}
		}
	} else {
		// Mode link: simpan URL apa adanya (sudah lolos isSafeUrl).
		for (const img of draft.images ?? []) {
			if (isSafeUrl(img.url)) out.images.push({ url: img.url, source: img.source, usedFor: img.usedFor });
		}
	}

	const fix = (u: string): string => (remap.has(u) ? remap.get(u)! : u);

	// -- Gallery --
	for (const g of Array.isArray(draft.gallery) ? draft.gallery : []) {
		if (out.gallery.length >= IMPORT_LIMITS.maxGallery) break;
		const url = safeUrl(fix(clampStr(g?.url, LIMITS.url)), LIMITS.url);
		if (!url) continue;
		out.gallery.push({ url, caption: clampStr(g?.caption, LIMITS.medium) });
	}

	// Terapkan remap ke URL gambar mempelai.
	out.couple.groom_photo = safeUrl(fix(out.couple.groom_photo), LIMITS.url);
	out.couple.bride_photo = safeUrl(fix(out.couple.bride_photo), LIMITS.url);

	// -- Settings (hanya key yang dikenal importer; whitelist final di applyContent) --
	const s = draft.settings ?? ({} as ImportDraft['settings']);
	const settings: Record<string, string> = {};
	const set = (k: string, v: unknown, max = 240) => {
		const val = clampStr(v, max);
		if (val) settings[k] = val;
	};
	set('quote', s.quote, IMPORT_LIMITS.maxQuote);
	// Latar cover: bila mode download, remap URL ke lokal.
	set('background_image', safeUrl(fix(clampStr(s.background_image, LIMITS.url)), LIMITS.url), LIMITS.url);
	set('background_image_mobile', safeUrl(fix(clampStr(s.background_image_mobile, LIMITS.url)), LIMITS.url), LIMITS.url);
	set('background_overlay', s.background_overlay, 32);
	// Opacity di-clamp 0–1 (validasi keras ada di applyContent juga).
	if (s.background_overlay_opacity !== '') {
		const n = Number(s.background_overlay_opacity);
		if (Number.isFinite(n)) settings.background_overlay_opacity = String(Math.max(0, Math.min(1, n)));
	}
	for (const k of ['background_position', 'background_size', 'background_repeat', 'background_attachment'] as const) {
		const val = clampStr(s[k], 32);
		if (val) settings[k] = val;
	}
	out.settings = settings;

	return out;
}

/** Susun payload untuk `applyContent()` (hanya bagian yang tidak kosong). */
export function draftToPayload(v: ValidatedDraft): {
	couple?: Record<string, string>;
	events?: Record<string, string>[];
	gallery?: Record<string, string>[];
	settings?: Record<string, string>;
} {
	const payload: ReturnType<typeof draftToPayload> = {};
	const hasCouple = Object.values(v.couple).some((x) => x !== '');
	if (hasCouple) payload.couple = { ...v.couple };
	if (v.events.length) payload.events = v.events.map((e) => ({ ...e }));
	if (v.gallery.length) payload.gallery = v.gallery.map((g) => ({ ...g }));
	if (Object.keys(v.settings).length) payload.settings = { ...v.settings };
	return payload;
}

/* -------------------------------------------------------------------------- */

/** Kumpulkan URL remote unik yang dirujuk draft (cover, foto, galeri). */
function collectRemoteUrls(draft: ImportDraft): string[] {
	const set = new Set<string>();
	const add = (u: unknown) => {
		const s = String(u ?? '').trim();
		if (/^https?:\/\//i.test(s)) set.add(s);
	};
	add(draft.couple?.groom_photo);
	add(draft.couple?.bride_photo);
	add(draft.settings?.background_image);
	add(draft.settings?.background_image_mobile);
	for (const g of draft.gallery ?? []) add(g?.url);
	return [...set];
}

/** URL aman (http/https atau /uploads) atau '' bila tidak aman/kosong. */
function safeUrl(v: unknown, max: number): string {
	const s = clampStr(v, max);
	if (!s) return '';
	return isSafeUrl(s) ? s : '';
}

/**
 * Normalisasi `date_iso` hasil draft:
 *  - ISO `YYYY-MM-DD` atau `YYYY-MM-DDTHH:mm` → diterima apa adanya.
 *  - teks tanggal Indonesia → parse ulang.
 *  - gagal → '' (client isi manual).
 */
function normalizeIsoDate(v: string): string {
	const s = String(v || '').trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
	const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2})/);
	if (m) {
		const t = parseTimeId(m[2]);
		return t ? `${m[1]}T${t}` : m[1];
	}
	return parseDateId(s);
}
