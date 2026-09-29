import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { run, one } from '$lib/server/db';
import { requireAccountAdmin, enforceRate } from '$lib/server/auth';
import { clampStr, clampInt, isSafeUrl, LIMITS } from '$lib/server/util';
import { getInvitationData, getCustomThemes, publicSettings } from '$lib/server/invitation';

/** GET /api/admin/content — seluruh konten account (untuk panel admin). */
export const GET: RequestHandler = async (event) => {
	const acc = await requireAccountAdmin(event);
	const data = await getInvitationData(acc);
	const themes = await getCustomThemes(acc.id);
	return json({
		account: { slug: acc.slug, title: acc.title, theme: acc.theme, status: acc.status, expires_at: acc.expires_at },
		...data,
		settings: { ...publicSettings(acc, data.settings) },
		themes
	});
};

/**
 * PUT /api/admin/content — perbarui konten undangan.
 * Body: { couple?, events?, gallery?, gifts?, settings?, account? }
 * Strategi: replace-all untuk list (events/gallery/gifts/couple) — sederhana & aman.
 */
export const PUT: RequestHandler = async (event) => {
	const acc = await requireAccountAdmin(event);
	enforceRate('admin-write', event, 60_000, 30);
	const b = await event.request.json().catch(() => ({}));
	const id = acc.id;

	// -- Judul undangan / tema (account) --
	if (b.account) {
		const title = clampStr(b.account.title, LIMITS.medium);
		const theme = clampStr(b.account.theme, 60) || acc.theme;
		await run('UPDATE accounts SET title = $1, theme = $2 WHERE id = $3', [title, theme, id]);
	}

	// -- Ganti password admin (opsional) --
	if (b.admin_password) {
		const pw = String(b.admin_password).slice(0, 100);
		if (pw.length >= 5) {
			const { hashPassword } = await import('$lib/server/security');
			await run('UPDATE accounts SET password_hash = $1 WHERE id = $2', [hashPassword(pw), id]);
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
		const existing = await one('SELECT id FROM couple WHERE account_id = $1', [id]);
		if (existing) {
			await run(
				`UPDATE couple SET groom_name=$1, groom_full=$2, groom_ig=$3, groom_photo=$4, groom_parents=$5,
				 bride_name=$6, bride_full=$7, bride_ig=$8, bride_photo=$9, bride_parents=$10, love_story=$11
				 WHERE account_id=$12`,
				[...Object.values(fields), id]
			);
		} else {
			await run(
				`INSERT INTO couple (account_id, groom_name, groom_full, groom_ig, groom_photo, groom_parents,
				 bride_name, bride_full, bride_ig, bride_photo, bride_parents, love_story)
				 VALUES ($12,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
				[...Object.values(fields), id]
			);
		}
	}

	// -- Events (replace-all) --
	if (Array.isArray(b.events)) {
		await run('DELETE FROM events WHERE account_id = $1', [id]);
		let i = 0;
		for (const e of b.events) {
			await run(
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
	}

	// -- Gallery (replace-all) --
	if (Array.isArray(b.gallery)) {
		await run('DELETE FROM gallery WHERE account_id = $1', [id]);
		let i = 0;
		for (const g of b.gallery) {
			const url = isSafeUrl(g.url) ? clampStr(g.url, LIMITS.url) : '';
			if (!url) continue;
			await run('INSERT INTO gallery (account_id, url, caption, sort) VALUES ($1,$2,$3,$4)', [
				id,
				url,
				clampStr(g.caption, LIMITS.medium),
				i++
			]);
		}
	}

	// -- Gifts (replace-all) --
	if (Array.isArray(b.gifts)) {
		await run('DELETE FROM gifts WHERE account_id = $1', [id]);
		let i = 0;
		for (const g of b.gifts) {
			await run(
				`INSERT INTO gifts (account_id, type, bank_name, account_no, account_name, sort)
				 VALUES ($1,$2,$3,$4,$5,$6)`,
				[
					id,
					clampStr(g.type, 40),
					clampStr(g.bank_name, LIMITS.medium),
					clampStr(g.account_no, LIMITS.short),
					clampStr(g.account_name, LIMITS.medium),
					i++
				]
			);
		}
	}

	// -- Settings (upsert per key) --
	if (b.settings && typeof b.settings === 'object') {
		const allowed = new Set([
			'music_url', 'quote', 'video_url', 'live_url', 'live_text',
			'qris_image', 'gift_address', 'gift_enabled',
			'watermark_text', 'watermark_enabled',
			'background_image', 'background_image_mobile', 'background_overlay',
			'background_overlay_opacity', 'background_position', 'background_size',
			'background_repeat', 'background_attachment',
			'background_position_mobile', 'background_size_mobile', 'background_repeat_mobile'
		]);
		for (const [k, v] of Object.entries(b.settings)) {
			if (!allowed.has(k)) continue;
			let val = String(v ?? '').slice(0, 1000);
			if (k.includes('url') || k.includes('image') || k === 'qris_image') {
				if (val && !isSafeUrl(val)) val = '';
			}
			if (k === 'background_overlay_opacity') {
				const n = Number(val);
				val = Number.isFinite(n) ? String(Math.max(0, Math.min(1, n))) : '';
			}
			await run(
				`INSERT INTO settings (account_id, key, value) VALUES ($1,$2,$3)
				 ON CONFLICT (account_id, key) DO UPDATE SET value = EXCLUDED.value`,
				[id, k, val]
			);
		}
	}

	return json({ ok: true });
};
