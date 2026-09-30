/**
 * content.ts — Inti penulisan konten undangan (SATU pintu tulis).
 *
 * Modul ini mengekstrak logika dari `PUT /api/admin/content` menjadi fungsi
 * `applyContent(accountId, payload, opts)` yang dipakai ulang oleh:
 *   - `PUT /api/admin/content` (jalur resmi admin), dan
 *   - `POST /api/admin/import/apply` (impor JSON).
 *
 * Prinsip: validasi/whitelist/clamp HANYA di sini, agar semua penulis konten
 * (termasuk importer) selalu sinkron (rancangan §6.3). Tidak ada endpoint yang
 * menulis SQL konten sendiri.
 *
 * Catatan strategi:
 *  - `couple`, `events`, `gallery`, `gifts` → replace-all (atomik via `tx`).
 *  - `settings` → upsert per key, hanya key di `ADMIN_SETTING_KEYS`.
 *  - `mode`:
 *      'overwrite'  → perilaku PUT biasa (timpa).
 *      'fill-empty' → hanya tulis bila nilai saat ini KOSONG; field terisi
 *                     dibiarkan (aman untuk client lama). Lihat §6.3.
 *  - `guests/rsvp/wishes` TIDAK pernah disentuh (data runtime).
 */
import { one, many, run, tx } from './db';
import { clampStr, isSafeUrl, LIMITS } from './util';
import { normalizeDecoSlot } from './invitation';
import { normalizeDecoAsset } from '$lib/decoAssets';

/**
 * Key settings yang boleh dibaca/ditulis oleh panel admin (self-service).
 *
 * SUMBER KEBENARAN TUNGGAL untuk whitelist. Semua key yang dipakai UI admin
 * HARUS ada di sini, jika tidak nilainya akan diam-diam dibuang saat simpan
 * (bug "simpan sukses tapi setelan hilang").
 *
 * Catatan: `publicSettings()` sengaja dipersempit untuk halaman tamu publik,
 * jadi daftar itu BUKAN acuan admin. Acuan admin adalah konstanta di bawah.
 */
export const ADMIN_SETTING_KEYS = [
	// umum
	'music_url', 'quote', 'video_url', 'live_url', 'live_text',
	// amplop digital
	'qris_image', 'gift_address', 'gift_enabled',
	// branding
	'watermark_text', 'watermark_enabled',
	// latar belakang kustom (desktop)
	'background_image', 'background_overlay',
	'background_overlay_opacity', 'background_position', 'background_size',
	'background_repeat', 'background_attachment',
	// latar belakang kustom (mobile)
	'background_image_mobile', 'background_position_mobile',
	'background_size_mobile', 'background_repeat_mobile',
	// foto & dekorasi cover (fitur baru)
	'cover_mode', 'cover_photo',
	'decoration', 'decoration_animated',
	// dekorasi aset file lokal (opsional). Nilai divalidasi ke katalog `decoAssets`.
	'decoration_asset', 'decoration_asset_slot',
	// efek premium (animasi/parallax/ken-burns/transisi/filter foto).
	// Saklar memakai string '1'/'0' (konsisten dgn `decoration_animated`).
	'effects_enabled', 'effects_parallax', 'effects_kenburns',
	'effects_transition_enabled', 'effects_photo_filter_enabled',
	// pilihan efek (enum, divalidasi ketat di `normalizeSettingValue`).
	'effects_transition', 'effects_reveal', 'effects_intensity', 'effects_photo_filter',
	// gradasi premium (luluh/vignette/glow/overlay). Saklar '1'/'0'; gaya/target
	// & basis warna = enum; warna = hex 3/6 digit. Semua NONAKTIF secara default.
	'gradient_enabled', 'gradient_style', 'gradient_intensity', 'gradient_target',
	'gradient_palette', 'gradient_color'
] as const;

export const ADMIN_SETTING_SET = new Set<string>(ADMIN_SETTING_KEYS);

/** Nilai enum yang divalidasi ketat (cegah nilai sampah ke DB/CSS). */
const COVER_MODES = new Set(['plain', 'frame', 'shadow', 'polaroid', 'arch', 'circle', 'none']);
const DECORATIONS = new Set(['floral', 'leaves-sway', 'ethnic-jawa', 'ethnic-minang', 'none']);
// Efek premium — harus sinkron dgn tipe di `$lib/types` (PHOTO_FILTERS dll).
const EFFECT_TRANSITIONS = new Set(['none', 'wave', 'fade', 'curve']);
const EFFECT_REVEALS = new Set(['fade-up', 'fade', 'zoom', 'flip', 'slide', 'blur']);
const EFFECT_INTENSITIES = new Set(['subtle', 'medium', 'bold']);
const PHOTO_FILTERS = new Set(['none', 'warm', 'cool', 'mono', 'vintage', 'vivid', 'soft']);
/** Saklar efek premium (on/off). Key-nya di-whitelist di `ADMIN_SETTING_KEYS`. */
const EFFECT_TOGGLES = new Set([
	'effects_enabled',
	'effects_parallax',
	'effects_kenburns',
	'effects_transition_enabled',
	'effects_photo_filter_enabled'
]);

