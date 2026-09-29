<script lang="ts">
	import { onMount } from 'svelte';
	import type { CustomTheme } from '$lib/types';

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
	const BG_POS = ['center center', 'top center', 'bottom center', 'center left', 'center right', 'top left', 'top right', 'bottom left', 'bottom right'];
	const BG_SIZE = ['cover', 'contain', 'auto', '100% 100%'];
	const BG_REPEAT = ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'];
	const BG_ATTACH = ['scroll', 'fixed'];

	const tabs = [
		{ id: 'dashboard', label: 'Dasbor' },
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
			authed = true;
			await loadAll();
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
</script>

<svelte:head><title>Admin — {slug}</title></svelte:head>

{#if toast}
	<div class="toast">{toast}</div>
{/if}

{#if !ready}
	<div class="center">Memuat…</div>
{:else if !authed}
	<!-- ================= LOGIN ================= -->
	<div class="login-wrap">
		<form class="login-card" onsubmit={(e) => { e.preventDefault(); doLogin(); }}>
			<h1>Admin Undangan</h1>
			<p class="sub">Masuk untuk mengelola undangan</p>
			<label for="pw">Password</label>
			<input
				id="pw"
				type="password"
				bind:value={password}
				placeholder="Password admin"
				onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doLogin(); } }}
			/>
			{#if loginErr}<p class="err">{loginErr}</p>{/if}
			<button type="button" class="btn" disabled={loading} onclick={() => doLogin()}>{loading ? 'Memproses…' : 'Masuk'}</button>
			<a class="link" href={`/u/${slug}`}>← Lihat undangan</a>
		</form>
	</div>
{:else}
	<!-- ================= DASHBOARD ================= -->
	<header class="topbar">
		<div class="brand">
			<strong>{accountTitle || slug}</strong>
			<span class="badge">{content.account.theme}</span>
		</div>
		<div class="acts">
			<a class="ghost" href={`/u/${slug}`} target="_blank">Lihat</a>
			<button class="ghost" onclick={logout}>Keluar</button>
		</div>
	</header>

	<nav class="tabs">
		{#each tabs as t}
			<button class:on={tab === t.id} onclick={() => (tab = t.id)}>{t.label}</button>
		{/each}
	</nav>

	<main class="wrap">
		{#if tab === 'dashboard'}
			<div class="stats">
				<div class="stat"><strong>{rsvp.stats?.total ?? 0}</strong><span>Total RSVP</span></div>
				<div class="stat"><strong>{rsvp.stats?.hadir ?? 0}</strong><span>Hadir</span></div>
				<div class="stat"><strong>{rsvp.stats?.total_pax ?? 0}</strong><span>Total Tamu</span></div>
				<div class="stat"><strong>{guests.length}</strong><span>Daftar Tamu</span></div>
			</div>
			<div class="card">
				<h3>Selamat datang 👋</h3>
				<p>Kelola konten, tampilan, tema, tamu, dan RSVP dari panel ini. Perubahan langsung tampil di undangan.</p>
				<button class="btn" onclick={() => (tab = 'konten')}>Mulai Edit Konten</button>
			</div>
		{:else if tab === 'konten'}
			<div class="card">
				<h3>Judul Undangan</h3>
				<label for="title">Judul</label>
				<input id="title" bind:value={accountTitle} placeholder="Mis. Rizky & Amelia" />
			</div>

			<div class="card">
				<h3>Mempelai</h3>
				<div class="grid2">
					<div>
						<h4>Mempelai Pria</h4>
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
					</div>
					<div>
						<h4>Mempelai Wanita</h4>
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
					</div>
				</div>
				<label for="ls">Cerita Cinta</label>
				<textarea id="ls" rows="4" bind:value={couple.love_story}></textarea>
			</div>

			<div class="card">
				<div class="card-head"><h3>Acara</h3><button class="ghost sm" onclick={addEvent}>+ Tambah</button></div>
				{#each events as e, i}
					<div class="item">
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
						<button class="danger sm" onclick={() => delEvent(i)}>Hapus acara</button>
					</div>
				{/each}
			</div>

			<div class="card">
				<div class="card-head"><h3>Galeri</h3></div>
				<input type="file" accept="image/*" multiple onchange={onGalleryUpload} />
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

			<div class="card">
				<div class="card-head"><h3>Amplop Digital</h3><button class="ghost sm" onclick={addGift}>+ Tambah</button></div>
				{#each gifts as g, i}
					<div class="item">
						<div class="grid2">
							<select bind:value={g.type}><option value="bank">Bank</option><option value="ewallet">E-Wallet</option></select>
							<input bind:value={g.bank_name} placeholder="Nama bank / e-wallet" />
						</div>
						<div class="grid2">
							<input bind:value={g.account_no} placeholder="Nomor rekening" />
							<input bind:value={g.account_name} placeholder="Atas nama" />
						</div>
						<button class="danger sm" onclick={() => delGift(i)}>Hapus</button>
					</div>
				{/each}
				<label for="qris">QRIS (upload)</label>
				<input id="qris" type="file" accept="image/*" onchange={onQrisUpload} />
				{#if settings.qris_image}<p class="muted">QRIS: {settings.qris_image}</p>{/if}
				<label for="ga">Alamat kirim hadiah</label>
				<textarea id="ga" rows="2" bind:value={settings.gift_address}></textarea>
			</div>

			<div class="card">
				<h3>Fitur Tambahan</h3>
				<label for="vid">Video (URL YouTube/Vimeo/MP4)</label>
				<input id="vid" bind:value={settings.video_url} placeholder="https://youtube.com/watch?v=…" />
				<label for="live">Live Streaming (URL)</label>
				<input id="live" bind:value={settings.live_url} placeholder="https://instagram.com/…" />
				<label for="lt">Keterangan Live</label>
				<input id="lt" bind:value={settings.live_text} />
				<label for="quote">Kutipan / Ayat</label>
				<textarea id="quote" rows="2" bind:value={settings.quote}></textarea>
			</div>

			<div class="sticky-save"><button class="btn" onclick={saveContent} disabled={loading}>{loading ? 'Menyimpan…' : 'Simpan Semua Perubahan'}</button></div>
		{:else if tab === 'tampilan'}
			<div class="card">
				<h3>Latar Belakang — Desktop</h3>
				<input type="file" accept="image/*" onchange={(e) => onBgUpload(e, 'background_image')} />
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

			<div class="card">
				<h3>Latar Belakang — Mobile</h3>
				<input type="file" accept="image/*" onchange={(e) => onBgUpload(e, 'background_image_mobile')} />
				<label for="bim">Atau URL gambar</label>
				<input id="bim" bind:value={settings.background_image_mobile} placeholder="https://…" />
				<div class="grid2">
					<div><label for="bpm">Posisi</label><select id="bpm" bind:value={settings.background_position_mobile}>{#each BG_POS as p}<option>{p}</option>{/each}</select></div>
					<div><label for="bsm">Ukuran</label><select id="bsm" bind:value={settings.background_size_mobile}>{#each BG_SIZE as p}<option>{p}</option>{/each}</select></div>
				</div>
			</div>

			<div class="card">
				<h3>Overlay & Warna Latar</h3>
				<div class="grid2">
					<div><label for="ovc">Warna overlay</label><input type="color" id="ovc" bind:value={settings.background_overlay} /></div>
					<div><label for="ovo">Opasitas ({settings.background_overlay_opacity})</label><input type="range" id="ovo" min="0" max="1" step="0.05" bind:value={settings.background_overlay_opacity} /></div>
				</div>
			</div>

			<div class="card">
				<h3>Musik Latar</h3>
				<input type="file" accept="audio/*" onchange={onMusicUpload} />
				<label for="mu">Atau URL musik</label>
				<input id="mu" bind:value={settings.music_url} placeholder="https://….mp3" />
				{#if settings.music_url}<audio src={settings.music_url} controls style="margin-top:.6rem;width:100%"></audio>{/if}
			</div>

			<div class="card">
				<h3>📸 Foto &amp; Bingkai Cover</h3>
				<p class="muted">Pilih cara menampilkan foto di halaman pembuka undangan.</p>
				<label for="cmode">Gaya bingkai foto</label>
				<select id="cmode" bind:value={settings.cover_mode}>
					{#each COVER_MODES as m}<option value={m.v}>{m.l}</option>{/each}
				</select>
				<label for="cphoto">URL foto cover {settings.cover_mode === 'none' ? '(nonaktif)' : ''}</label>
				<input id="cphoto" bind:value={settings.cover_photo} placeholder="https://…/foto.jpg" disabled={settings.cover_mode === 'none'} />
				<div class="acts">
					<button class="ghost sm" disabled={settings.cover_mode === 'none'} onclick={() => pickCoverUpload()}>⬆ Unggah foto cover</button>
				</div>
				{#if settings.cover_photo}
					<div class="cover-preview cp-{settings.cover_mode}">
						<img src={settings.cover_photo} alt="Pratinjau foto cover" />
					</div>
				{/if}
			</div>

			<div class="card">
				<h3>🌸 Dekorasi &amp; Animasi</h3>
				<p class="muted">Dekorasi bergerak membuat undangan lebih hidup.</p>
				<label for="deco">Jenis dekorasi</label>
				<select id="deco" bind:value={settings.decoration}>
					{#each DECORATIONS as d}<option value={d.v}>{d.l}</option>{/each}
				</select>
				<label class="check">
					<input type="checkbox" checked={settings.decoration_animated === '1'} onchange={(e) => (settings.decoration_animated = e.currentTarget.checked ? '1' : '0')} />
					Aktifkan animasi dekorasi (daun/bunga berayun)
				</label>
			</div>

			<div class="card">
				<h3>Watermark</h3>
				<label class="check"><input type="checkbox" checked={settings.watermark_enabled === '1'} onchange={(e) => (settings.watermark_enabled = e.currentTarget.checked ? '1' : '')} /> Tampilkan watermark</label>
				<label for="wt">Teks watermark</label>
				<input id="wt" bind:value={settings.watermark_text} placeholder="Undangan Digital" />
			</div>

			<div class="sticky-save"><button class="btn" onclick={saveContent} disabled={loading}>Simpan Tampilan</button></div>
		{:else if tab === 'tema'}
			<div class="card">
				<h3>Preset Tema</h3>
				<div class="theme-picker">
					{#each THEMES as t}
						<button class="theme-chip" class:on={content.account.theme === t} onclick={() => setTheme(t)}>
							<span class="swatch" data-t={t}></span>{THEME_LABELS[t] || t}
						</button>
					{/each}
				</div>
			</div>

			<div class="card">
				<h3>✨ Buat Tema Sendiri</h3>
				<label for="czn">Nama tema</label>
				<input id="czn" bind:value={czName} />
				<label for="czb">Basis preset</label>
				<select id="czb" bind:value={czBase}>{#each THEMES as t}<option>{t}</option>{/each}</select>

				<h4>Warna</h4>
				<div class="cz-grid">
					{#each TOKENS as tk}
						<label>{tk.l}
							<input type="color" bind:value={czTokens[tk.k]} oninput={() => { if (!czTokens[tk.k]) czTokens[tk.k] = '#000000'; }} />
						</label>
					{/each}
				</div>

				<h4>Font</h4>
				<div class="grid2">
					<div><label for="fs">Judul (serif)</label><select id="fs" bind:value={czTokens['--serif']}>{#each FONTS_SERIF as f}<option value={f}>{f}</option>{/each}</select></div>
					<div><label for="fsc">Skrip</label><select id="fsc" bind:value={czTokens['--script']}>{#each FONTS_SCRIPT as f}<option value={f}>{f}</option>{/each}</select></div>
				</div>

				<div class="cz-preview" style:background={czTokens['--cream'] || '#f7f4ec'} style:color={czTokens['--ink'] || '#33352e'}>
					<span style:color={czTokens['--gold'] || '#b08d47'}>Contoh Warna Emas</span>
					<h2 style:color={czTokens['--sage-dark'] || '#57684a'} style:font-family={czTokens['--serif'] || 'Cormorant Garamond'}>
						Rizky & Amelia
					</h2>
					<p style:font-family={czTokens['--script'] || 'Great Vibes'}>Undangan Pernikahan</p>
				</div>

				<button class="btn" onclick={saveTheme}>{editingThemeId ? 'Perbarui Tema' : 'Simpan Sebagai Tema'}</button>
				{#if editingThemeId}<button class="ghost" onclick={() => fillCustomizer()}>Batal</button>{/if}
			</div>

			{#if themes.length}
				<div class="card">
					<h3>Tema Tersimpan</h3>
					{#each themes as t}
						<div class="theme-row">
							<div><strong>{t.name}</strong><span class="muted"> (basis: {t.base})</span></div>
							<div class="acts">
								<button class="ghost sm" onclick={() => useTheme(t.slug)}>Pakai</button>
								<button class="ghost sm" onclick={() => fillCustomizer(t)}>Edit</button>
								<button class="danger sm" onclick={() => delTheme(t.id)}>Hapus</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{:else if tab === 'tamu'}
			<div class="card">
				<h3>Tambah Tamu</h3>
				<div class="grid2">
					<input bind:value={gName} placeholder="Nama tamu" />
					<input bind:value={gPhone} placeholder="No. HP (opsional)" />
				</div>
				<div class="grid2">
					<input bind:value={gCat} placeholder="Kategori (Keluarga/Teman)" />
					<input type="number" bind:value={gQuota} min="1" max="50" placeholder="Kuota" />
				</div>
				<button class="btn" onclick={addGuest}>Tambah Tamu</button>
			</div>
			<div class="card">
				<h3>Daftar Tamu ({guests.length})</h3>
				<table>
					<thead><tr><th>Nama</th><th>Kategori</th><th>Kuota</th><th>RSVP</th><th></th></tr></thead>
					<tbody>
						{#each guests as g}
							<tr>
								<td>{g.name}<br /><span class="muted">/{g.slug}</span></td>
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
		{:else if tab === 'rsvp'}
			<div class="stats">
				<div class="stat"><strong>{rsvp.stats?.hadir ?? 0}</strong><span>Hadir</span></div>
				<div class="stat"><strong>{rsvp.stats?.tidak_hadir ?? 0}</strong><span>Tidak Hadir</span></div>
				<div class="stat"><strong>{rsvp.stats?.ragu ?? 0}</strong><span>Ragu</span></div>
				<div class="stat"><strong>{rsvp.stats?.total_pax ?? 0}</strong><span>Total Orang</span></div>
			</div>
			<div class="card">
				<h3>Daftar Konfirmasi</h3>
				<table>
					<thead><tr><th>Nama</th><th>Status</th><th>Jml</th><th>Pesan</th></tr></thead>
					<tbody>
						{#each rsvp.rows as r}
							<tr><td>{r.name}</td><td>{r.attendance}</td><td>{r.pax}</td><td>{r.message || '-'}</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else if tab === 'ucapan'}
			<div class="card">
				<div class="card-head">
					<h3>Ucapan &amp; Doa ({wishes.length})</h3>
					<button class="ghost sm" onclick={() => exportCsv('wishes')}>Ekspor CSV</button>
				</div>
				{#each wishes as w}
					<div class="wish-row">
						<div><strong>{w.name}</strong> <span class="muted">· {new Date(w.created_at).toLocaleDateString('id-ID')}</span><p>{w.message}</p></div>
						<button class="danger sm" onclick={() => delWish(w.id)}>Hapus</button>
					</div>
				{/each}
			</div>
		{:else if tab === 'pengaturan'}
			<div class="card">
				<h3>Ekspor Data</h3>
				<p class="muted">Unduh data dalam format CSV (bisa dibuka di Excel).</p>
				<div class="acts">
					<button class="ghost sm" onclick={() => exportCsv('rsvp')}>RSVP (.csv)</button>
					<button class="ghost sm" onclick={() => exportCsv('guests')}>Tamu (.csv)</button>
					<button class="ghost sm" onclick={() => exportCsv('wishes')}>Ucapan (.csv)</button>
				</div>
			</div>
			<div class="card">
				<h3>Ganti Password Admin</h3>
				<label for="nap">Password baru</label>
				<input id="nap" type="password" bind:value={newAdminPw} placeholder="Minimal 5 karakter" />
				<button class="btn" onclick={changeAdminPw}>Ganti Password</button>
			</div>
			<div class="card">
				<h3>Info Akun</h3>
				<p class="muted">Slug: <strong>{slug}</strong></p>
				<p class="muted">Tema aktif: <strong>{content.account.theme}</strong></p>
				<p class="muted">Status: <strong>{content.account.status}</strong></p>
				<p class="muted">Masa aktif s/d: <strong>{content.account.expires_at ? new Date(content.account.expires_at).toLocaleDateString('id-ID') : 'tanpa batas'}</strong></p>
			</div>
		{/if}
	</main>
{/if}

<style>
	:global(body) { background: #f4f2ec; }
	.wrap { max-width: 900px; margin: 0 auto; padding: 1.2rem; }
	.center { display: grid; place-items: center; min-height: 100vh; color: #666; }
	.login-wrap { display: grid; place-items: center; min-height: 100vh; padding: 1rem; }
	.login-card { background: #fff; border-radius: 16px; padding: 2rem; width: 100%; max-width: 380px; box-shadow: 0 20px 50px -20px rgba(0,0,0,.3); display: flex; flex-direction: column; gap: .4rem; }
	.login-card h1 { font-size: 1.5rem; margin: 0; }
	.sub { color: #777; font-size: .85rem; margin: 0 0 .6rem; }
	.err { color: #c0392b; font-size: .82rem; }
	.link { font-size: .82rem; color: #888; margin-top: .5rem; text-align: center; }

	.topbar { display: flex; justify-content: space-between; align-items: center; background: #1f3d2b; color: #fff; padding: .9rem 1.2rem; position: sticky; top: 0; z-index: 20; }
	.brand { display: flex; align-items: center; gap: .6rem; }
	.badge { background: rgba(255,255,255,.18); border-radius: 999px; padding: 2px 10px; font-size: .7rem; }
	.acts { display: flex; gap: .4rem; align-items: center; }
	.ghost { background: transparent; border: 1px solid currentColor; border-radius: 8px; padding: .35rem .8rem; font-size: .78rem; cursor: pointer; color: inherit; }
	.ghost.sm, .danger.sm { padding: .25rem .6rem; font-size: .72rem; }
	.danger { background: #c0392b; color: #fff; border: 0; border-radius: 8px; padding: .4rem .8rem; cursor: pointer; }
	.btn { background: #1f3d2b; color: #fff; border: 0; border-radius: 10px; padding: .7rem 1.3rem; font-size: .88rem; cursor: pointer; }
	.btn:disabled { opacity: .6; }

	.tabs { display: flex; gap: .3rem; overflow-x: auto; padding: .6rem 1.2rem; background: #fff; border-bottom: 1px solid #e5e2da; position: sticky; top: 58px; z-index: 15; }
	.tabs button { background: transparent; border: 0; padding: .5rem .9rem; border-radius: 8px; cursor: pointer; font-size: .82rem; color: #666; white-space: nowrap; }
	.tabs button.on { background: #1f3d2b; color: #fff; }

	.card { background: #fff; border-radius: 14px; padding: 1.3rem; margin-bottom: 1rem; box-shadow: 0 4px 20px -12px rgba(0,0,0,.2); display: flex; flex-direction: column; gap: .4rem; }
	.card h3 { margin: 0 0 .3rem; font-size: 1.1rem; }
	.card h4 { margin: .6rem 0 .2rem; font-size: .9rem; color: #444; }
	.card-head { display: flex; justify-content: space-between; align-items: center; }
	label { font-size: .76rem; color: #666; margin-top: .3rem; text-transform: uppercase; letter-spacing: .04em; }
	input, select, textarea { width: 100%; padding: .55rem .7rem; border: 1px solid #ddd; border-radius: 8px; font-family: inherit; font-size: .88rem; background: #fbfaf7; }
	input[type='color'] { height: 40px; padding: 2px; }
	input[type='range'] { padding: 0; }
	.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: .6rem; }
	@media (max-width: 600px) { .grid2 { grid-template-columns: 1fr; } }
	.row { display: flex; gap: .5rem; }
	.item { border: 1px solid #eee; border-radius: 10px; padding: .8rem; margin: .4rem 0; display: flex; flex-direction: column; gap: .5rem; background: #faf9f6; }
	.check { flex-direction: row; display: flex; gap: .5rem; align-items: center; text-transform: none; }
	.check input { width: auto; }

	.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: .7rem; margin-bottom: 1rem; }
	@media (max-width: 600px) { .stats { grid-template-columns: repeat(2, 1fr); } }
	.stat { background: #fff; border-radius: 12px; padding: 1rem; text-align: center; box-shadow: 0 4px 16px -12px rgba(0,0,0,.2); }
	.stat strong { display: block; font-size: 1.7rem; color: #1f3d2b; }
	.stat span { font-size: .72rem; color: #888; }

	.gallery-edit { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: .6rem; }
	.g-thumb { position: relative; }
	.g-thumb img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; }
	.g-thumb input { font-size: .72rem; padding: .3rem; }
	.g-thumb .danger { position: absolute; top: 2px; right: 2px; padding: 0 .4rem; }

	.theme-picker { display: flex; flex-wrap: wrap; gap: .5rem; }
	.theme-chip { display: flex; align-items: center; gap: .5rem; border: 2px solid #ddd; background: #fff; border-radius: 10px; padding: .5rem .9rem; cursor: pointer; text-transform: capitalize; font-size: .82rem; }
	.theme-chip.on { border-color: #1f3d2b; }
	.swatch { width: 18px; height: 18px; border-radius: 50%; }
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
	/* Pratinjau foto cover */
	.cover-preview { margin-top: .8rem; width: 120px; height: 150px; overflow: hidden; background: #efe9db; }
	.cover-preview img { width: 100%; height: 100%; object-fit: cover; }
	.cover-preview.cp-plain, .cover-preview.cp-circle { border-radius: 50%; width: 120px; height: 120px; }
	.cover-preview.cp-frame { border-radius: 10px; border: 3px solid #fff; box-shadow: 0 6px 16px rgba(0,0,0,.18); }
	.cover-preview.cp-shadow { border-radius: 6px; box-shadow: 0 10px 24px rgba(0,0,0,.3); }
	.cover-preview.cp-polaroid { padding: 6px 6px 22px; background: #fff; border-radius: 2px; }
	.cover-preview.cp-arch { border-radius: 50% 50% 8px 8px / 34% 34% 8px 8px; border: 3px solid #b08d47; }
	.cover-preview.cp-circle { border: 3px solid #b08d47; }

	.cz-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: .6rem; }
	.cz-preview { border-radius: 12px; padding: 1rem; margin-top: .8rem; border: 1px dashed #ccc; text-align: center; }
	.cz-preview h2 { margin: .2rem 0; font-size: 1.8rem; }
	.theme-row { display: flex; justify-content: space-between; align-items: center; padding: .5rem 0; border-bottom: 1px solid #f0eee8; }
	.muted { color: #999; font-size: .78rem; }
	.wish-row { display: flex; justify-content: space-between; gap: .6rem; padding: .6rem 0; border-bottom: 1px solid #f0eee8; align-items: start; }
	.wish-row p { margin: .2rem 0 0; font-size: .85rem; color: #444; }

	table { width: 100%; border-collapse: collapse; font-size: .82rem; }
	th, td { text-align: left; padding: .5rem .4rem; border-bottom: 1px solid #f0eee8; }
	th { color: #888; font-weight: 600; font-size: .72rem; text-transform: uppercase; }

	.sticky-save { position: sticky; bottom: 0; background: rgba(244,242,236,.92); backdrop-filter: blur(8px); padding: .8rem 0; text-align: right; }
	.toast { position: fixed; bottom: 1.2rem; left: 50%; transform: translateX(-50%); background: #1f3d2b; color: #fff; padding: .7rem 1.4rem; border-radius: 999px; font-size: .85rem; z-index: 100; box-shadow: 0 10px 30px -10px rgba(0,0,0,.4); }
</style>
