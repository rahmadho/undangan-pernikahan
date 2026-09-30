<script lang="ts">
	import { onMount } from 'svelte';
	import type { CustomTheme } from '$lib/types';
	import {
		EFFECT_INTENSITY_OPTIONS,
		REVEAL_STYLE_OPTIONS,
		SECTION_TRANSITION_OPTIONS,
		PHOTO_FILTER_OPTIONS,
		GRADIENT_STYLE_OPTIONS,
		GRADIENT_TARGET_OPTIONS,
		GRADIENT_PALETTE_OPTIONS
	} from '$lib/types';
	import { DECO_ASSETS, decoAssetUrl } from '$lib/decoAssets';
	import { BUNDLE_PRESETS } from '$lib/bundles';

	let { data }: { data: { slug: string } } = $props();
	const slug = $derived(data.slug);

	let ready = $state(false);
	let authed = $state(false);
	let password = $state('');
	let loginErr = $state('');
	let loading = $state(false);

	let tab = $state('dashboard');
	let toast = $state('');
	let content = $state<any>(null);
	let rsvp = $state<{ stats: any; rows: any[] }>({ stats: null, rows: [] });
	let guests = $state<any[]>([]);
	let themes = $state<CustomTheme[]>([]);

	// form konten (bisa diedit)
	let couple = $state<any>({});
	let events = $state<any[]>([]);
	let gallery = $state<any[]>([]);
	let gifts = $state<any[]>([]);
	let settings = $state<Record<string, string>>({});
	let accountTitle = $state('');

	// customizer tema
	const TOKENS = [
		{ k: '--cream', l: 'Latar' },
		{ k: '--cream-2', l: 'Latar 2' },
		{ k: '--surface', l: 'Kartu' },
		{ k: '--sage', l: 'Aksen' },
		{ k: '--sage-dark', l: 'Aksen Gelap' },
		{ k: '--gold', l: 'Emas' },
		{ k: '--ink', l: 'Teks' },
		{ k: '--ink-soft', l: 'Teks Lembut' }
	];
	const FONTS_SERIF = ['Cormorant Garamond', 'Playfair Display', 'Lora', 'Marcellus', 'Space Grotesk'];
	const FONTS_SCRIPT = ['Great Vibes', 'Italianno', 'Pinyon Script', 'Tangerine', 'Plus Jakarta Sans'];
	let czTokens = $state<Record<string, string>>({});
	let czName = $state('');
	let czBase = $state('botanical');
	let editingThemeId = $state<number | null>(null);

	const THEMES = [
		'botanical', 'midnight', 'blush', 'javanese', 'minimal', 'baroque',
		'adat-minang', 'adat-jawa', 'rustic-terracotta', 'emerald-luxury',
		'rose-gold', 'dusty-blue', 'sakura'
	];
	// Label ramah untuk tema (terutama adat)
	const THEME_LABELS: Record<string, string> = {
		botanical: 'Botanical', midnight: 'Midnight', blush: 'Blush',
		javanese: 'Javanese', minimal: 'Minimal', baroque: 'Baroque',
		'adat-minang': 'Adat Minang', 'adat-jawa': 'Adat Jawa',
		'rustic-terracotta': 'Rustic Terracotta', 'emerald-luxury': 'Emerald Luxury',
		'rose-gold': 'Rose Gold', 'dusty-blue': 'Dusty Blue', sakura: 'Sakura'
	};
	/** Ubah slug internal (mis. 'teal-svelte') jadi label yang enak dibaca. */
	function humanizeSlug(s: string): string {
		return s
			.split(/[-_]+/)
			.filter(Boolean)
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ');
	}
	/**
	 * Label tampilan untuk sebuah tema. Urutan: label preset → nama tema kustom
	 * (via `themes`) → slug yang di-humanize. Ini mencegah slug internal seperti
	 * 'teal-svelte' bocor ke UI saat tema kustom aktif.
	 */
	function themeLabel(theme: string): string {
		if (!theme) return '—';
		if (THEME_LABELS[theme]) return THEME_LABELS[theme];
		const custom = themes.find((t) => t.slug === theme);
		if (custom?.name) return custom.name;
		return humanizeSlug(theme);
	}
	/** Judul ramah untuk account — jatuh ke slug (identitas akun) bila judul belum diisi. */
	const displayTitle = $derived(accountTitle || slug || 'Undangan');
	// Opsi foto cover & dekorasi
	const COVER_MODES = [
		{ v: 'plain', l: 'Bundar sederhana' },
		{ v: 'frame', l: 'Bingkai kartu' },
		{ v: 'shadow', l: 'Tanpa bingkai + bayangan' },
		{ v: 'polaroid', l: 'Polaroid' },
		{ v: 'arch', l: 'Lengkung (arch)' },
		{ v: 'circle', l: 'Lingkaran emas' },
		{ v: 'none', l: 'Tanpa foto' }
	];
	const DECORATIONS = [
		{ v: 'floral', l: 'Floral klasik' },
		{ v: 'leaves-sway', l: 'Sulur daun' },
		{ v: 'ethnic-jawa', l: 'Batik Jawa' },
		{ v: 'ethnic-minang', l: 'Songket Minang' },
		{ v: 'none', l: 'Tanpa dekorasi' }
	];
	// Dekorasi aset file lokal (opsional, ADDITIF — tidak mengganti Ornament).
	const DECO_SLOT_OPTIONS = [
		{ v: 'both', l: 'Cover & isi' },
		{ v: 'cover', l: 'Hanya cover' },
		{ v: 'hero', l: 'Hanya bagian isi' }
	];
	const BG_POS = ['center center', 'top center', 'bottom center', 'center left', 'center right', 'top left', 'top right', 'bottom left', 'bottom right'];
	const BG_SIZE = ['cover', 'contain', 'auto', '100% 100%'];
	const BG_REPEAT = ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'];
	const BG_ATTACH = ['scroll', 'fixed'];

	const tabs = [
		{ id: 'dashboard', label: 'Dasbor' },
		{ id: 'impor', label: 'Impor' },
		{ id: 'konten', label: 'Konten' },
		{ id: 'tampilan', label: 'Tampilan' },
		{ id: 'tema', label: 'Tema' },
		{ id: 'tamu', label: 'Tamu' },
		{ id: 'rsvp', label: 'RSVP' },
		{ id: 'ucapan', label: 'Ucapan' },
		{ id: 'pengaturan', label: 'Pengaturan' }
	];

	// ---------- Auth ----------
	onMount(async () => {
		const saved = localStorage.getItem('wedding.admin');
		if (saved) {
			try {
				const c = JSON.parse(saved);
				if (c.slug === slug) {
					password = c.password;
					await doLogin(true);
				}
			} catch {}
		}
		ready = true;
	});

	async function doLogin(silent = false) {
		loginErr = '';
		loading = true;
		try {
			const r = await fetch('/api/admin/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ slug, password })
			});
			const j = await r.json();
			if (!r.ok) {
				if (!silent) loginErr = j.message || 'Login gagal.';
				localStorage.removeItem('wedding.admin');
				return;
			}
			localStorage.setItem('wedding.admin', JSON.stringify({ slug, password }));
			// Muat SEMUA data dulu, baru tandai authed. Kalau authed diset lebih
			// dulu, Svelte langsung me-render dashboard saat `content` masih null
			// → `content.account.theme` melempar TypeError dan panel tak muncul
			// sampai hard reload. Jadi urutannya penting.
			await loadAll();
			authed = true;
		} catch {
			if (!silent) loginErr = 'Tidak dapat menghubungi server.';
		} finally {
			loading = false;
		}
	}

	function logout() {
		localStorage.removeItem('wedding.admin');
		authed = false;
	}

	// ---------- API helper ----------
	function headers() {
		return { 'x-account': slug, 'x-admin-password': password, 'Content-Type': 'application/json' };
	}
	async function getJson(path: string) {
		const r = await fetch(path, { headers: headers() });
		if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Gagal memuat.');
		return r.json();
	}
	async function send(path: string, method: string, body?: any) {
		const r = await fetch(path, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
		if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Gagal menyimpan.');
		return r.json();
	}

	function showToast(msg: string) {
		toast = msg;
		setTimeout(() => (toast = ''), 2600);
	}

	async function loadAll() {
		content = await getJson('/api/admin/content');
		couple = { ...(content.couple || {}) };
		events = (content.events || []).map((e: any) => ({ ...e }));
		gallery = (content.gallery || []).map((g: any) => ({ ...g }));
		gifts = (content.gifts || []).map((g: any) => ({ ...g }));
		settings = { ...(content.settings || {}) };
		accountTitle = content.account?.title || '';
		themes = content.themes || [];
		await Promise.all([loadGuests(), loadRsvp(), loadWishes()]);
	}
	async function loadGuests() {
		guests = await getJson('/api/admin/guests');
	}
	async function loadRsvp() {
		rsvp = await getJson('/api/admin/rsvp');
	}

	// ---------- Simpan ----------
	async function saveContent() {
		loading = true;
		try {
			await send('/api/admin/content', 'PUT', {
				account: { title: accountTitle, theme: content.account.theme },
				couple,
				events,
				gallery,
				gifts,
				settings
			});
			showToast('Perubahan disimpan ✓');
			content = await getJson('/api/admin/content');
		} catch (e) {
			showToast((e as Error).message);
		} finally {
			loading = false;
		}
	}

	async function setTheme(t: string) {
		content.account.theme = t;
		await send('/api/admin/content', 'PUT', { account: { title: accountTitle, theme: t } });
		showToast('Tema diterapkan: ' + t);
	}

	/**
	 * Terapkan BUNDLE PRESET: tema + ornamen + bingkai foto + dekorasi sekaligus.
	 * Dilakukan di server (endpoint khusus) agar nilai bundle divalidasi ulang
	 * dan tersimpan atomik. Setelah sukses, muat ulang konten agar form admin
	 * (Tampilan) menampilkan nilai baru.
	 */
	async function applyBundle(theme: string) {
		loading = true;
		try {
			await send('/api/admin/themes/bundle', 'POST', { theme });
			content = await getJson('/api/admin/content');
			couple = { ...(content.couple || {}) };
			events = (content.events || []).map((e: any) => ({ ...e }));
			gallery = (content.gallery || []).map((g: any) => ({ ...g }));
			gifts = (content.gifts || []).map((g: any) => ({ ...g }));
			settings = { ...(content.settings || {}) };
			showToast('Bundle diterapkan: ' + theme + ' ✓');
		} catch (e) {
			showToast((e as Error).message);
		} finally {
			loading = false;
		}
	}

	// ---------- Upload ----------
	async function uploadFile(file: File, kind: 'audio' | 'image'): Promise<string | null> {
		const fd = new FormData();
		fd.append('file', file);
		const r = await fetch(`/api/admin/upload?kind=${kind}`, {
			method: 'POST',
			headers: { 'x-account': slug, 'x-admin-password': password },
			body: fd
		});
		const j = await r.json();
		if (!r.ok) {
			showToast(j.message || 'Upload gagal.');
			return null;
		}
		return j.url;
	}

	async function onMusicUpload(e: Event) {
		const f = (e.target as HTMLInputElement).files?.[0];
		if (!f) return;
		const url = await uploadFile(f, 'audio');
		if (url) {
			settings.music_url = url;
			showToast('Musik diunggah ✓');
		}
	}

	async function onBgUpload(e: Event, key: string) {
		const f = (e.target as HTMLInputElement).files?.[0];
		if (!f) return;
		const url = await uploadFile(f, 'image');
		if (url) {
			settings[key] = url;
			showToast('Latar diunggah ✓');
		}
	}

	/** Buka dialog pilih file lalu unggah sebagai foto cover. */
	function pickCoverUpload() {
		const inp = document.createElement('input');
		inp.type = 'file';
		inp.accept = 'image/*';
		inp.onchange = async () => {
			const f = inp.files?.[0];
			if (!f) return;
			const url = await uploadFile(f, 'image');
			if (url) {
				settings.cover_photo = url;
				showToast('Foto cover diunggah ✓');
			}
		};
		inp.click();
	}

	async function onQrisUpload(e: Event) {
		const f = (e.target as HTMLInputElement).files?.[0];
		if (!f) return;
		const url = await uploadFile(f, 'image');
		if (url) {
			settings.qris_image = url;
			showToast('QRIS diunggah ✓');
		}
	}

	async function onGalleryUpload(e: Event) {
		const files = (e.target as HTMLInputElement).files;
		if (!files) return;
		for (const f of Array.from(files)) {
			const url = await uploadFile(f, 'image');
			if (url) gallery = [...gallery, { url, caption: '' }];
		}
		showToast('Galeri diperbarui');
	}

	// ---------- List editor ----------
	function addEvent() {
		events = [...events, { key: 'acara', title: '', date_iso: '', time_text: '', venue: '', address: '', maps_url: '' }];
	}
	function delEvent(i: number) {
		events = events.filter((_, x) => x !== i);
	}
	function addGift() {
		gifts = [...gifts, { type: 'bank', bank_name: '', account_no: '', account_name: '' }];
	}
	function delGift(i: number) {
		gifts = gifts.filter((_, x) => x !== i);
	}
	function delGallery(i: number) {
		gallery = gallery.filter((_, x) => x !== i);
	}

	// ---------- Efek premium ----------
	// Sumber nilai = `$lib/types` (label/hint/icon), agar panel admin dan
	// halaman tamu tidak pernah berbeda. Kunci settings mengikuti whitelist
	// server (`server/content.ts` + `server/invitation.ts`):
	//   effects_enabled / effects_parallax / effects_kenburns            → '1'|'0'
	//   effects_transition_enabled + effects_transition                  → none|wave|fade|curve
	//   effects_photo_filter_enabled + effects_photo_filter              → none|warm|…
	//   effects_reveal → fade-up|fade|zoom|flip|slide|blur
	//   effects_intensity → subtle|medium|bold
	const FX_INTENSITY = EFFECT_INTENSITY_OPTIONS.map((o) => ({ v: o.value, l: o.label, hint: o.hint }));
	const FX_REVEAL = REVEAL_STYLE_OPTIONS.map((o) => ({ v: o.value, l: o.label, hint: o.hint }));
	const FX_TRANSITION = SECTION_TRANSITION_OPTIONS.map((o) => ({ v: o.value, l: o.label, hint: o.hint }));
	const FX_FILTERS = PHOTO_FILTER_OPTIONS.map((o) => ({ v: o.value, l: o.label, hint: o.hint }));

	// ---------- Gradasi Premium ----------
	// Sumber nilai = `$lib/types` (label/hint/icon), agar panel admin dan halaman
	// tamu tidak pernah berbeda. Kunci settings mengikuti whitelist server
	// (`server/content.ts` + `server/invitation.ts`):
	//   gradient_enabled   → '1'|'0'  (saklar utama)
	//   gradient_style     → none|luluh|vignette|glow|overlay
	//   gradient_intensity → subtle|medium|bold
	//   gradient_target    → cover|hero|both
	//   gradient_palette   → auto|custom
	//   gradient_color     → hex #rgb / #rrggbb (saat palette = custom)
	const GR_STYLES = GRADIENT_STYLE_OPTIONS.map((o) => ({ v: o.value, l: o.label, hint: o.hint, icon: o.icon }));
	const GR_TARGETS = GRADIENT_TARGET_OPTIONS.map((o) => ({ v: o.value, l: o.label, hint: o.hint, icon: o.icon }));
	const GR_PALETTES = GRADIENT_PALETTE_OPTIONS.map((o) => ({ v: o.value, l: o.label, hint: o.hint, icon: o.icon }));

	/** Setel ulang seluruh gradasi premium ke nilai default aman (nonaktif). */
	function resetGradient() {
		settings.gradient_enabled = '0';
		settings.gradient_style = 'none';
		settings.gradient_intensity = 'medium';
		settings.gradient_target = 'both';
		settings.gradient_palette = 'auto';
		settings.gradient_color = '';
		showToast('Gradasi premium disetel ulang');
	}

	/** Setel ulang seluruh efek premium ke nilai default aman (nonaktif). */
	function resetEffects() {
		settings.effects_enabled = '0';
		settings.effects_parallax = '0';
		settings.effects_kenburns = '0';
		settings.effects_transition_enabled = '0';
		settings.effects_photo_filter_enabled = '0';
		settings.effects_transition = 'none';
		settings.effects_reveal = 'fade-up';
		settings.effects_intensity = 'medium';
		settings.effects_photo_filter = 'none';
		showToast('Efek premium disetel ulang');
	}

	// ---------- Tutu tamu ----------
	let gName = $state('');
	let gPhone = $state('');
	let gCat = $state('');
	let gQuota = $state(2);
	let newGalleryUrl = $state('');
	let wishes = $state<any[]>([]);
	let newAdminPw = $state('');

	async function loadWishes() {
		wishes = await getJson('/api/admin/wishes');
	}
	async function delWish(id: number) {
		await send('/api/admin/wishes?id=' + id, 'DELETE');
		await loadWishes();
		showToast('Ucapan dihapus');
	}
	function exportCsv(type: string) {
		// Unduh via fetch agar header auth ikut terkirim.
		fetch(`/api/admin/export/${type}.csv`, { headers: headers() })
			.then((r) => r.blob())
			.then((b) => {
				const a = document.createElement('a');
				a.href = URL.createObjectURL(b);
				a.download = `${slug}-${type}.csv`;
				a.click();
			});
	}
	async function changeAdminPw() {
		if (newAdminPw.length < 5) {
			showToast('Password minimal 5 karakter.');
			return;
		}
		await send('/api/admin/content', 'PUT', { admin_password: newAdminPw });
		showToast('Password admin diubah ✓');
		newAdminPw = '';
	}
	async function addGuest() {
		if (!gName.trim()) return;
		try {
			await send('/api/admin/guests', 'POST', { name: gName, phone: gPhone, category: gCat, quota: gQuota });
			gName = '';
			gPhone = '';
			gCat = '';
			gQuota = 2;
			await loadGuests();
			showToast('Tamu ditambahkan ✓');
		} catch (e) {
			showToast((e as Error).message);
		}
	}
	async function delGuest(id: number) {
		await send('/api/admin/guests?id=' + id, 'DELETE');
		await loadGuests();
		showToast('Tamu dihapus');
	}
	function guestLink(g: any) {
		return `${location.origin}/u/${slug}?to=${g.slug}`;
	}
	function copyLink(g: any) {
		navigator.clipboard?.writeText(guestLink(g));
		showToast('Link disalin ✓');
	}

	// ---------- Tema kustom ----------
	function fillCustomizer(t?: CustomTheme) {
		if (t) {
			editingThemeId = t.id;
			czName = t.name;
			czBase = t.base;
			czTokens = { ...t.tokens };
		} else {
			editingThemeId = null;
			czName = 'Tema Baru';
			czBase = 'botanical';
			czTokens = {};
		}
	}
	async function saveTheme() {
		try {
			if (editingThemeId) {
				await send('/api/admin/themes', 'PUT', { id: editingThemeId, name: czName, base: czBase, tokens: czTokens });
			} else {
				await send('/api/admin/themes', 'POST', { name: czName, base: czBase, tokens: czTokens });
			}
			themes = await getJson('/api/admin/themes');
			editingThemeId = null;
			showToast('Tema disimpan ✓');
		} catch (e) {
			showToast((e as Error).message);
		}
	}
	async function useTheme(slugTheme: string) {
		await setTheme(slugTheme);
	}
	async function delTheme(id: number) {
		await send('/api/admin/themes?id=' + id, 'DELETE');
		themes = await getJson('/api/admin/themes');
		showToast('Tema dihapus');
	}

	// ---------- Impor JSON (Elementor/Landingstar) ----------
	// Alur: unggah/tempel → POST /import/preview (tanpa tulis) → koreksi di UI
	// → POST /import/apply (validasi ulang di server) → muat ulang konten.
	let importRaw = $state('');            // teks JSON yang ditempel
	let importFileName = $state('');       // nama berkas yang diunggah (info saja)
	let importDraft = $state<any>(null);   // ImportDraft hasil pratinjau (bisa dikoreksi)
	let importMode = $state<'fill-empty' | 'overwrite'>('fill-empty');
	let importImageMode = $state<'link' | 'download'>('link');
	let importBusy = $state(false);
	let importApplied = $state<any>(null); // ringkasan hasil apply (toast besar)

	/** Apakah pratinjau sudah berhasil dimuat. */
	const hasDraft = $derived(!!importDraft);

	/** Badge status untuk satu entri laporan. */
	function statusMeta(s: string): { icon: string; cls: string; label: string } {
		switch (s) {
			case 'ok': return { icon: '✅', cls: 'st-ok', label: 'OK' };
			case 'review': return { icon: '⚠️', cls: 'st-review', label: 'Perlu review' };
			case 'skipped': return { icon: '⏭️', cls: 'st-skip', label: 'Dilewati' };
			case 'error': return { icon: '⛔', cls: 'st-error', label: 'Gagal' };
			default: return { icon: '•', cls: '', label: s };
		}
	}

	/** Ringkasan jumlah gambar per sumber (untuk pratinjau). */
	const importImageKinds = $derived.by(() => {
		const imgs: any[] = importDraft?.images ?? [];
		return {
			total: imgs.length,
			remote: imgs.filter((i) => i.source === 'remote').length,
			local: imgs.filter((i) => i.source === 'local').length
		};
	});

	/** Baca berkas .json yang dipilih lewat <input type=file>. */
	async function onImportFile(e: Event) {
		const f = (e.target as HTMLInputElement).files?.[0];
		if (!f) return;
		if (f.size > 2 * 1024 * 1024) {
			showToast('Ukuran berkas melebihi 2 MB.');
			return;
		}
		importFileName = f.name;
		importRaw = await f.text();
		// Reset pratinjau lama bila isi sumber berubah.
		importDraft = null;
		importApplied = null;
	}

	/** Kirim JSON ke /import/preview (baca-saja) lalu simpan draf. */
	async function previewImport() {
		const text = importRaw.trim();
		if (!text) {
			showToast('Tempel atau unggah JSON ekspor Elementor dulu.');
			return;
		}
		// Validasi JSON di klien dulu → pesan ramah sebelum hit server.
		try {
			JSON.parse(text);
		} catch {
			showToast('JSON tidak valid: periksa tanda kurung/koma.');
			return;
		}
		importBusy = true;
		importApplied = null;
		try {
			const r = await fetch('/api/admin/import/preview', {
				method: 'POST',
				headers: headers(),
				body: JSON.stringify({ json: text })
			});
			const j = await r.json().catch(() => ({}));
			if (!r.ok) throw new Error(j.message || 'Pratinjau gagal.');
			importDraft = j.draft;
			showToast(`Pratinjau siap: ${importDraft.report?.templateTitle || 'template'} ✓`);
		} catch (e) {
			importDraft = null;
			showToast((e as Error).message);
		} finally {
			importBusy = false;
		}
	}

	/** Tambah/hapus item galeri pada draf pratinjau. */
	function addDraftGallery() {
		if (!importDraft) return;
		importDraft.gallery = [...(importDraft.gallery ?? []), { url: '', caption: '' }];
	}
	function delDraftGallery(i: number) {
		if (!importDraft) return;
		importDraft.gallery = importDraft.gallery.filter((_: any, x: number) => x !== i);
	}
	function addDraftEvent() {
		if (!importDraft) return;
		importDraft.events = [
			...(importDraft.events ?? []),
			{ key: 'acara', title: '', date_iso: '', time_text: '', venue: '', address: '', maps_url: '' }
		];
	}
	function delDraftEvent(i: number) {
		if (!importDraft) return;
		importDraft.events = importDraft.events.filter((_: any, x: number) => x !== i);
	}

	/** Terapkan draf (yang mungkin sudah dikoreksi) ke konten account. */
	async function applyImport() {
		if (!importDraft) return;
		if (
			importMode === 'overwrite' &&
			!confirm('Mode TIMPA akan mengganti data konten yang sudah ada. Lanjutkan?')
		) {
			return;
		}
		importBusy = true;
		try {
			const r = await fetch('/api/admin/import/apply', {
				method: 'POST',
				headers: headers(),
				body: JSON.stringify({
					draft: importDraft,
					mode: importMode,
					imageMode: importImageMode,
					account: { title: accountTitle }
				})
			});
			const j = await r.json().catch(() => ({}));
			if (!r.ok) throw new Error(j.message || 'Gagal menerapkan impor.');
			importApplied = j;
			// Muat ulang konten agar tab Konten/Tampilan menampilkan hasil impor.
			await loadAll();
			const skipped = (j.skippedExisting ?? []).length;
			showToast(`Impor diterapkan: ${j.applied?.written ?? 0} field ditulis${skipped ? `, ${skipped} dilewati` : ''} ✓`);
		} catch (e) {
			showToast((e as Error).message);
		} finally {
			importBusy = false;
		}
	}

	function resetImport() {
		importRaw = '';
		importFileName = '';
		importDraft = null;
		importApplied = null;
		importMode = 'fill-empty';
		importImageMode = 'link';
	}
</script>

<svelte:head><title>{displayTitle} — Meja Kerja</title></svelte:head>

{#if toast}
	<div class="toast" role="status" aria-live="polite">{toast}</div>
{/if}

{#if !ready}
	<div class="boot">
		<span class="boot-mark" aria-hidden="true"></span>
		<p>Menyiapkan meja kerja…</p>
	</div>
{:else if !authed}
	<!-- ================= GERBANG MASUK ================= -->
	<div class="gate">
		<div class="gate-aside" aria-hidden="true">
			<span class="gate-rule"></span>
			<p class="gate-word">Meja Kerja</p>
			<p class="gate-sub">Perakitan Undangan</p>
		</div>
		<form class="gate-form" onsubmit={(e) => { e.preventDefault(); doLogin(); }}>
			<p class="eyebrow">Panel Pengantin</p>
			<h1>Masuk ke meja kerja</h1>
			<p class="gate-hint">Kelola isi, tampilan, tamu, dan RSVP undangan <strong>{displayTitle}</strong> dari satu tempat.</p>
			<label for="pw">Kata sandi admin</label>
			<div class="pw-row">
				<input
					id="pw"
					type="password"
					bind:value={password}
					placeholder="••••••••"
					autocomplete="current-password"
					onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doLogin(); } }}
				/>
				<button type="button" class="btn" disabled={loading} onclick={() => doLogin()}>{loading ? 'Membuka…' : 'Masuk'}</button>
			</div>
			{#if loginErr}<p class="err" role="alert">{loginErr}</p>{/if}
			<a class="quiet-link" href={`/u/${slug}`}>Lihat undangan tamu →</a>
		</form>
	</div>
{:else if !content}
	<div class="boot">
		<span class="boot-mark" aria-hidden="true"></span>
		<p>Memuat data undangan…</p>
	</div>
{:else}
	<!-- ================= MEJA KERJA ================= -->
	<div class="bench">
		<header class="rail">
			<div class="rail-brand">
				<span class="rail-mark" aria-hidden="true">M</span>
				<div>
					<strong>{displayTitle}</strong>
					<span class="rail-slug">/{slug}</span>
				</div>
			</div>

			<nav class="rail-tabs" aria-label="Bagian meja kerja">
				{#each tabs as t, i}
					<button
						class:on={tab === t.id}
						aria-current={tab === t.id ? 'page' : undefined}
						onclick={() => (tab = t.id)}
					>
						<span class="tab-no" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
						<span class="tab-label">{t.label}</span>
					</button>
				{/each}
			</nav>

			<div class="rail-foot">
				<div class="rail-theme">
					<span class="swatch" data-t={content.account.theme}></span>
					<span class="rail-theme-txt">{themeLabel(content.account.theme)}</span>
				</div>
				<div class="rail-acts">
					<a class="ghost" href={`/u/${slug}`} target="_blank">Pratinjau undangan</a>
					<button class="ghost" onclick={logout}>Keluar</button>
				</div>
			</div>
		</header>

		<div class="surface">
			<div class="surface-head">
				<div class="surface-title">
					<p class="eyebrow">{tabs.find((x) => x.id === tab)?.label}</p>
					<h1>{displayTitle}</h1>
				</div>
				<button class="ghost compact" onclick={logout}>Keluar</button>
			</div>

			<main class="board">
				{#if tab === 'dashboard'}
					<div class="stats">
						<div class="stat"><strong>{rsvp.stats?.total ?? 0}</strong><span>Total RSVP</span></div>
						<div class="stat"><strong>{rsvp.stats?.hadir ?? 0}</strong><span>Konfirmasi hadir</span></div>
						<div class="stat"><strong>{rsvp.stats?.total_pax ?? 0}</strong><span>Perkiraan orang</span></div>
						<div class="stat"><strong>{guests.length}</strong><span>Nama di daftar tamu</span></div>
					</div>
					<section class="card intro">
						<div class="card-body">
							<h2>Rakit undangan Anda</h2>
							<p class="lede">Isi yang tertulis di sini langsung tampil di undangan tamu. Mulai dari isi, atur tampilan, lalu bagikan tautan ke daftar tamu.</p>
							<div class="acts">
								<button class="btn" onclick={() => (tab = 'konten')}>Edit isi undangan</button>
								<button class="ghost" onclick={() => (tab = 'tampilan')}>Atur tampilan</button>
							</div>
						</div>
					</section>
				{:else if tab === 'konten'}
					<section class="card">
						<div class="card-head"><h2>Judul undangan</h2></div>
						<div class="card-body">
							<p class="hint">Tampil sebagai nama utama di halaman pembuka.</p>
							<label for="title">Judul</label>
							<input id="title" bind:value={accountTitle} placeholder="Mis. Rizky & Amelia" />
						</div>
					</section>

					<section class="card">
						<div class="card-head"><h2>Mempelai</h2></div>
						<div class="card-body">
							<div class="grid2">
								<fieldset class="panel">
									<legend>Mempelai pria</legend>
									<label for="gn">Nama panggilan</label>
									<input id="gn" bind:value={couple.groom_name} />
									<label for="gf">Nama lengkap & gelar</label>
									<input id="gf" bind:value={couple.groom_full} />
									<label for="gi">Instagram (tanpa @)</label>
									<input id="gi" bind:value={couple.groom_ig} />
									<label for="gp">Foto (URL)</label>
									<input id="gp" bind:value={couple.groom_photo} placeholder="https://…" />
									<label for="gpa">Orang tua</label>
									<input id="gpa" bind:value={couple.groom_parents} />
								</fieldset>
								<fieldset class="panel">
									<legend>Mempelai wanita</legend>
									<label for="bn">Nama panggilan</label>
									<input id="bn" bind:value={couple.bride_name} />
									<label for="bf">Nama lengkap & gelar</label>
									<input id="bf" bind:value={couple.bride_full} />
									<label for="bi">Instagram (tanpa @)</label>
									<input id="bi" bind:value={couple.bride_ig} />
									<label for="bp">Foto (URL)</label>
									<input id="bp" bind:value={couple.bride_photo} placeholder="https://…" />
									<label for="bpa">Orang tua</label>
									<input id="bpa" bind:value={couple.bride_parents} />
								</fieldset>
							</div>
							<label for="ls">Cerita cinta</label>
							<textarea id="ls" rows="4" bind:value={couple.love_story}></textarea>
						</div>
					</section>

					<section class="card">
						<div class="card-head">
							<h2>Acara</h2>
							<button class="ghost sm" onclick={addEvent}>+ Tambah acara</button>
						</div>
						<div class="card-body">
							{#each events as e, i}
								<div class="item">
									<span class="item-no" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
									<div class="item-fields">
										<div class="grid2">
											<input bind:value={e.title} placeholder="Judul (Akad/Resepsi)" />
											<input bind:value={e.key} placeholder="Kunci (akad/resepsi)" />
										</div>
										<div class="grid2">
											<input type="datetime-local" bind:value={e.date_iso} />
											<input bind:value={e.time_text} placeholder="Pukul 08.00 - 10.00 WIB" />
										</div>
										<input bind:value={e.venue} placeholder="Nama tempat" />
										<input bind:value={e.address} placeholder="Alamat" />
										<input bind:value={e.maps_url} placeholder="Google Maps URL" />
										<div class="row end">
											<button class="danger sm" onclick={() => delEvent(i)}>Hapus acara</button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</section>

					<section class="card">
						<div class="card-head"><h2>Galeri</h2></div>
						<div class="card-body">
							<label for="gfile">Unggah foto</label>
							<input id="gfile" type="file" accept="image/*" multiple onchange={onGalleryUpload} />
							<div class="gallery-edit">
								{#each gallery as g, i}
									<div class="g-thumb">
										<img src={g.url} alt="" />
										<input bind:value={g.caption} placeholder="Keterangan" />
										<button class="danger sm" onclick={() => delGallery(i)}>×</button>
									</div>
								{/each}
							</div>
							<label for="gurl">Atau tambah via URL</label>
							<div class="row">
								<input id="gurl" placeholder="https://…" bind:value={newGalleryUrl} />
								<button class="ghost sm" onclick={() => { if (newGalleryUrl) { gallery = [...gallery, { url: newGalleryUrl, caption: '' }]; newGalleryUrl = ''; } }}>Tambah</button>
							</div>
						</div>
					</section>

					<section class="card">
						<div class="card-head">
							<h2>Amplop digital</h2>
							<button class="ghost sm" onclick={addGift}>+ Tambah</button>
						</div>
						<div class="card-body">
							{#each gifts as g, i}
								<div class="item">
									<span class="item-no" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
									<div class="item-fields">
										<div class="grid2">
											<select bind:value={g.type}><option value="bank">Bank</option><option value="ewallet">E-Wallet</option></select>
											<input bind:value={g.bank_name} placeholder="Nama bank / e-wallet" />
										</div>
										<div class="grid2">
											<input bind:value={g.account_no} placeholder="Nomor rekening" />
											<input bind:value={g.account_name} placeholder="Atas nama" />
										</div>
										<div class="row end"><button class="danger sm" onclick={() => delGift(i)}>Hapus</button></div>
									</div>
								</div>
							{/each}
							<label for="qris">QRIS (unggah gambar)</label>
							<input id="qris" type="file" accept="image/*" onchange={onQrisUpload} />
							{#if settings.qris_image}<p class="muted">Tersimpan: {settings.qris_image}</p>{/if}
							<label for="ga">Alamat kirim hadiah</label>
							<textarea id="ga" rows="2" bind:value={settings.gift_address}></textarea>
						</div>
					</section>

					<section class="card">
						<div class="card-head"><h2>Fitur tambahan</h2></div>
						<div class="card-body">
							<label for="vid">Video (URL YouTube/Vimeo/MP4)</label>
							<input id="vid" bind:value={settings.video_url} placeholder="https://youtube.com/watch?v=…" />
							<label for="live">Live streaming (URL)</label>
							<input id="live" bind:value={settings.live_url} placeholder="https://instagram.com/…" />
							<label for="lt">Keterangan live</label>
							<input id="lt" bind:value={settings.live_text} />
							<label for="quote">Kutipan / ayat</label>
							<textarea id="quote" rows="2" bind:value={settings.quote}></textarea>
						</div>
					</section>

					<div class="sticky-save"><button class="btn" onclick={saveContent} disabled={loading}>{loading ? 'Menyimpan…' : 'Simpan semua perubahan'}</button></div>
				{:else if tab === 'impor'}
					<!-- ============ IMPOR JSON (Elementor / Landingstar) ============ -->
					<section class="card">
						<div class="card-head"><h2>Impor dari JSON Elementor / Landingstar</h2></div>
						<div class="card-body">
							<p class="lede">
								Unggah berkas <strong>.json</strong> hasil “Export Template”, atau tempel isinya.
								Pratinjau tidak mengubah data apa pun — Anda meninjau dan mengoreksi dulu sebelum menekan Terapkan.
							</p>
							<label for="impFile">Unggah berkas .json</label>
							<input id="impFile" type="file" accept=".json,application/json" onchange={onImportFile} />
							{#if importFileName}<p class="muted">Berkas: <strong>{importFileName}</strong></p>{/if}
							<label for="impText">Atau tempel JSON di sini</label>
							<textarea
								id="impText"
								rows="5"
								placeholder="Tempel objek JSON ekspor Elementor di sini…"
								bind:value={importRaw}
								oninput={() => { importDraft = null; importApplied = null; }}
							></textarea>
							<div class="row">
								<button class="btn" onclick={previewImport} disabled={importBusy || !importRaw.trim()}>
									{importBusy && !importDraft ? 'Memproses…' : 'Pratinjau'}
								</button>
								{#if importRaw || importDraft}
									<button class="ghost" onclick={resetImport} disabled={importBusy}>Bersihkan</button>
								{/if}
							</div>
						</div>
					</section>

					{#if hasDraft}
						<!-- Ringkasan laporan -->
						<section class="card">
							<div class="card-head"><h2>Ringkasan pratinjau</h2></div>
							<div class="card-body">
								<div class="imp-summary">
									<div class="imp-kv"><span>Format</span><strong>{importDraft.report?.format || '-'}</strong></div>
									<div class="imp-kv"><span>Template</span><strong>{importDraft.report?.templateTitle || '-'}</strong></div>
									<div class="imp-kv"><span>Section</span><strong>{importDraft.report?.sectionCount ?? 0}</strong></div>
									<div class="imp-kv"><span>Pasangan</span><strong>{importDraft.couple?.groom_name || '—'} &amp; {importDraft.couple?.bride_name || '—'}</strong></div>
									<div class="imp-kv"><span>Acara</span><strong>{(importDraft.events ?? []).length}</strong></div>
									<div class="imp-kv"><span>Galeri</span><strong>{(importDraft.gallery ?? []).length}</strong></div>
									<div class="imp-kv"><span>Gambar (remote/lokal)</span><strong>{importImageKinds.remote} / {importImageKinds.local}</strong></div>
									<div class="imp-kv"><span>Kutipan</span><strong>{importDraft.settings?.quote ? 'ada' : '—'}</strong></div>
								</div>

								<h3>Laporan per field</h3>
								<div class="imp-report">
									{#each importDraft.report?.entries ?? [] as r}
										<div class="imp-line">
											<span class="badge-status {statusMeta(r.status).cls}">{statusMeta(r.status).icon} {statusMeta(r.status).label}</span>
											<code>{r.field}</code>
											<span class="imp-val">{r.value || ''}</span>
											{#if r.note}<span class="muted">{r.note}</span>{/if}
										</div>
									{/each}
								</div>
								{#if (importDraft.report?.skipped ?? []).length}
									<p class="muted">
										Widget diabaikan:
										{#each importDraft.report.skipped as s}
											<code>{s.widgetType}</code>{' '}
										{/each}
									</p>
								{/if}
							</div>
						</section>

						<!-- Form koreksi -->
						<section class="card">
							<div class="card-head"><h2>Koreksi cepat</h2></div>
							<div class="card-body">
								<p class="hint">Perbaiki nilai yang bertanda ⚠️ sebelum diterapkan.</p>
								<label for="impTitle">Judul undangan</label>
								<input id="impTitle" bind:value={accountTitle} placeholder="Mis. Fajira & Dion" />
								<div class="grid2">
									<fieldset class="panel">
										<legend>Mempelai pria</legend>
										<label for="ig1">Nama panggilan</label>
										<input id="ig1" bind:value={importDraft.couple.groom_name} />
										<label for="ig2">Nama lengkap &amp; gelar</label>
										<input id="ig2" bind:value={importDraft.couple.groom_full} />
										<label for="ig3">Foto (URL)</label>
										<input id="ig3" bind:value={importDraft.couple.groom_photo} placeholder="https://…" />
										<label for="ig4">Orang tua</label>
										<textarea id="ig4" rows="2" bind:value={importDraft.couple.groom_parents}></textarea>
									</fieldset>
									<fieldset class="panel">
										<legend>Mempelai wanita</legend>
										<label for="ib1">Nama panggilan</label>
										<input id="ib1" bind:value={importDraft.couple.bride_name} />
										<label for="ib2">Nama lengkap &amp; gelar</label>
										<input id="ib2" bind:value={importDraft.couple.bride_full} />
										<label for="ib3">Foto (URL)</label>
										<input id="ib3" bind:value={importDraft.couple.bride_photo} placeholder="https://…" />
										<label for="ib4">Orang tua</label>
										<textarea id="ib4" rows="2" bind:value={importDraft.couple.bride_parents}></textarea>
									</fieldset>
								</div>

								<div class="sub-head">
									<h3>Acara</h3>
									<button class="ghost sm" onclick={addDraftEvent}>+ Tambah acara</button>
								</div>
								{#each importDraft.events as e, i}
									<div class="item">
										<span class="item-no" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
										<div class="item-fields">
											<div class="grid2">
												<input bind:value={e.title} placeholder="Judul (Akad/Resepsi)" />
												<input bind:value={e.key} placeholder="Kunci (akad/resepsi)" />
											</div>
											<div class="grid2">
												<input type="datetime-local" bind:value={e.date_iso} />
												<input bind:value={e.time_text} placeholder="Pukul 08.00 - 10.00 WIB" />
											</div>
											<input bind:value={e.venue} placeholder="Nama tempat" />
											<input bind:value={e.address} placeholder="Alamat" />
											<input bind:value={e.maps_url} placeholder="Google Maps URL" />
											<div class="row end"><button class="danger sm" onclick={() => delDraftEvent(i)}>Hapus acara</button></div>
										</div>
									</div>
								{/each}

								<div class="sub-head">
									<h3>Galeri</h3>
									<button class="ghost sm" onclick={addDraftGallery}>+ Tambah foto</button>
								</div>
								<div class="gallery-edit">
									{#each importDraft.gallery as g, i}
										<div class="g-thumb">
											{#if g.url}<img src={g.url} alt="" />{:else}<div class="g-none">?</div>{/if}
											<input bind:value={g.url} placeholder="https://…" />
											<input bind:value={g.caption} placeholder="Keterangan" />
											<button class="danger sm" onclick={() => delDraftGallery(i)}>×</button>
										</div>
									{/each}
								</div>

								<label for="impQuote">Kutipan / doa</label>
								<textarea id="impQuote" rows="3" bind:value={importDraft.settings.quote}></textarea>
								<label for="impBg">Latar cover (URL)</label>
								<input id="impBg" bind:value={importDraft.settings.background_image} placeholder="https://…" />
							</div>
						</section>

						<!-- Opsi penerapan -->
						<section class="card">
							<div class="card-head"><h2>Opsi penerapan</h2></div>
							<div class="card-body">
								<label for="impMode">Mode tulis</label>
								<select id="impMode" bind:value={importMode}>
									<option value="fill-empty">Isi yang kosong saja (aman — data lama tidak ditimpa)</option>
									<option value="overwrite">Timpa semua (ganti data konten yang ada)</option>
								</select>
								<label for="impImg">Penanganan gambar</label>
								<select id="impImg" bind:value={importImageMode}>
									<option value="link">Simpan tautan apa adanya (cepat)</option>
									<option value="download">Unduh &amp; simpan ke lokal (disarankan — tautan pihak ketiga bisa mati)</option>
								</select>
								<p class="muted">
									{importImageKinds.total} gambar terdeteksi
									({importImageKinds.remote} remote, {importImageKinds.local} lokal).
									{#if importImageMode === 'download'}Maksimum 30 gambar diunduh ulang.{/if}
								</p>

								<div class="row end">
									<button class="btn" onclick={applyImport} disabled={importBusy}>
										{importBusy ? 'Menerapkan…' : 'Terapkan impor'}
									</button>
								</div>
							</div>
						</section>

						{#if importApplied}
							<section class="card imp-done">
								<div class="card-head"><h2>Impor selesai</h2></div>
								<div class="card-body">
									<p>
										<strong>{importApplied.applied?.written ?? 0}</strong> field ditulis ·
										{importApplied.applied?.events ?? 0} acara ·
										{importApplied.applied?.gallery ?? 0} galeri ·
										mode <code>{importApplied.mode}</code>
									</p>
									{#if (importApplied.skippedExisting ?? []).length}
										<p class="muted">
											Dilewati (sudah terisi): {importApplied.skippedExisting.join(', ')}
										</p>
									{/if}
									<div class="row"><button class="ghost sm" onclick={() => (tab = 'konten')}>Lihat di tab Konten →</button></div>
								</div>
							</section>
						{/if}
					{/if}
				{:else if tab === 'tampilan'}
					<section class="card">
						<div class="card-head"><h2>Latar belakang — desktop</h2></div>
						<div class="card-body">
							<label for="bgd">Unggah gambar</label>
							<input id="bgd" type="file" accept="image/*" onchange={(e) => onBgUpload(e, 'background_image')} />
							<label for="bi2">Atau URL gambar</label>
							<input id="bi2" bind:value={settings.background_image} placeholder="https://…" />
							<div class="grid2">
								<div><label for="bp2">Posisi</label><select id="bp2" bind:value={settings.background_position}>{#each BG_POS as p}<option>{p}</option>{/each}</select></div>
								<div><label for="bs2">Ukuran</label><select id="bs2" bind:value={settings.background_size}>{#each BG_SIZE as p}<option>{p}</option>{/each}</select></div>
							</div>
							<div class="grid2">
								<div><label for="br2">Ulang</label><select id="br2" bind:value={settings.background_repeat}>{#each BG_REPEAT as p}<option>{p}</option>{/each}</select></div>
								<div><label for="ba2">Lampiran</label><select id="ba2" bind:value={settings.background_attachment}>{#each BG_ATTACH as p}<option>{p}</option>{/each}</select></div>
							</div>
						</div>
					</section>

					<section class="card">
						<div class="card-head"><h2>Latar belakang — mobile</h2></div>
						<div class="card-body">
							<label for="bgm">Unggah gambar</label>
							<input id="bgm" type="file" accept="image/*" onchange={(e) => onBgUpload(e, 'background_image_mobile')} />
							<label for="bim">Atau URL gambar</label>
							<input id="bim" bind:value={settings.background_image_mobile} placeholder="https://…" />
							<div class="grid2">
								<div><label for="bpm">Posisi</label><select id="bpm" bind:value={settings.background_position_mobile}>{#each BG_POS as p}<option>{p}</option>{/each}</select></div>
								<div><label for="bsm">Ukuran</label><select id="bsm" bind:value={settings.background_size_mobile}>{#each BG_SIZE as p}<option>{p}</option>{/each}</select></div>
							</div>
						</div>
					</section>

					<section class="card">
						<div class="card-head"><h2>Overlay &amp; warna latar</h2></div>
						<div class="card-body">
							<div class="grid2">
								<div><label for="ovc">Warna overlay</label><input type="color" id="ovc" bind:value={settings.background_overlay} /></div>
								<div><label for="ovo">Opasitas ({settings.background_overlay_opacity})</label><input type="range" id="ovo" min="0" max="1" step="0.05" bind:value={settings.background_overlay_opacity} /></div>
							</div>
						</div>
					</section>

					<section class="card">
						<div class="card-head"><h2>Musik latar</h2></div>
						<div class="card-body">
							<label for="mus">Unggah audio</label>
							<input id="mus" type="file" accept="audio/*" onchange={onMusicUpload} />
							<label for="mu">Atau URL musik</label>
							<input id="mu" bind:value={settings.music_url} placeholder="https://….mp3" />
							{#if settings.music_url}<audio src={settings.music_url} controls style="margin-top:.6rem;width:100%"></audio>{/if}
						</div>
					</section>

					<section class="card">
						<div class="card-head"><h2>Foto &amp; bingkai cover</h2></div>
						<div class="card-body">
							<p class="hint">Pilih cara menampilkan foto di halaman pembuka undangan.</p>
							<label for="cmode">Gaya bingkai foto</label>
							<select id="cmode" bind:value={settings.cover_mode}>
								{#each COVER_MODES as m}<option value={m.v}>{m.l}</option>{/each}
							</select>
							<label for="cphoto">URL foto cover {settings.cover_mode === 'none' ? '(nonaktif)' : ''}</label>
							<input id="cphoto" bind:value={settings.cover_photo} placeholder="https://…/foto.jpg" disabled={settings.cover_mode === 'none'} />
							<div class="acts">
								<button class="ghost sm" disabled={settings.cover_mode === 'none'} onclick={() => pickCoverUpload()}>Unggah foto cover</button>
							</div>
							{#if settings.cover_photo}
								<div class="cover-preview cp-{settings.cover_mode}">
									<img src={settings.cover_photo} alt="Pratinjau foto cover" />
								</div>
							{/if}
						</div>
					</section>

					<section class="card">
						<div class="card-head"><h2>Dekorasi &amp; animasi</h2></div>
						<div class="card-body">
							<p class="hint">Dekorasi bergerak membuat undangan terasa lebih hidup.</p>
							<label for="deco">Jenis dekorasi</label>
							<select id="deco" bind:value={settings.decoration}>
								{#each DECORATIONS as d}<option value={d.v}>{d.l}</option>{/each}
							</select>
							<label class="check">
								<input type="checkbox" checked={settings.decoration_animated === '1'} onchange={(e) => (settings.decoration_animated = e.currentTarget.checked ? '1' : '0')} />
								Aktifkan animasi dekorasi (daun/bunga berayun)
							</label>

							<!-- Dekorasi aset file lokal (opsional, ADDITIF) -->
							<div class="deco-asset-block">
								<div class="sub-head">
									<h3>Aset dekorasi lokal <span class="muted">(opsional)</span></h3>
								</div>
								<p class="hint">
									Lapisan dekorasi tambahan dari file lokal. Tidak mengganti dekorasi di atas;
									warnanya mengikuti tema.
								</p>
								<div class="deco-asset-picker" role="radiogroup" aria-label="Pilih aset dekorasi lokal">
									<button
										type="button"
										class="deco-asset-chip"
										class:on={(settings.decoration_asset || 'none') === 'none'}
										role="radio"
										aria-checked={(settings.decoration_asset || 'none') === 'none'}
										onclick={() => (settings.decoration_asset = 'none')}
									>
										<span class="deco-asset-none" aria-hidden="true">—</span>
										Tanpa aset
									</button>
									{#each DECO_ASSETS as a}
										<button
											type="button"
											class="deco-asset-chip"
											class:on={settings.decoration_asset === a.id}
											role="radio"
											aria-checked={settings.decoration_asset === a.id}
											title={a.hint}
											onclick={() => (settings.decoration_asset = a.id)}
										>
											<img class="deco-asset-thumb" src={decoAssetUrl(a)} alt={a.label} />
											{a.label}
										</button>
									{/each}
								</div>
								{#if (settings.decoration_asset || 'none') !== 'none'}
									<label for="decoslot">Tampilkan di</label>
									<select id="decoslot" bind:value={settings.decoration_asset_slot}>
										{#each DECO_SLOT_OPTIONS as o}<option value={o.v}>{o.l}</option>{/each}
									</select>
								{/if}
							</div>
						</div>
					</section>

					<section class="card">
						<div class="card-head"><h2>Watermark</h2></div>
						<div class="card-body">
							<label class="check"><input type="checkbox" checked={settings.watermark_enabled === '1'} onchange={(e) => (settings.watermark_enabled = e.currentTarget.checked ? '1' : '')} /> Tampilkan watermark</label>
							<label for="wt">Teks watermark</label>
							<input id="wt" bind:value={settings.watermark_text} placeholder="Undangan Digital" />
						</div>
					</section>

					<!-- ============ EFEK PREMIUM ============ -->
					<section class="card fx-card">
						<div class="card-head">
							<h2>Efek Premium</h2>
							<span class="fx-badge">Premium</span>
						</div>
						<div class="card-body">
							<p class="hint">
								Efek gerak dan olah foto untuk kesan lebih mewah. Semua nonaktif secara
								bawaan — tamu yang mengaktifkan "kurangi gerakan" di perangkatnya tetap
								aman karena animasi dihormati.
							</p>

							<!-- Saklar utama -->
							<label class="check fx-master">
								<input
									type="checkbox"
									checked={settings.effects_enabled === '1'}
									onchange={(e) => (settings.effects_enabled = e.currentTarget.checked ? '1' : '0')}
								/>
								Aktifkan Efek Premium
							</label>

							{#if settings.effects_enabled === '1'}
								<!-- Intensitas -->
								<div class="fx-row">
									<div class="fx-row-head">
										<span class="fx-label">Intensitas efek</span>
										<span class="fx-pill">
											{FX_INTENSITY.find((x) => x.v === (settings.effects_intensity || 'medium'))?.l || 'Sedang'}
										</span>
									</div>
									<div class="fx-scale" role="radiogroup" aria-label="Intensitas efek">
										{#each FX_INTENSITY as o}
											<button
												type="button"
												class="fx-seg"
												class:on={(settings.effects_intensity || 'medium') === o.v}
												role="radio"
												aria-checked={(settings.effects_intensity || 'medium') === o.v}
												title={o.hint}
												onclick={() => (settings.effects_intensity = o.v)}
											>{o.l}</button>
										{/each}
									</div>
								</div>

								<!-- Saklar efek gerak -->
								<div class="fx-toggles">
									<label class="check">
										<input
											type="checkbox"
											checked={settings.effects_parallax === '1'}
											onchange={(e) => (settings.effects_parallax = e.currentTarget.checked ? '1' : '0')}
										/>
										<span><strong>Parallax</strong> — latar bergerak halus saat digulir</span>
									</label>
									<label class="check">
										<input
											type="checkbox"
											checked={settings.effects_kenburns === '1'}
											onchange={(e) => (settings.effects_kenburns = e.currentTarget.checked ? '1' : '0')}
										/>
										<span><strong>Ken Burns</strong> — zoom perlahan pada foto cover</span>
									</label>
								</div>

								<!-- Gaya reveal -->
								<div class="fx-row">
									<div class="fx-row-head">
										<span class="fx-label">Gaya reveal (kemunculan bagian)</span>
										<span class="fx-pill">
											{FX_REVEAL.find((x) => x.v === (settings.effects_reveal || 'fade-up'))?.l || 'Naik'}
										</span>
									</div>
									<div class="fx-scale" role="radiogroup" aria-label="Gaya reveal">
										{#each FX_REVEAL as o}
											<button
												type="button"
												class="fx-seg"
												class:on={(settings.effects_reveal || 'fade-up') === o.v}
												role="radio"
												aria-checked={(settings.effects_reveal || 'fade-up') === o.v}
												title={o.hint}
												onclick={() => (settings.effects_reveal = o.v)}
											>{o.l}</button>
										{/each}
									</div>
								</div>

								<!-- Transisi antar-bagian -->
								<label class="check">
									<input
										type="checkbox"
										checked={settings.effects_transition_enabled === '1'}
										onchange={(e) => (settings.effects_transition_enabled = e.currentTarget.checked ? '1' : '0')}
									/>
									<span><strong>Transisi antar-bagian</strong> — pembatas/gradasi antar seksi</span>
								</label>
								{#if settings.effects_transition_enabled === '1'}
									<div class="fx-sub">
										<div class="fx-scale" role="radiogroup" aria-label="Gaya transisi">
											{#each FX_TRANSITION as o}
												<button
													type="button"
													class="fx-seg"
													class:on={(settings.effects_transition || 'none') === o.v}
													role="radio"
													aria-checked={(settings.effects_transition || 'none') === o.v}
													title={o.hint}
													onclick={() => (settings.effects_transition = o.v)}
												>{o.l}</button>
											{/each}
										</div>
									</div>
								{/if}

								<!-- Filter foto -->
								<label class="check">
									<input
										type="checkbox"
										checked={settings.effects_photo_filter_enabled === '1'}
										onchange={(e) => (settings.effects_photo_filter_enabled = e.currentTarget.checked ? '1' : '0')}
									/>
									<span><strong>Filter foto</strong> — samakan nuansa foto mempelai, galeri &amp; cover</span>
								</label>
								{#if settings.effects_photo_filter_enabled === '1'}
									<div class="fx-sub">
										<div class="fx-filter-grid" role="radiogroup" aria-label="Filter foto">
											{#each FX_FILTERS as f}
												<button
													type="button"
													class="fx-filter"
													class:on={(settings.effects_photo_filter || 'none') === f.v}
													role="radio"
													aria-checked={(settings.effects_photo_filter || 'none') === f.v}
													title={f.hint}
													onclick={() => (settings.effects_photo_filter = f.v)}
												>
													<span class="fx-filter-thumb" data-filter={f.v}>
														{#if settings.cover_photo}
															<img src={settings.cover_photo} alt="" />
														{:else}
															<span class="fx-filter-demo" aria-hidden="true"></span>
														{/if}
													</span>
													<span class="fx-filter-name">{f.l}</span>
												</button>
											{/each}
										</div>
									</div>
								{/if}

								<div class="row end fx-reset">
									<button class="ghost sm" type="button" onclick={resetEffects}>Setel ulang efek</button>
								</div>
							{/if}
						</div>
					</section>

					<!-- ============ GRADASI PREMIUM ============ -->
					<section class="card fx-card gr-card">
						<div class="card-head">
							<h2>Gradasi Premium</h2>
							<span class="fx-badge">Premium</span>
						</div>
						<div class="card-body">
							<p class="hint">
								Lapisan warna sinematik pada latar cover &amp; hero — luluh, vignette,
								glow, atau overlay. Nonaktif secara bawaan; tamu yang memilih
								"kurangi gerakan" tetap aman.
							</p>

							<!-- Saklar utama -->
							<label class="check fx-master">
								<input
									type="checkbox"
									checked={settings.gradient_enabled === '1'}
									onchange={(e) => (settings.gradient_enabled = e.currentTarget.checked ? '1' : '0')}
								/>
								Aktifkan Gradasi Premium
							</label>

							{#if settings.gradient_enabled === '1'}
								<!-- Gaya gradasi -->
								<div class="fx-row">
									<div class="fx-row-head">
										<span class="fx-label">Gaya gradasi</span>
										<span class="fx-pill">
											{GR_STYLES.find((x) => x.v === (settings.gradient_style || 'none'))?.l || 'Tanpa'}
										</span>
									</div>
									<div class="gr-style-grid" role="radiogroup" aria-label="Gaya gradasi">
										{#each GR_STYLES as o}
											<button
												type="button"
												class="gr-style"
												class:on={(settings.gradient_style || 'none') === o.v}
												role="radio"
												aria-checked={(settings.gradient_style || 'none') === o.v}
												title={o.hint}
												onclick={() => (settings.gradient_style = o.v)}
											>
												<span class="gr-style-icon" aria-hidden="true">{o.icon}</span>
												<span class="gr-style-name">{o.l}</span>
												<span class="gr-style-hint">{o.hint}</span>
											</button>
										{/each}
									</div>
								</div>

								<!-- Kekuatan -->
								<div class="fx-row">
									<div class="fx-row-head">
										<span class="fx-label">Kekuatan</span>
										<span class="fx-pill">
											{FX_INTENSITY.find((x) => x.v === (settings.gradient_intensity || 'medium'))?.l || 'Sedang'}
										</span>
									</div>
									<div class="fx-scale" role="radiogroup" aria-label="Kekuatan gradasi">
										{#each FX_INTENSITY as o}
											<button
												type="button"
												class="fx-seg"
												class:on={(settings.gradient_intensity || 'medium') === o.v}
												role="radio"
												aria-checked={(settings.gradient_intensity || 'medium') === o.v}
												title={o.hint}
												onclick={() => (settings.gradient_intensity = o.v)}
											>{o.l}</button>
										{/each}
									</div>
								</div>

								<!-- Target -->
								<div class="fx-row">
									<div class="fx-row-head">
										<span class="fx-label">Diterapkan pada</span>
										<span class="fx-pill">
											{GR_TARGETS.find((x) => x.v === (settings.gradient_target || 'both'))?.l || 'Keduanya'}
										</span>
									</div>
									<div class="fx-scale" role="radiogroup" aria-label="Target gradasi">
										{#each GR_TARGETS as o}
											<button
												type="button"
												class="fx-seg"
												class:on={(settings.gradient_target || 'both') === o.v}
												role="radio"
												aria-checked={(settings.gradient_target || 'both') === o.v}
												title={o.hint}
												onclick={() => (settings.gradient_target = o.v)}
											>{o.icon} {o.l}</button>
										{/each}
									</div>
								</div>

								<!-- Basis warna -->
								<div class="fx-row">
									<div class="fx-row-head">
										<span class="fx-label">Basis warna</span>
										<span class="fx-pill">
											{GR_PALETTES.find((x) => x.v === (settings.gradient_palette || 'auto'))?.l || 'Otomatis'}
										</span>
									</div>
									<div class="fx-scale" role="radiogroup" aria-label="Basis warna gradasi">
										{#each GR_PALETTES as o}
											<button
												type="button"
												class="fx-seg"
												class:on={(settings.gradient_palette || 'auto') === o.v}
												role="radio"
												aria-checked={(settings.gradient_palette || 'auto') === o.v}
												title={o.hint}
												onclick={() => (settings.gradient_palette = o.v)}
											>{o.icon} {o.l}</button>
										{/each}
									</div>
								</div>

								<!-- Warna kustom (hanya saat basis = kustom) -->
								{#if (settings.gradient_palette || 'auto') === 'custom'}
									<div class="fx-sub">
										<label for="grc">Warna kustom</label>
										<div class="gr-color-row">
											<input type="color" id="grc" bind:value={settings.gradient_color} />
											<input
												type="text"
												class="gr-color-text"
												bind:value={settings.gradient_color}
												placeholder="#a9762b"
												aria-label="Kode warna heksadesimal"
											/>
										</div>
										<p class="hint">Format heksadesimal (#rgb atau #rrggbb). Nilai tak valid diabaikan server.</p>
									</div>
								{/if}

								<div class="row end fx-reset">
									<button class="ghost sm" type="button" onclick={resetGradient}>Setel ulang gradasi</button>
								</div>
							{/if}
						</div>
					</section>

					<div class="sticky-save"><button class="btn" onclick={saveContent} disabled={loading}>{loading ? 'Menyimpan…' : 'Simpan tampilan'}</button></div>
				{:else if tab === 'tema'}
					<section class="card">
						<div class="card-head"><h2>Preset tema</h2></div>
						<div class="card-body">
							<p class="lede">
								<strong>Bundle</strong> menerapkan tema + ornamen + bingkai foto + dekorasi
								sekaligus agar serasi. Tombol tema biasa hanya mengganti warna dan font.
							</p>
							<div class="theme-picker">
								{#each THEMES as t}
									<button class="theme-chip" class:on={content.account.theme === t} onclick={() => setTheme(t)}>
										<span class="swatch" data-t={t}></span>{themeLabel(t)}
									</button>
								{/each}
							</div>
						</div>
					</section>

					<section class="card">
						<div class="card-head"><h2>Bundle preset</h2></div>
						<div class="card-body">
							<p class="hint">Sekali klik — ornamen, bingkai foto &amp; dekorasi ikut menyesuaikan karakter tema.</p>
							<div class="bundle-grid">
								{#each BUNDLE_PRESETS as b}
									<button
										class="bundle-card"
										class:on={content.account.theme === b.theme}
										disabled={loading}
										onclick={() => applyBundle(b.theme)}
									>
										<span class="swatch" data-t={b.theme}></span>
										<span class="bundle-info">
											<strong>{b.label}</strong>
											<span class="muted">{themeLabel(b.theme)}</span>
										</span>
										<span class="bundle-tick" aria-hidden="true">✓</span>
									</button>
								{/each}
							</div>
						</div>
					</section>

					<section class="card">
						<div class="card-head"><h2>Buat tema sendiri</h2></div>
						<div class="card-body">
							<div class="grid2">
								<div><label for="czn">Nama tema</label><input id="czn" bind:value={czName} /></div>
								<div><label for="czb">Basis preset</label><select id="czb" bind:value={czBase}>{#each THEMES as t}<option value={t}>{themeLabel(t)}</option>{/each}</select></div>
							</div>

							<h3>Warna</h3>
							<div class="cz-grid">
								{#each TOKENS as tk}
									<label class="cz-token">{tk.l}
										<input type="color" bind:value={czTokens[tk.k]} oninput={() => { if (!czTokens[tk.k]) czTokens[tk.k] = '#000000'; }} />
									</label>
								{/each}
							</div>

							<h3>Font</h3>
							<div class="grid2">
								<div><label for="fs">Judul (serif)</label><select id="fs" bind:value={czTokens['--serif']}>{#each FONTS_SERIF as f}<option value={f}>{f}</option>{/each}</select></div>
								<div><label for="fsc">Skrip</label><select id="fsc" bind:value={czTokens['--script']}>{#each FONTS_SCRIPT as f}<option value={f}>{f}</option>{/each}</select></div>
							</div>

							<div class="cz-preview" style:background={czTokens['--cream'] || '#f7f4ec'} style:color={czTokens['--ink'] || '#33352e'}>
								<span style:color={czTokens['--gold'] || '#b08d47'}>Contoh warna emas</span>
								<h2 style:color={czTokens['--sage-dark'] || '#57684a'} style:font-family={czTokens['--serif'] || 'Cormorant Garamond'}>
									Rizky & Amelia
								</h2>
								<p style:font-family={czTokens['--script'] || 'Great Vibes'}>Undangan Pernikahan</p>
							</div>

							<div class="row">
								<button class="btn" onclick={saveTheme}>{editingThemeId ? 'Perbarui tema' : 'Simpan sebagai tema'}</button>
								{#if editingThemeId}<button class="ghost" onclick={() => fillCustomizer()}>Batal</button>{/if}
							</div>
						</div>
					</section>

					{#if themes.length}
						<section class="card">
							<div class="card-head"><h2>Tema tersimpan</h2></div>
							<div class="card-body">
								{#each themes as t}
									<div class="list-row">
										<div><strong>{t.name}</strong><span class="muted"> · basis {themeLabel(t.base)}</span></div>
										<div class="acts">
											<button class="ghost sm" onclick={() => useTheme(t.slug)}>Pakai</button>
											<button class="ghost sm" onclick={() => fillCustomizer(t)}>Edit</button>
											<button class="danger sm" onclick={() => delTheme(t.id)}>Hapus</button>
										</div>
									</div>
								{/each}
							</div>
						</section>
					{/if}
				{:else if tab === 'tamu'}
					<section class="card">
						<div class="card-head"><h2>Tambah tamu</h2></div>
						<div class="card-body">
							<div class="grid2">
								<div><label for="gn2">Nama tamu</label><input id="gn2" bind:value={gName} placeholder="Nama tamu" /></div>
								<div><label for="gp2">No. HP (opsional)</label><input id="gp2" bind:value={gPhone} placeholder="08xxxxxxxxxx" /></div>
							</div>
							<div class="grid2">
								<div><label for="gc2">Kategori</label><input id="gc2" bind:value={gCat} placeholder="Keluarga / Teman" /></div>
								<div><label for="gq2">Kuota orang</label><input id="gq2" type="number" bind:value={gQuota} min="1" max="50" placeholder="Kuota" /></div>
							</div>
							<div class="row end"><button class="btn" onclick={addGuest}>Tambah tamu</button></div>
						</div>
					</section>
					<section class="card">
						<div class="card-head"><h2>Daftar tamu <span class="count">{guests.length}</span></h2></div>
						<div class="card-body">
							<div class="table-wrap">
								<table>
									<thead><tr><th>Nama</th><th>Kategori</th><th>Kuota</th><th>RSVP</th><th></th></tr></thead>
									<tbody>
										{#each guests as g}
											<tr>
												<td>{g.name}<br /><span class="muted slug">/{g.slug}</span></td>
												<td>{g.category || '-'}</td>
												<td>{g.quota}</td>
												<td>{g.rsvp_count}</td>
												<td class="acts">
													<button class="ghost sm" onclick={() => copyLink(g)}>Link</button>
													<button class="danger sm" onclick={() => delGuest(g.id)}>Hapus</button>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					</section>
				{:else if tab === 'rsvp'}
					<div class="stats">
						<div class="stat"><strong>{rsvp.stats?.hadir ?? 0}</strong><span>Hadir</span></div>
						<div class="stat"><strong>{rsvp.stats?.tidak_hadir ?? 0}</strong><span>Tidak hadir</span></div>
						<div class="stat"><strong>{rsvp.stats?.ragu ?? 0}</strong><span>Masih ragu</span></div>
						<div class="stat"><strong>{rsvp.stats?.total_pax ?? 0}</strong><span>Total orang</span></div>
					</div>
					<section class="card">
						<div class="card-head"><h2>Daftar konfirmasi</h2></div>
						<div class="card-body">
							<div class="table-wrap">
								<table>
									<thead><tr><th>Nama</th><th>Status</th><th>Jml</th><th>Pesan</th></tr></thead>
									<tbody>
										{#each rsvp.rows as r}
											<tr><td>{r.name}</td><td><span class="pill">{r.attendance}</span></td><td>{r.pax}</td><td>{r.message || '-'}</td></tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					</section>
				{:else if tab === 'ucapan'}
					<section class="card">
						<div class="card-head">
							<h2>Ucapan &amp; doa <span class="count">{wishes.length}</span></h2>
							<button class="ghost sm" onclick={() => exportCsv('wishes')}>Ekspor CSV</button>
						</div>
						<div class="card-body">
							{#each wishes as w}
								<div class="list-row wish">
									<div><strong>{w.name}</strong> <span class="muted">· {new Date(w.created_at).toLocaleDateString('id-ID')}</span><p>{w.message}</p></div>
									<button class="danger sm" onclick={() => delWish(w.id)}>Hapus</button>
								</div>
							{/each}
						</div>
					</section>
				{:else if tab === 'pengaturan'}
					<section class="card">
						<div class="card-head"><h2>Ekspor data</h2></div>
						<div class="card-body">
							<p class="hint">Unduh data dalam format CSV untuk dibuka di Excel.</p>
							<div class="acts">
								<button class="ghost sm" onclick={() => exportCsv('rsvp')}>RSVP (.csv)</button>
								<button class="ghost sm" onclick={() => exportCsv('guests')}>Tamu (.csv)</button>
								<button class="ghost sm" onclick={() => exportCsv('wishes')}>Ucapan (.csv)</button>
							</div>
						</div>
					</section>
					<section class="card">
						<div class="card-head"><h2>Ganti password admin</h2></div>
						<div class="card-body">
							<label for="nap">Password baru</label>
							<input id="nap" type="password" bind:value={newAdminPw} placeholder="Minimal 5 karakter" autocomplete="new-password" />
							<div class="row end"><button class="btn" onclick={changeAdminPw}>Ganti password</button></div>
						</div>
					</section>
					<section class="card">
						<div class="card-head"><h2>Info akun</h2></div>
						<div class="card-body">
							<dl class="facts">
								<div><dt>Slug undangan</dt><dd>{slug}</dd></div>
								<div><dt>Tema aktif</dt><dd>{content.account.theme}</dd></div>
								<div><dt>Status</dt><dd>{content.account.status}</dd></div>
								<div><dt>Masa aktif s/d</dt><dd>{content.account.expires_at ? new Date(content.account.expires_at).toLocaleDateString('id-ID') : 'tanpa batas'}</dd></div>
							</dl>
						</div>
					</section>
				{/if}
			</main>
		</div>
	</div>
{/if}

<style>
	/* ============================================================
	   MEJA KERJA PERAKITAN UNDANGAN
	   Panel admin sebagai bangku kerja: rel alat gelap di kiri,
	   permukaan kertas terang di kanan tempat komponen dirakit.
	   ============================================================ */
	:global(body) {
		margin: 0;
		background: #fbf8f1;
		color: #2b2118;
		font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
		-webkit-font-smoothing: antialiased;
	}

	/* ---- Token bangku kerja ---- */
	:global(:root) {
		--bench: #141210;
		--bench-2: #201c16;
		/* Batas kontrol di rel dinaikkan agar terlihat (WCAG 1.4.11 butuh ≥3:1
		   untuk batas komponen UI). Nilai lama rgba(255,255,255,0.08) ≈1.25:1. */
		--bench-line: rgba(255, 255, 255, 0.34);
		--board: #fbf8f1;
		--card: #ffffff;
		--rule: #e6ded0;
		--rule-soft: #efe8dc;
		--ink: #2b2118;
		--ink-2: #6a5c4c;
		--ink-3: #9a8b78;
		--brass: #a9762b;
		--brass-lite: #c79a4e;
		--sage: #4a5d3e;
		--clay: #b4553a;
		--field: #fdfcf9;
	}

	/* ---------- Primitif tipe ---------- */
	.eyebrow {
		margin: 0;
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--brass);
	}
	h1,
	h2,
	h3 {
		font-family: 'Cormorant Garamond', Georgia, serif;
		color: var(--bench);
		line-height: 1.08;
		margin: 0;
	}
	h1 { font-size: 2rem; font-weight: 600; }
	h2 { font-size: 1.4rem; font-weight: 600; letter-spacing: 0.005em; }
	h3 { font-size: 1.05rem; font-weight: 600; }
	.lede { color: var(--ink-2); font-size: 0.95rem; line-height: 1.6; margin: 0; max-width: 62ch; }
	.hint { color: var(--ink-3); font-size: 0.86rem; line-height: 1.5; margin: 0; max-width: 62ch; }
	.muted { color: var(--ink-3); font-size: 0.8rem; }
	code {
		font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, monospace;
		font-size: 0.75rem;
		background: #f4efe5;
		border-radius: 4px;
		padding: 1px 5px;
		color: #7a5a2a;
	}

	/* ---------- Tombol ---------- */
	button { font: inherit; }
	.btn {
		background: var(--bench);
		color: #fdfaf3;
		border: 0;
		border-radius: 9px;
		padding: 0.66rem 1.25rem;
		font-size: 0.86rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		cursor: pointer;
		transition: transform 0.14s ease, box-shadow 0.14s ease;
		box-shadow: 0 2px 0 0 #000;
	}
	.btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px -4px rgba(20, 18, 16, 0.6), 0 2px 0 0 #000; }
	.btn:active:not(:disabled) { transform: translateY(0); box-shadow: 0 1px 0 0 #000; }
	.btn:disabled { opacity: 0.55; cursor: default; }

	.ghost {
		background: transparent;
		border: 1px solid var(--rule);
		border-radius: 9px;
		padding: 0.5rem 0.95rem;
		font-size: 0.82rem;
		font-weight: 500;
		cursor: pointer;
		color: var(--ink-2);
		transition: border-color 0.14s ease, color 0.14s ease, background 0.14s ease;
	}
	.ghost:hover:not(:disabled) { border-color: var(--brass); color: var(--brass); background: #fffdf7; }
	.ghost:disabled { opacity: 0.45; cursor: default; }
	.ghost.sm,
	.danger.sm { padding: 0.32rem 0.68rem; font-size: 0.75rem; }
	.danger {
		background: var(--clay);
		color: #fff;
		border: 0;
		border-radius: 9px;
		padding: 0.5rem 0.95rem;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		transition: filter 0.14s ease;
	}
	.danger:hover:not(:disabled) { filter: brightness(1.08); }
	:focus-visible { outline: 2px solid var(--brass); outline-offset: 2px; }

	/* ---------- Boot / memuat ---------- */
	.boot { display: grid; place-items: center; min-height: 100vh; gap: 1rem; color: var(--ink-3); }
	.boot p { font-size: 0.86rem; letter-spacing: 0.03em; }
	.boot-mark {
		width: 34px; height: 34px; border-radius: 50%;
		border: 2px solid var(--rule); border-top-color: var(--brass);
		animation: spin 0.9s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	/* ============================================================
	   GERBANG MASUK
	   ============================================================ */
	.gate {
		min-height: 100vh;
		display: grid;
		grid-template-columns: minmax(0, 0.85fr) minmax(0, 1fr);
		background: var(--board);
	}
	.gate-aside {
		background:
			radial-gradient(120% 90% at 88% 6%, rgba(199, 154, 78, 0.16), transparent 55%),
			linear-gradient(160deg, var(--bench) 0%, #241d14 100%);
		color: #f4ecdd;
		padding: 3.5rem;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		position: relative;
		overflow: hidden;
	}
	.gate-aside::before {
		content: '';
		position: absolute;
		inset: 2rem;
		border: 1px solid rgba(199, 154, 78, 0.28);
		border-radius: 2px;
		pointer-events: none;
	}
	.gate-rule { width: 46px; height: 2px; background: var(--brass-lite); margin-bottom: 1.1rem; }
	.gate-word {
		font-family: 'Cormorant Garamond', Georgia, serif;
		font-size: clamp(2.6rem, 5vw, 4rem);
		line-height: 0.98;
		margin: 0;
		letter-spacing: -0.01em;
	}
	.gate-sub {
		margin: 0.3rem 0 0;
		font-size: 0.82rem;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: rgba(244, 236, 221, 0.6);
	}
	.gate-form {
		align-self: center;
		width: 100%;
		max-width: 430px;
		margin: 0 auto;
		padding: 2rem 2.4rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.gate-form h1 { font-size: 2.1rem; margin: 0.55rem 0 0.4rem; }
	.gate-hint { color: var(--ink-2); font-size: 0.92rem; line-height: 1.6; margin: 0 0 0.9rem; }
	.gate-hint strong { color: var(--ink); }
	.pw-row { display: flex; gap: 0.5rem; align-items: stretch; }
	.pw-row input { flex: 1; }
	.gate-form .btn { white-space: nowrap; box-shadow: 0 2px 0 0 #000; }
	.err { color: var(--clay); font-size: 0.83rem; margin: 0.15rem 0 0; }
	.quiet-link { font-size: 0.83rem; color: var(--ink-3); margin-top: 0.9rem; text-decoration: none; width: fit-content; }
	.quiet-link:hover { color: var(--brass); }

	/* ============================================================
	   BANGKU KERJA — shell dua kolom
	   ============================================================ */
	.bench { display: grid; grid-template-columns: 268px minmax(0, 1fr); min-height: 100vh; }

	/* ---- Rel alat ---- */
	.rail {
		background: linear-gradient(180deg, var(--bench) 0%, #1b1712 100%);
		color: #efe7da;
		padding: 1.35rem 1.05rem;
		display: flex;
		flex-direction: column;
		gap: 1.4rem;
		position: sticky;
		top: 0;
		height: 100vh;
		overflow: hidden;
	}
	.rail-brand { display: flex; gap: 0.7rem; align-items: center; flex: none; }
	.rail-mark {
		width: 38px; height: 38px; flex: none;
		display: grid; place-items: center;
		border-radius: 10px;
		background: linear-gradient(150deg, var(--brass-lite), var(--brass));
		color: #1a1409;
		font-family: 'Cormorant Garamond', Georgia, serif;
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1;
	}
	.rail-brand strong {
		display: block;
		font-family: 'Cormorant Garamond', Georgia, serif;
		font-size: 1.22rem;
		font-weight: 600;
		line-height: 1.15;
		color: #fbf6ec;
	}
	/* Kontras sidebar: label & kontrol dinaikkan ke WCAG AA (teks normal ≥4.5:1).
	   Sebelumnya tab-no (brass @opacity .75 ≈4.4:1) dan rail-slug (rgba .5 ≈4.5:1)
	   berada di batas/gagal. Nilai di bawah terukur ≥5.4:1 pada latar rel gelap. */
	.rail-slug { font-size: 0.72rem; color: rgba(239, 231, 218, 0.72); letter-spacing: 0.03em; }

	/* Tab bisa digulir: brand & footer tetap terlihat, daftar menu menggulir
	   di layar pendek sehingga semua item + kontrol footer tetap terjangkau. */
	.rail-tabs { display: flex; flex-direction: column; gap: 0.1rem; flex: 1 1 auto; min-height: 0; overflow-y: auto; scrollbar-width: thin; }
	.rail-tabs button {
		display: flex;
		align-items: baseline;
		gap: 0.7rem;
		background: transparent;
		border: 0;
		border-radius: 9px;
		padding: 0.56rem 0.7rem;
		cursor: pointer;
		color: rgba(239, 231, 218, 0.84);
		text-align: left;
		transition: background 0.14s ease, color 0.14s ease;
		position: relative;
	}
	.rail-tabs button:hover { background: rgba(255, 255, 255, 0.05); color: #fbf6ec; }
	.rail-tabs button.on { background: rgba(199, 154, 78, 0.14); color: #fff; }
	.rail-tabs button.on::before {
		content: '';
		position: absolute;
		left: 0; top: 20%; bottom: 20%;
		width: 3px;
		border-radius: 3px;
		background: var(--brass-lite);
	}
	.tab-no {
		font-size: 0.66rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		color: var(--brass-lite);
		font-variant-numeric: tabular-nums;
	}
	.rail-tabs button.on .tab-no { color: #e0bd7f; }
	.tab-label { font-size: 0.86rem; font-weight: 500; }

	.rail-foot { margin-top: auto; display: flex; flex-direction: column; gap: 0.85rem; flex: none; }
	.rail-theme {
		display: flex; align-items: center; gap: 0.5rem;
		padding: 0.6rem 0.7rem;
		border: 1px solid var(--bench-line);
		border-radius: 9px;
		background: rgba(255, 255, 255, 0.03);
	}
	.rail-theme-txt { font-size: 0.8rem; color: rgba(239, 231, 218, 0.8); }
	.rail-acts { display: flex; flex-direction: column; gap: 0.4rem; }
	.rail .ghost { color: rgba(239, 231, 218, 0.88); border-color: var(--bench-line); text-align: left; text-decoration: none; }
	.rail .ghost:hover { color: #fbf6ec; border-color: var(--brass-lite); background: rgba(199, 154, 78, 0.08); }

	/* ---- Permukaan kertas ---- */
	.surface { min-width: 0; display: flex; flex-direction: column; }
	.surface-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.7rem 2.2rem 1.1rem;
		border-bottom: 1px solid var(--rule-soft);
		background: linear-gradient(180deg, #fffdf8, var(--board));
	}
	.surface-title h1 { font-size: 1.9rem; margin-top: 0.15rem; }
	.surface-head .compact { display: none; }

	.board {
		max-width: 940px;
		width: 100%;
		margin: 0 auto;
		padding: 1.6rem 2.2rem 4rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* ---- Kartu material ---- */
	.card {
		background: var(--card);
		border: 1px solid var(--rule-soft);
		border-radius: 14px;
		box-shadow: 0 1px 0 0 rgba(20, 18, 16, 0.03), 0 12px 30px -26px rgba(20, 18, 16, 0.5);
		overflow: hidden;
	}
	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		padding: 1.05rem 1.4rem 0.85rem;
		border-bottom: 1px solid var(--rule-soft);
	}
	.card-body { padding: 1.2rem 1.4rem 1.4rem; display: flex; flex-direction: column; gap: 0.4rem; }
	.card-body > .hint + label,
	.card-body > .lede + label { margin-top: 0.5rem; }
	.sub-head {
		display: flex; align-items: center; justify-content: space-between; gap: 0.8rem;
		margin: 1.1rem 0 0.35rem;
		padding-top: 0.9rem;
		border-top: 1px dashed var(--rule);
	}
	.sub-head:first-child { margin-top: 0; padding-top: 0; border-top: 0; }
	.count {
		display: inline-grid; place-items: center;
		min-width: 1.5em; height: 1.5em; padding: 0 0.4em;
		margin-left: 0.35rem;
		border-radius: 999px;
		background: #f1ead9;
		color: var(--brass);
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 0.72rem;
		font-weight: 700;
		vertical-align: middle;
	}

	/* ---- Formulir ---- */
	label {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--ink-2);
		margin-top: 0.55rem;
		letter-spacing: 0.01em;
	}
	input,
	select,
	textarea {
		width: 100%;
		padding: 0.58rem 0.72rem;
		border: 1px solid var(--rule);
		border-radius: 9px;
		font-family: inherit;
		font-size: 0.88rem;
		color: var(--ink);
		background: var(--field);
		transition: border-color 0.14s ease, box-shadow 0.14s ease, background 0.14s ease;
	}
	input::placeholder,
	textarea::placeholder { color: #b6a892; }
	input:hover:not(:disabled),
	select:hover:not(:disabled),
	textarea:hover:not(:disabled) { border-color: #d6c9b2; }
	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: var(--brass);
		background: #fff;
		box-shadow: 0 0 0 3px rgba(169, 118, 43, 0.13);
	}
	input:disabled { background: #f6f2ea; color: var(--ink-3); }
	input[type='color'] { height: 42px; padding: 3px; cursor: pointer; }
	input[type='range'] { padding: 0; accent-color: var(--brass); }
	input[type='file'] { padding: 0.42rem 0.5rem; font-size: 0.82rem; background: #fff; }
	input[type='file']::file-selector-button {
		font: inherit;
		font-size: 0.78rem;
		font-weight: 600;
		margin-right: 0.6rem;
		padding: 0.32rem 0.7rem;
		border: 1px solid var(--rule);
		border-radius: 7px;
		background: #f7f2e7;
		color: var(--ink-2);
		cursor: pointer;
	}
	textarea { resize: vertical; line-height: 1.5; }
	.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; }
	.row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
	.row.end { justify-content: flex-end; }

	fieldset.panel {
		border: 1px solid var(--rule-soft);
		border-radius: 11px;
		padding: 0.4rem 1rem 1rem;
		margin: 0;
		background: #fdfbf6;
	}
	fieldset.panel legend {
		font-family: 'Cormorant Garamond', Georgia, serif;
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--bench);
		padding: 0 0.5rem;
	}

	.check {
		flex-direction: row;
		display: flex;
		gap: 0.55rem;
		align-items: center;
		margin-top: 0.8rem;
		font-size: 0.86rem;
		font-weight: 500;
		color: var(--ink-2);
		cursor: pointer;
	}
	.check input { width: auto; accent-color: var(--sage); }

	/* Blok item berulang (acara, amplop) */
	.item {
		display: flex;
		gap: 0.85rem;
		border: 1px solid var(--rule-soft);
		border-left: 3px solid var(--brass);
		border-radius: 11px;
		padding: 0.9rem 1rem;
		margin: 0.45rem 0;
		background: #fdfbf6;
	}
	.item-fields { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.5rem; }
	.item-no {
		font-family: 'Cormorant Garamond', Georgia, serif;
		font-size: 1.4rem;
		font-weight: 600;
		color: var(--brass);
		line-height: 1;
		flex: none;
	}

	/* ---- Statistik ---- */
	.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.85rem; }
	.stat {
		background: var(--card);
		border: 1px solid var(--rule-soft);
		border-radius: 13px;
		padding: 1.1rem 1.2rem;
		position: relative;
		overflow: hidden;
	}
	.stat::after {
		content: '';
		position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
		background: linear-gradient(180deg, var(--brass-lite), var(--brass));
	}
	.stat strong {
		display: block;
		/* Angka statistik memakai sans (bukan Cormorant): pada Cormorant digit "1"
		   tergambar seperti huruf "I" tanpa kaki serif. Tabular-nums menstabilkan
		   lebar digit agar angka tidak "melompat" saat nilainya berubah. */
		font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
		font-variant-numeric: tabular-nums;
		font-feature-settings: 'tnum' 1;
		font-size: 2.3rem;
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.01em;
		color: var(--bench);
	}
	.stat span { display: block; margin-top: 0.3rem; font-size: 0.78rem; color: var(--ink-2); }

	/* Kartu pembuka / intro */
	.card.intro .card-body { padding: 1.6rem 1.6rem 1.7rem; }
	.card.intro h2 { font-size: 1.7rem; margin-bottom: 0.4rem; }
	.card.intro .acts { display: flex; gap: 0.6rem; margin-top: 1.1rem; flex-wrap: wrap; }

	/* ---- Galeri ---- */
	.gallery-edit { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 0.7rem; margin-top: 0.5rem; }
	.g-thumb { position: relative; display: flex; flex-direction: column; gap: 0.3rem; }
	.g-thumb img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 9px; border: 1px solid var(--rule-soft); }
	.g-thumb input { font-size: 0.74rem; padding: 0.34rem 0.45rem; }
	.g-thumb .danger { position: absolute; top: 5px; right: 5px; padding: 0.05rem 0.42rem; line-height: 1.5; border-radius: 7px; }
	.g-none { width: 100%; aspect-ratio: 1; display: grid; place-items: center; background: #f4efe5; border-radius: 9px; color: var(--ink-3); font-size: 1.4rem; }

	/* ---- Tema ---- */
	.theme-picker { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.4rem; }
	.theme-chip {
		display: flex; align-items: center; gap: 0.5rem;
		border: 1px solid var(--rule);
		background: #fff;
		border-radius: 999px;
		padding: 0.42rem 0.9rem 0.42rem 0.55rem;
		cursor: pointer;
		font-size: 0.82rem;
		color: var(--ink-2);
		transition: border-color 0.14s ease, box-shadow 0.14s ease, color 0.14s ease;
	}
	.theme-chip:hover { border-color: var(--brass-lite); }
	.theme-chip.on { border-color: var(--brass); color: var(--bench); font-weight: 600; box-shadow: 0 0 0 3px rgba(169, 118, 43, 0.12); }
	.swatch { width: 18px; height: 18px; border-radius: 50%; flex: none; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12); }
	.swatch[data-t='botanical'] { background: #7d8f6d; }
	.swatch[data-t='midnight'] { background: #14131a; }
	.swatch[data-t='blush'] { background: #c98a86; }
	.swatch[data-t='javanese'] { background: #8a6d3b; }
	.swatch[data-t='minimal'] { background: #3f3f46; }
	.swatch[data-t='baroque'] { background: #6d4b6b; }
	.swatch[data-t='adat-minang'] { background: #7b1e2b; }
	.swatch[data-t='adat-jawa'] { background: #6b4423; }
	.swatch[data-t='rustic-terracotta'] { background: #c65d3b; }
	.swatch[data-t='emerald-luxury'] { background: #0f5132; }
	.swatch[data-t='rose-gold'] { background: #b76e79; }
	.swatch[data-t='dusty-blue'] { background: #5b7c99; }
	.swatch[data-t='sakura'] { background: #d88aa4; }

	.bundle-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap: 0.65rem; margin-top: 0.4rem; }
	.bundle-card {
		position: relative;
		display: flex; align-items: center; gap: 0.6rem;
		border: 1px solid var(--rule);
		background: #fff;
		border-radius: 11px;
		padding: 0.7rem 0.8rem;
		cursor: pointer;
		text-align: left;
		transition: border-color 0.14s ease, transform 0.14s ease, box-shadow 0.14s ease;
	}
	.bundle-card:hover:not(:disabled) { border-color: var(--brass-lite); transform: translateY(-1px); }
	.bundle-card.on { border-color: var(--brass); background: #fffdf6; box-shadow: 0 0 0 3px rgba(169, 118, 43, 0.1); }
	.bundle-card:disabled { opacity: 0.55; cursor: default; }
	.bundle-info { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
	.bundle-info strong { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 1.05rem; font-weight: 600; color: var(--bench); }
	.bundle-info .muted { font-size: 0.72rem; }
	.bundle-tick { margin-left: auto; color: var(--brass); font-weight: 700; opacity: 0; transition: opacity 0.15s ease; }
	.bundle-card.on .bundle-tick { opacity: 1; }

	.cz-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 0.6rem; margin-top: 0.4rem; }
	.cz-token { display: flex; flex-direction: column; gap: 0.3rem; margin: 0; font-size: 0.74rem; }
	.cz-preview {
		border-radius: 12px;
		padding: 1.3rem;
		margin-top: 0.9rem;
		border: 1px dashed var(--rule);
		text-align: center;
	}
	.cz-preview h2 { margin: 0.25rem 0; font-size: 1.9rem; }
	.cz-preview p { margin: 0; font-size: 1.4rem; }
	.cz-preview span { font-size: 0.8rem; letter-spacing: 0.08em; text-transform: uppercase; }

	/* ---- Dekorasi aset lokal ---- */
	.deco-asset-block {
		margin-top: 1.1rem;
		padding-top: 1rem;
		border-top: 1px dashed var(--rule);
	}
	.deco-asset-picker { display: flex; flex-wrap: wrap; gap: 0.55rem; margin-top: 0.4rem; }
	.deco-asset-chip {
		display: flex; flex-direction: column; align-items: center; justify-content: center;
		gap: 0.35rem; border: 1px solid var(--rule); background: #fff; border-radius: 11px;
		padding: 0.5rem; cursor: pointer; font-size: 0.74rem; color: var(--ink-2);
		min-width: 88px; text-align: center;
		transition: border-color 0.14s ease, box-shadow 0.14s ease;
	}
	.deco-asset-chip:hover { border-color: var(--brass-lite); }
	.deco-asset-chip.on { border-color: var(--brass); color: var(--bench); font-weight: 600; box-shadow: 0 0 0 3px rgba(169, 118, 43, 0.1); }
	.deco-asset-thumb {
		width: 100%; height: 50px; object-fit: contain;
		background: #f6f1e6; border: 1px solid var(--rule-soft); border-radius: 7px; padding: 4px;
	}
	.deco-asset-none { font-size: 1.3rem; line-height: 1; color: var(--ink-3); height: 50px; display: flex; align-items: center; }

	/* ---- Pratinjau foto cover ---- */
	.cover-preview { margin-top: 0.9rem; width: 128px; height: 158px; overflow: hidden; background: #efe9db; }
	.cover-preview img { width: 100%; height: 100%; object-fit: cover; }
	.cover-preview.cp-plain,
	.cover-preview.cp-circle { border-radius: 50%; width: 128px; height: 128px; }
	.cover-preview.cp-frame { border-radius: 10px; border: 3px solid #fff; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18); }
	.cover-preview.cp-shadow { border-radius: 6px; box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3); }
	.cover-preview.cp-polaroid { padding: 6px 6px 22px; background: #fff; border-radius: 2px; }
	.cover-preview.cp-arch { border-radius: 50% 50% 8px 8px / 34% 34% 8px 8px; border: 3px solid var(--brass); }
	.cover-preview.cp-circle { border: 3px solid var(--brass); }

	/* ---- Efek premium ---- */
	.fx-card .card-head { background: linear-gradient(180deg, #fffdf8, #fbf7ee); }
	.fx-badge {
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #7a5a2a;
		background: linear-gradient(150deg, #f6e7c4, #efd9a6);
		border: 1px solid #e5cf9c;
		border-radius: 999px;
		padding: 0.2rem 0.6rem;
	}
	.fx-master { margin-top: 0.2rem; font-weight: 600; color: var(--ink); }
	.fx-master input { accent-color: var(--brass); }
	.fx-row { margin-top: 0.9rem; }
	.fx-row-head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.8rem; margin-bottom: 0.4rem; }
	.fx-label { font-size: 0.78rem; font-weight: 600; color: var(--ink-2); letter-spacing: 0.01em; }
	.fx-pill {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--brass);
		background: #f6efe0;
		border-radius: 999px;
		padding: 0.12rem 0.55rem;
	}
	.fx-scale { display: flex; flex-wrap: wrap; gap: 0.4rem; }
	.fx-seg {
		border: 1px solid var(--rule);
		background: #fff;
		border-radius: 999px;
		padding: 0.36rem 0.9rem;
		font-size: 0.8rem;
		color: var(--ink-2);
		cursor: pointer;
		transition: border-color 0.14s ease, background 0.14s ease, color 0.14s ease, box-shadow 0.14s ease;
	}
	.fx-seg:hover { border-color: var(--brass-lite); }
	.fx-seg.on {
		border-color: var(--brass);
		background: #fffdf6;
		color: var(--bench);
		font-weight: 600;
		box-shadow: 0 0 0 3px rgba(169, 118, 43, 0.12);
	}
	.fx-toggles { display: flex; flex-direction: column; }
	.fx-toggles .check { align-items: flex-start; }
	.fx-toggles .check span { line-height: 1.45; }
	.fx-toggles .check strong { color: var(--ink); }
	.fx-sub {
		margin: 0.4rem 0 0 1.7rem;
		padding: 0.6rem 0.75rem;
		border-left: 2px solid var(--rule);
		background: #fdfbf6;
		border-radius: 0 9px 9px 0;
	}
	.fx-filter-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 0.5rem; }
	.fx-filter {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid var(--rule);
		background: #fff;
		border-radius: 10px;
		padding: 0.4rem;
		cursor: pointer;
		transition: border-color 0.14s ease, box-shadow 0.14s ease;
	}
	.fx-filter:hover { border-color: var(--brass-lite); }
	.fx-filter.on { border-color: var(--brass); box-shadow: 0 0 0 3px rgba(169, 118, 43, 0.12); }
	.fx-filter-thumb {
		width: 100%;
		aspect-ratio: 4 / 3;
		overflow: hidden;
		border-radius: 7px;
		background: linear-gradient(135deg, #c9b18a, #8f9c7f 55%, #7b6a56);
		position: relative;
	}
	.fx-filter-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
	.fx-filter-demo { position: absolute; inset: 0; }
	.fx-filter-name { font-size: 0.72rem; font-weight: 500; color: var(--ink-2); }
	.fx-filter.on .fx-filter-name { color: var(--bench); font-weight: 600; }
	/* Pratinjau filter (thumbnail) — cermin dari style.css halaman tamu. */
	.fx-filter-thumb[data-filter='warm'] { filter: sepia(0.25) saturate(1.15) brightness(1.05); }
	.fx-filter-thumb[data-filter='cool'] { filter: saturate(1.05) hue-rotate(180deg) brightness(1.02); }
	.fx-filter-thumb[data-filter='mono'] { filter: grayscale(1) contrast(1.05); }
	.fx-filter-thumb[data-filter='vintage'] { filter: sepia(0.45) contrast(0.95) brightness(1.02) saturate(0.85); }
	.fx-filter-thumb[data-filter='vivid'] { filter: saturate(1.4) contrast(1.1); }
	.fx-filter-thumb[data-filter='soft'] { filter: brightness(1.08) contrast(0.92) saturate(0.95) blur(0.4px); }
	.fx-reset { margin-top: 1rem; }

	/* ---- Gradasi premium ---- */
	.gr-style-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 0.5rem; }
	.gr-style {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		border: 1px solid var(--rule);
		background: #fff;
		border-radius: 10px;
		padding: 0.55rem 0.4rem;
		cursor: pointer;
		text-align: center;
		transition: border-color 0.14s ease, box-shadow 0.14s ease, background 0.14s ease;
	}
	.gr-style:hover { border-color: var(--brass-lite); }
	.gr-style.on {
		border-color: var(--brass);
		background: #fffdf6;
		box-shadow: 0 0 0 3px rgba(169, 118, 43, 0.12);
	}
	.gr-style-icon { font-size: 1.1rem; line-height: 1; }
	.gr-style-name { font-size: 0.78rem; font-weight: 600; color: var(--ink-2); }
	.gr-style.on .gr-style-name { color: var(--bench); }
	.gr-style-hint { font-size: 0.66rem; color: var(--ink-soft, #8a8175); line-height: 1.3; }
	.gr-color-row { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.35rem; }
	.gr-color-row input[type='color'] { width: 3rem; height: 2.2rem; padding: 0; border: 1px solid var(--rule); border-radius: 8px; background: #fff; cursor: pointer; }
	.gr-color-text { flex: 1; min-width: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

	/* ---- Daftar & tabel ---- */
	.list-row {
		display: flex; justify-content: space-between; align-items: center; gap: 0.8rem;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--rule-soft);
	}
	.list-row:last-child { border-bottom: 0; }
	.list-row.wish { align-items: flex-start; }
	.list-row p { margin: 0.25rem 0 0; font-size: 0.87rem; color: var(--ink-2); line-height: 1.5; }
	.acts { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; }

	.table-wrap { overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
	th,
	td { text-align: left; padding: 0.6rem 0.55rem; border-bottom: 1px solid var(--rule-soft); }
	th {
		color: var(--ink-3);
		font-weight: 600;
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		border-bottom: 1px solid var(--rule);
	}
	tbody tr:hover { background: #fdfbf6; }
	td .slug { font-size: 0.74rem; }
	.pill {
		display: inline-block;
		padding: 0.1rem 0.55rem;
		border-radius: 999px;
		background: #f1ead9;
		color: #7a5a2a;
		font-size: 0.75rem;
		font-weight: 600;
	}

	/* Info akun sebagai daftar definisi */
	.facts { margin: 0; display: flex; flex-direction: column; }
	.facts > div {
		display: flex; justify-content: space-between; gap: 1rem;
		padding: 0.6rem 0; border-bottom: 1px solid var(--rule-soft);
	}
	.facts > div:last-child { border-bottom: 0; }
	.facts dt { color: var(--ink-3); font-size: 0.82rem; }
	.facts dd { margin: 0; font-weight: 600; color: var(--ink); font-size: 0.86rem; }

	/* ---- Simpan lengket: pil mengambang, tidak menutupi kolom form ---- */
	.sticky-save {
		position: sticky;
		bottom: 1rem;
		margin-top: 0.4rem;
		display: flex;
		justify-content: flex-end;
		pointer-events: none;
		z-index: 5;
	}
	.sticky-save .btn {
		pointer-events: auto;
		border-radius: 999px;
		padding: 0.72rem 1.6rem;
		box-shadow: 0 2px 0 0 #000, 0 16px 34px -14px rgba(20, 18, 16, 0.75);
	}

	/* ---- Toast ---- */
	.toast {
		position: fixed;
		bottom: 1.4rem;
		left: 50%;
		transform: translateX(-50%);
		background: var(--bench);
		color: #fdf7ea;
		padding: 0.75rem 1.4rem;
		border-radius: 999px;
		font-size: 0.85rem;
		font-weight: 500;
		z-index: 100;
		border: 1px solid var(--brass);
		box-shadow: 0 16px 40px -14px rgba(20, 18, 16, 0.6);
		animation: toast-in 0.22s ease;
	}
	@keyframes toast-in { from { opacity: 0; transform: translate(-50%, 8px); } }

	/* ---------- Tab Impor JSON ---------- */
	.imp-summary { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.55rem; margin-bottom: 1rem; }
	.imp-kv {
		background: #fdfbf6;
		border: 1px solid var(--rule-soft);
		border-radius: 9px;
		padding: 0.5rem 0.7rem;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.imp-kv span { font-size: 0.68rem; color: var(--ink-3); letter-spacing: 0.05em; text-transform: uppercase; }
	.imp-kv strong { font-size: 0.88rem; color: var(--bench); word-break: break-word; }
	.imp-report {
		display: flex; flex-direction: column; gap: 0.12rem;
		max-height: 340px; overflow-y: auto;
		border: 1px solid var(--rule-soft); border-radius: 10px; padding: 0.5rem;
		background: #fdfbf6;
	}
	.imp-line { display: flex; align-items: center; gap: 0.5rem; padding: 0.32rem 0.4rem; border-bottom: 1px solid var(--rule-soft); font-size: 0.79rem; }
	.imp-line:last-child { border-bottom: 0; }
	.imp-val { color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 45%; }
	.badge-status { font-size: 0.68rem; font-weight: 600; padding: 2px 8px; border-radius: 999px; white-space: nowrap; background: #eee; color: #555; }
	.badge-status.st-ok { background: #e3f3e8; color: #1f7a45; }
	.badge-status.st-review { background: #fdf2d6; color: #9a6b00; }
	.badge-status.st-skip { background: #eceff1; color: #607d8b; }
	.badge-status.st-error { background: #fbe3e3; color: #b02a2a; }
	.imp-done { border-color: #bfe0c8; background: #f4fbf6; }
	.imp-done .card-head { border-bottom-color: #d5eddd; }
	.imp-done h2 { color: #1f7a45; }

	/* ============================================================
	   RESPONSIVE — rel menjadi bar atas, tab jadi gulir mendatar
	   ============================================================ */
	@media (max-width: 900px) {
		.bench { grid-template-columns: 1fr; }
		.rail {
			position: static;
			height: auto;
			flex-direction: column;
			gap: 0.85rem;
			padding: 0.95rem 1rem 0.85rem;
			overflow: visible;
		}
		.rail-tabs {
			flex-direction: row;
			flex: none;
			min-height: 0;
			overflow-x: auto;
			overflow-y: hidden;
			gap: 0.25rem;
			padding-bottom: 0.2rem;
			scrollbar-width: thin;
		}
		.rail-tabs button { white-space: nowrap; padding: 0.45rem 0.7rem; }
		.rail-tabs button.on::before { left: 12%; right: 12%; top: auto; bottom: 0; width: auto; height: 2px; }
		.rail-brand strong { font-size: 1.1rem; }
		.rail-foot { margin-top: 0; flex-direction: row; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.6rem; border-top: 1px solid var(--bench-line); padding-top: 0.75rem; }
		.rail-acts { flex-direction: row; }
		.rail .ghost { text-align: center; }
		.rail-theme { padding: 0.4rem 0.55rem; }
		.surface-head { display: none; }
		.board { padding: 1.2rem 1rem 3rem; }
		.stats { grid-template-columns: repeat(2, 1fr); }
		.gate { grid-template-columns: 1fr; }
		.gate-aside { min-height: 34vh; padding: 2.2rem 1.6rem; justify-content: flex-end; }
		.gate-aside::before { inset: 1rem; }
		.gate-form { padding: 1.8rem 1.4rem; }
	}
	@media (max-width: 600px) {
		.grid2 { grid-template-columns: 1fr; }
		.board { padding: 1rem 0.8rem 3rem; }
		.card-head { padding: 0.9rem 1rem 0.75rem; flex-wrap: wrap; }
		.card-body { padding: 1rem 1rem 1.2rem; }
		.stats { gap: 0.6rem; }
		.stat { padding: 0.9rem 1rem; }
		.stat strong { font-size: 2rem; }
		.item { padding: 0.8rem; gap: 0.6rem; }
		.sticky-save { justify-content: stretch; bottom: 0.7rem; }
		.sticky-save .btn { width: 100%; }
	}

	@media (prefers-reduced-motion: reduce) {
		*, *::before, *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
	}
</style>