// Gradasi premium — enum & saklar. Harus sinkron dgn tipe di `$lib/types`.
const GRADIENT_STYLES = new Set(['none', 'luluh', 'vignette', 'glow', 'overlay']);
const GRADIENT_TARGETS = new Set(['cover', 'hero', 'both']);
const GRADIENT_PALETTES = new Set(['auto', 'custom']);
/** Saklar gradasi (on/off). Key-nya di-whitelist di `ADMIN_SETTING_KEYS`. */
const GRADIENT_TOGGLES = new Set(['gradient_enabled']);

/** Apakah nilai berupa warna hex 3/6 digit (#abc / #aabbcc)? */
function isHexColor(v: string): boolean {
	return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());
}

/** Bentuk payload tulis konten (subset longgar dari body PUT). */
export interface ContentPayload {
	couple?: Record<string, unknown>;
	events?: unknown[];
	gallery?: unknown[];
	gifts?: unknown[];
	settings?: Record<string, unknown>;
	account?: { title?: unknown; theme?: unknown };
	admin_password?: unknown;
}

export interface ApplyOptions {
	/** 'overwrite' (default) menimpa; 'fill-empty' hanya mengisi field kosong. */
	mode?: 'overwrite' | 'fill-empty';
}

export interface ApplyResult {
	/** Jumlah baris/field yang benar-benar ditulis. */
	written: number;
	/** Field yang dilewati karena sudah terisi (mode fill-empty). */
	skippedExisting: string[];
}

/**
 * Validasi nilai satu setting (whitelist + clamp + enum + URL safety).
 * Mengembalikan `null` bila key tidak diwhitelist (jangan ditulis).
 * Dipakai bersama oleh PUT & import agar sinkron.
 */
export function normalizeSettingValue(key: string, raw: unknown): string | null {
	if (!ADMIN_SETTING_SET.has(key)) return null;
	let val = String(raw ?? '').slice(0, 1000);
	// URL/gambar: buang bila tidak aman (http/https atau /uploads/…).
	if (key.includes('url') || key.includes('image') || key === 'qris_image') {
		if (val && !isSafeUrl(val)) val = '';
	}
	if (key === 'background_overlay_opacity') {
		const n = Number(val);
		val = Number.isFinite(n) ? String(Math.max(0, Math.min(1, n))) : '';
	}
	// Nilai enum cover/dekorasi: hanya terima nilai yang dikenal.
	if (key === 'cover_mode' && !COVER_MODES.has(val)) val = 'plain';
	if (key === 'decoration' && !DECORATIONS.has(val)) val = 'floral';
	if (key === 'decoration_animated') val = val === '1' || val === 'true' ? '1' : '0';
	// Dekorasi aset lokal: HANYA id dari katalog (path tetap, aman).
	if (key === 'decoration_asset') val = normalizeDecoAsset(val);
	if (key === 'decoration_asset_slot') val = normalizeDecoSlot(val);
	// Efek premium — saklar on/off: simpan '1' bila aktif, jika tidak '0'.
	if (EFFECT_TOGGLES.has(key)) val = val === '1' || val === 'true' ? '1' : '0';
	// Efek premium — pilihan enum: nilai asing → kosong (halaman tamu memakai
	// default aman via `publicSettings`).
	if (key === 'effects_transition' && !EFFECT_TRANSITIONS.has(val)) val = '';
	if (key === 'effects_reveal' && !EFFECT_REVEALS.has(val)) val = '';
	if (key === 'effects_intensity' && !EFFECT_INTENSITIES.has(val)) val = '';
	if (key === 'effects_photo_filter' && !PHOTO_FILTERS.has(val)) val = '';
	// Gradasi premium — saklar on/off: simpan '1' bila aktif, jika tidak '0'.
	if (GRADIENT_TOGGLES.has(key)) val = val === '1' || val === 'true' ? '1' : '0';
	// Gradasi premium — enum: nilai asing → default aman (tak berefek).
	if (key === 'gradient_style' && !GRADIENT_STYLES.has(val)) val = 'none';
	if (key === 'gradient_intensity' && !EFFECT_INTENSITIES.has(val)) val = 'medium';
	if (key === 'gradient_target' && !GRADIENT_TARGETS.has(val)) val = 'both';
	if (key === 'gradient_palette' && !GRADIENT_PALETTES.has(val)) val = 'auto';
	// Warna aksen gradasi: HANYA hex 3/6 digit (cegah suntingan CSS liar).
	if (key === 'gradient_color') val = isHexColor(val) ? val.trim().toLowerCase() : '';
	return val;
}

