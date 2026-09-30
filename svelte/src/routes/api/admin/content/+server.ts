import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAccountAdmin, enforceRate } from '$lib/server/auth';
import { getInvitationData, getCustomThemes, publicSettings } from '$lib/server/invitation';
import { applyContent } from '$lib/server/content';

/**
 * GET /api/admin/content — seluruh konten account (untuk panel admin).
 */
export const GET: RequestHandler = async (event) => {
	const acc = await requireAccountAdmin(event);
	const data = await getInvitationData(acc);
	const themes = await getCustomThemes(acc.id);
	// Gabungkan settings MENTAH (semua key termasuk cover/decoration) dengan
	// nilai publik yang sudah dinormalisasi. Yang mentah dipakai panel admin
	// agar form bisa memuat ulang nilai yang baru disimpan.
	const settings: Record<string, string> = { ...data.settings, ...publicSettings(acc, data.settings) };
	return json({
		account: { slug: acc.slug, title: acc.title, theme: acc.theme, status: acc.status, expires_at: acc.expires_at },
		...data,
		settings,
		themes
	});
};

/**
 * PUT /api/admin/content — perbarui konten undangan.
 * Body: { couple?, events?, gallery?, gifts?, settings?, account? }
 * Strategi: replace-all untuk list (events/gallery/gifts/couple).
 *
 * Logika inti ada di `applyContent()` (`$lib/server/content`) agar dipakai
 * bersama oleh endpoint impor (fase F2/F3) — validasi satu sumber.
 */
export const PUT: RequestHandler = async (event) => {
	const acc = await requireAccountAdmin(event);
	enforceRate('admin-write', event, 60_000, 30);
	const b = await event.request.json().catch(() => ({}));

	const result = await applyContent(acc.id, b, { mode: 'overwrite' });
	return json({ ok: true, written: result.written });
};
