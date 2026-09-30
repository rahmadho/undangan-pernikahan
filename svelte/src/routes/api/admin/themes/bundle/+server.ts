import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { run, tx } from '$lib/server/db';
import { requireAccountAdmin, enforceRate } from '$lib/server/auth';
import { clampStr } from '$lib/server/util';
import { THEMES } from '$lib/theme';
import { getBundle } from '$lib/bundles';
import { normalizeDecoAsset } from '$lib/decoAssets';
import { normalizeDecoSlot } from '$lib/server/invitation';

/**
 * Nilai enum yang diterima untuk setelan bundle. Diselaraskan dengan
 * validasi `PUT /api/admin/content` — TIDAK menambah nilai baru.
 */
const COVER_MODES = new Set(['plain', 'frame', 'shadow', 'polaroid', 'arch', 'circle', 'none']);
const DECORATIONS = new Set(['floral', 'leaves-sway', 'ethnic-jawa', 'ethnic-minang', 'none']);

/**
 * POST /api/admin/themes/bundle — terapkan BUNDLE PRESET.
 *
 * Body: { theme: string }
 * Efek: set `accounts.theme` + setelan ornamen/bingkai/dekorasi yang SERASI
 *       (lihat `$lib/bundles`) dalam SATU transaksi. Bila tema tidak dikenal
 *       preset, ditolak (400) — tema kustom TIDAK boleh lewat jalur ini
 *       (warna/font-nya dikelola terpisah).
 *
 * Keamanan: hanya `theme` dari daftar `THEMES` yang diterima; semua setelan
 * yang ditulis berasal dari `getBundle()` (nilai tetap, bukan input user),
 * lalu dinormalisasi lewat helper resmi yang sama dengan content PUT.
 */
export const POST: RequestHandler = async (event) => {
	const acc = await requireAccountAdmin(event);
	enforceRate('admin-write', event, 60_000, 30);

	const b = await event.request.json().catch(() => ({}));
	const theme = clampStr(b.theme, 60);
	if (!(THEMES as readonly string[]).includes(theme)) {
		throw error(400, { message: 'Tema preset tidak dikenal.' });
	}

	const bundle = getBundle(theme);
	// Normalisasi nilai bundle lewat helper resmi (defense-in-depth).
	const deco = DECORATIONS.has(bundle.decoration) ? bundle.decoration : 'floral';
	const cmode = COVER_MODES.has(bundle.cover_mode) ? bundle.cover_mode : 'frame';
	const dasset = normalizeDecoAsset(bundle.decoration_asset);
	const dslot = normalizeDecoSlot(bundle.decoration_asset_slot);
	const anim = bundle.decoration_animated === '1' ? '1' : '0';

	const pairs: [string, string][] = [
		['decoration', deco],
		['cover_mode', cmode],
		['decoration_asset', dasset],
		['decoration_asset_slot', dslot],
		['decoration_animated', anim]
	];

	await tx(async (c) => {
		await c.query('UPDATE accounts SET theme = $1 WHERE id = $2', [theme, acc.id]);
		for (const [k, v] of pairs) {
			await c.query(
				`INSERT INTO settings (account_id, key, value) VALUES ($1,$2,$3)
				 ON CONFLICT (account_id, key) DO UPDATE SET value = EXCLUDED.value`,
				[acc.id, k, v]
			);
		}
	});

	return json({ ok: true, theme, settings: Object.fromEntries(pairs) });
};