/** Apakah sebuah nilai dianggap "kosong" (untuk mode fill-empty). */
function isEmptyValue(v: unknown): boolean {
	return v == null || String(v).trim() === '';
}

/**
 * Tulis konten satu account. Atomik per-bagian, urutan & validasi persis
 * seperti PUT lama (agar perilaku tidak berubah).
 */
export async function applyContent(
	accountId: number,
	b: ContentPayload,
	opts: ApplyOptions = {}
): Promise<ApplyResult> {
	const mode = opts.mode === 'fill-empty' ? 'fill-empty' : 'overwrite';
	const fill = mode === 'fill-empty';
	const id = accountId;
	const result: ApplyResult = { written: 0, skippedExisting: [] };

	// -- Judul undangan / tema (account) --
	if (b.account) {
		const title = clampStr(b.account.title, LIMITS.medium);
		const theme = clampStr(b.account.theme, 60);
		if (fill) {
			const cur = await one<{ title: string | null; theme: string | null }>(
				'SELECT title, theme FROM accounts WHERE id = $1',
				[id]
			);
			const newTitle = isEmptyValue(cur?.title) ? title : (cur?.title ?? '');
			const newTheme = isEmptyValue(cur?.theme) ? theme || 'botanical' : (cur?.theme ?? 'botanical');
			await run('UPDATE accounts SET title = $1, theme = $2 WHERE id = $3', [newTitle, newTheme, id]);
		} else {
			const themeVal = theme || 'botanical';
			await run('UPDATE accounts SET title = $1, theme = $2 WHERE id = $3', [title, themeVal, id]);
		}
		result.written++;
	}

	// -- Ganti password admin (opsional) --
	if (b.admin_password) {
		const pw = String(b.admin_password).slice(0, 100);
		if (pw.length >= 5) {
			const { hashPassword } = await import('./security');
			await run('UPDATE accounts SET password_hash = $1 WHERE id = $2', [hashPassword(pw), id]);
			result.written++;
		}
	}

	// -- Mempelai --
	if (b.couple) {
		const c = b.couple;
		const fields = {
			groom_name: clampStr(c.groom_name, LIMITS.short),
			groom_full: clampStr(c.groom_full, LIMITS.medium),
			groom_ig: clampStr(c.groom_ig, LIMITS.short),
			groom_photo: isSafeUrl(c.groom_photo) ? clampStr(c.groom_photo, LIMITS.url) : '',
			groom_parents: clampStr(c.groom_parents, LIMITS.medium),
			bride_name: clampStr(c.bride_name, LIMITS.short),
			bride_full: clampStr(c.bride_full, LIMITS.medium),
			bride_ig: clampStr(c.bride_ig, LIMITS.short),
			bride_photo: isSafeUrl(c.bride_photo) ? clampStr(c.bride_photo, LIMITS.url) : '',
			bride_parents: clampStr(c.bride_parents, LIMITS.medium),
			love_story: clampStr(c.love_story, LIMITS.story)
		};
		const existing = await one<Record<string, string | null>>(
			'SELECT * FROM couple WHERE account_id = $1',
			[id]
		);
		let toWrite = { ...fields };
		if (fill && existing) {
			// Hanya tulis field yang saat ini kosong.
			for (const k of Object.keys(fields) as (keyof typeof fields)[]) {
				if (!isEmptyValue(existing[k])) {
					toWrite[k] = String(existing[k] ?? '');
					if (!isEmptyValue(fields[k])) result.skippedExisting.push(`couple.${k}`);
				}
			}
		}
		if (existing) {
			await run(
				`UPDATE couple SET groom_name=$1, groom_full=$2, groom_ig=$3, groom_photo=$4, groom_parents=$5,
				 bride_name=$6, bride_full=$7, bride_ig=$8, bride_photo=$9, bride_parents=$10, love_story=$11
				 WHERE account_id=$12`,
				[...Object.values(toWrite), id]
			);
		} else {
			await run(
				`INSERT INTO couple (account_id, groom_name, groom_full, groom_ig, groom_photo, groom_parents,
				 bride_name, bride_full, bride_ig, bride_photo, bride_parents, love_story)
				 VALUES ($12,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
				[...Object.values(toWrite), id]
			);
		}
		result.written += Object.values(fields).filter((v) => v !== '').length;
	}

	// -- Events (replace-all, ATOMIK) --
	// Dibungkus transaksi: bila satu baris gagal, DELETE ikut di-rollback
	// sehingga daftar lama TIDAK hilang (dulu: DELETE sudah commit → data lenyap).
	if (Array.isArray(b.events)) {
		const cur = fill ? await one<{ c: string }>('SELECT COUNT(*)::text AS c FROM events WHERE account_id = $1', [id]) : null;
		const hasExisting = cur ? Number(cur.c) > 0 : false;
		if (fill && hasExisting) {
			result.skippedExisting.push('events[]');
		} else {
			await tx(async (c) => {
				await c.query('DELETE FROM events WHERE account_id = $1', [id]);
				let i = 0;
				for (const e of b.events as Record<string, unknown>[]) {
					await c.query(
						`INSERT INTO events (account_id, key, title, date_iso, time_text, venue, address, maps_url, sort)
						 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
						[
							id,
							clampStr(e.key, 40),
							clampStr(e.title, LIMITS.short),
							clampStr(e.date_iso, 40),
							clampStr(e.time_text, LIMITS.short),
							clampStr(e.venue, LIMITS.medium),
							clampStr(e.address, LIMITS.medium),
							isSafeUrl(e.maps_url) ? clampStr(e.maps_url, LIMITS.url) : '',
							i++
						]
					);
				}
			});
			result.written += b.events.length;
		}
	}

	// -- Gallery (replace-all, ATOMIK) --
	// Kolom PERSIS skema gallery: (account_id, url, caption, sort). JANGAN tambah
	// kolom yang tidak ada di schema.ts (mis. 'icon') — bikin error 42703.
	if (Array.isArray(b.gallery)) {
		const cur = fill ? await one<{ c: string }>('SELECT COUNT(*)::text AS c FROM gallery WHERE account_id = $1', [id]) : null;
		const hasExisting = cur ? Number(cur.c) > 0 : false;
		if (fill && hasExisting) {
			result.skippedExisting.push('gallery[]');
		} else {
			await tx(async (c) => {
				await c.query('DELETE FROM gallery WHERE account_id = $1', [id]);
				let i = 0;
				for (const g of b.gallery as Record<string, unknown>[]) {
					const url = isSafeUrl(g.url) ? clampStr(g.url, LIMITS.url) : '';
					if (!url) continue;
					await c.query('INSERT INTO gallery (account_id, url, caption, sort) VALUES ($1,$2,$3,$4)', [
						id,
						url,
						clampStr(g.caption, LIMITS.medium),
						i++
					]);
					result.written++;
				}
			});
		}
	}

	// -- Gifts (replace-all, ATOMIK) --
	// Kolom PERSIS skema gifts: (account_id, type, bank_name, account_no,
	// account_name, sort). Kolom 'icon' TIDAK ada di skema — jangan ditambah.
	if (Array.isArray(b.gifts)) {
		const cur = fill ? await one<{ c: string }>('SELECT COUNT(*)::text AS c FROM gifts WHERE account_id = $1', [id]) : null;
		const hasExisting = cur ? Number(cur.c) > 0 : false;
		// Gifts jarang diisi template; tetap hormati fill-empty.
		if (fill && hasExisting) {
			result.skippedExisting.push('gifts[]');
		} else {
			await tx(async (c) => {
				await c.query('DELETE FROM gifts WHERE account_id = $1', [id]);
				let i = 0;
				for (const g of b.gifts as Record<string, unknown>[]) {
					await c.query(
						`INSERT INTO gifts (account_id, type, bank_name, account_no, account_name, sort)
						 VALUES ($1,$2,$3,$4,$5,$6)`,
						[
							id,
							// `type` NOT NULL di skema → fallback 'bank' bila kosong.
							clampStr(g.type, 40) || 'bank',
							clampStr(g.bank_name, LIMITS.medium),
							clampStr(g.account_no, LIMITS.short),
							clampStr(g.account_name, LIMITS.medium),
							i++
						]
					);
					result.written++;
				}
			});
		}
	}

	// -- Settings (upsert per key) --
	if (b.settings && typeof b.settings === 'object') {
		// Baca nilai lama bila fill-empty (untuk lompati key yang sudah terisi).
		let current: Record<string, string> = {};
		if (fill) {
			const list = await many<{ key: string; value: string | null }>(
				'SELECT key, value FROM settings WHERE account_id = $1',
				[id]
			);
			for (const r of list) current[r.key] = r.value ?? '';
		}
		for (const [k, v] of Object.entries(b.settings)) {
			const val = normalizeSettingValue(k, v);
			if (val === null) continue; // key tak diwhitelist → buang.
			if (fill && !isEmptyValue(current[k]) && !isEmptyValue(val)) {
				result.skippedExisting.push(`settings.${k}`);
				continue;
			}
			await run(
				`INSERT INTO settings (account_id, key, value) VALUES ($1,$2,$3)
				 ON CONFLICT (account_id, key) DO UPDATE SET value = EXCLUDED.value`,
				[id, k, val]
			);
			if (!isEmptyValue(val)) result.written++;
		}
	}

	return result;
}
