/**
 * invitation.ts — Query data undangan per-account (untuk halaman tamu & admin).
 * Semua fungsi async (Postgres).
 */
import { many, one, type Row } from './db';
import type { Account } from './auth';
import { normalizeDecoAsset } from '$lib/decoAssets';

/** Slot tampilan dekorasi aset lokal (opsional). */
export const DECO_SLOTS = ['both', 'cover', 'hero'] as const;
export type DecoSlot = (typeof DECO_SLOTS)[number];

/** Validasi slot; default 'both'. */
export function normalizeDecoSlot(v: unknown): DecoSlot {
	const s = typeof v === 'string' ? v.trim() : '';
	return (DECO_SLOTS as readonly string[]).includes(s) ? (s as DecoSlot) : 'both';
}

/** Semua key settings yang boleh ada. */
export const SETTING_KEYS = [
	'music_url', 'quote',
	// event / tanggal
	'akad_date', 'resepsi_date',
	// galeri video & live
	'video_url', 'live_url', 'live_text',
	// QRIS & kirim hadiah
	'qris_image', 'gift_address', 'gift_enabled',
	// branding
	'watermark_text', 'watermark_enabled',
	// latar belakang kustom (desktop & mobile)
	'background_image', 'background_image_mobile', 'background_overlay',
	'background_overlay_opacity', 'background_position', 'background_size',
	'background_repeat', 'background_attachment',
	'background_position_mobile', 'background_size_mobile', 'background_repeat_mobile',
	// foto & dekorasi cover
	'cover_mode', 'cover_photo', 'decoration', 'decoration_animated',
	// dekorasi dari aset file lokal (opsional; lihat decoAssets.ts)
	'decoration_asset', 'decoration_asset_slot'
] as const;

/** Ambil semua settings account sebagai objek key->value. */
export async function getSettings(accountId: number): Promise<Record<string, string>> {
	const rows = await many<{ key: string; value: string | null }>(
		'SELECT key, value FROM settings WHERE account_id = $1',
		[accountId]
	);
	const out: Record<string, string> = {};
	for (const r of rows) out[r.key] = r.value ?? '';
	return out;
}

/** Data mentah lengkap satu account. */
export async function getInvitationData(account: Account | Row) {
	const id = account.id as number;
	const [couple, events, gallery, gifts, wishes, settings] = await Promise.all([
		one('SELECT * FROM couple WHERE account_id = $1', [id]),
		many('SELECT * FROM events WHERE account_id = $1 ORDER BY sort, id', [id]),
		many('SELECT * FROM gallery WHERE account_id = $1 ORDER BY sort, id', [id]),
		many('SELECT * FROM gifts WHERE account_id = $1 ORDER BY sort, id', [id]),
		many('SELECT * FROM wishes WHERE account_id = $1 ORDER BY created_at DESC LIMIT 60', [id]),
		getSettings(id)
	]);
	return { couple, events, gallery, gifts, wishes, settings };
}

/** Settings yang aman dikirim ke publik (tanpa rahasia). */
export function publicSettings(account: Account, settings: Record<string, string>) {
	return {
		music_url: settings.music_url || '',
		quote: settings.quote || '',
		theme: account.theme || 'botanical',
		// video & live
		video_url: settings.video_url || '',
		live_url: settings.live_url || '',
		live_text: settings.live_text || '',
		// amplop
		qris_image: settings.qris_image || '',
		gift_address: settings.gift_address || '',
		gift_enabled: settings.gift_enabled || '',
		// branding
		watermark_text: settings.watermark_text || '',
		watermark_enabled: settings.watermark_enabled || '',
		// latar kustom
		background_image: settings.background_image || '',
		background_image_mobile: settings.background_image_mobile || '',
		background_overlay: settings.background_overlay || '',
		background_overlay_opacity: settings.background_overlay_opacity || '',
		background_position: settings.background_position || '',
		background_size: settings.background_size || '',
		background_repeat: settings.background_repeat || '',
		background_attachment: settings.background_attachment || '',
		background_position_mobile: settings.background_position_mobile || '',
		background_size_mobile: settings.background_size_mobile || '',
		background_repeat_mobile: settings.background_repeat_mobile || '',
		// foto & dekorasi cover
		cover_mode: settings.cover_mode || 'plain',
		cover_photo: settings.cover_photo || '',
		decoration: settings.decoration || 'floral',
		decoration_animated: settings.decoration_animated || '1',
		// dekorasi aset lokal (opsional). Dinormalisasi ke katalog agar halaman
		// tamu tak pernah menerima id asing.
		decoration_asset: normalizeDecoAsset(settings.decoration_asset),
		decoration_asset_slot: normalizeDecoSlot(settings.decoration_asset_slot)
	};
}

/** Tema kustom milik account. */
export async function getCustomThemes(accountId: number) {
	const rows = await many<{ id: number; slug: string; name: string; base: string; tokens: string }>(
		'SELECT id, slug, name, base, tokens FROM themes WHERE account_id = $1 ORDER BY created_at',
		[accountId]
	);
	return rows.map((r) => {
		let tokens: Record<string, string> = {};
		try {
			tokens = JSON.parse(r.tokens || '{}');
		} catch {
			tokens = {};
		}
		return { ...r, tokens };
	});
}
