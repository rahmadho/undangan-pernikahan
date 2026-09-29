<script lang="ts">
	import { onMount } from 'svelte';
	import type { InvitationData } from '$lib/types';
	import { applyTheme, applyBackground, initReveal } from '$lib/theme';
	import Ornament from '$lib/components/Ornament.svelte';
	import CoverPhoto from '$lib/components/CoverPhoto.svelte';

	let { data }: { data: InvitationData & { guest?: string } } = $props();

	const s = data.settings;
	const couple = data.couple;
	const events = data.events;
	const gallery = data.gallery;
	const gifts = data.gifts;

	// ---------- Opsi foto & dekorasi cover (fitur baru) ----------
	const coverMode = $derived(s.cover_mode || 'plain');
	const coverPhoto = $derived(s.cover_photo || '');
	const decoration = $derived(s.decoration || 'floral');
	const decoAnimated = $derived(s.decoration_animated !== '0');

	// Pilih variant ornamen sesuai jenis dekorasi
	const decoVariantTL = $derived(
		decoration === 'ethnic-jawa'
			? 'corner-adat'
			: decoration === 'ethnic-minang'
				? 'songket'
				: decoration === 'leaves-sway'
					? 'leaf-vine'
					: 'corner'
	);
	const decoVariantTR = $derived(
		decoration === 'ethnic-jawa' ? 'batik-kawung' : decoration === 'ethnic-minang' ? 'songket' : 'corner'
	);

	// ---------- State ----------
	let opened = $state(false); // cover sudah dibuka?
	let guestName = $state(''); // nama tamu dari ?to=
	let cd = $state({ d: 0, h: 0, m: 0, s: 0, done: false });
	let musicOn = $state(false);
	let audioEl: HTMLAudioElement | undefined = $state();
	let wishesList = $state([...data.wishes]);
	let wishName = $state('');
	let wishMsg = $state('');
	let wishBusy = $state(false);

	// RSVP
	let rsvpName = $state('');
	let rsvpAtt = $state('hadir');
	let rsvpPax = $state(1);
	let rsvpMsg = $state('');
	let rsvpBusy = $state(false);
	let rsvpDone = $state(false);

	// Galeri lightbox
	let lbSrc = $state<string | null>(null);

	// Nav aktif
	let active = $state('home');

	const sections = [
		{ id: 'home', label: 'Awal', icon: '⌂' },
		{ id: 'mempelai', label: 'Mempelai', icon: '♡' },
		{ id: 'acara', label: 'Acara', icon: '▤' },
		{ id: 'galeri', label: 'Galeri', icon: '▣' },
		{ id: 'rsvp', label: 'RSVP', icon: '✎' },
		{ id: 'hadiah', label: 'Hadiah', icon: '🎁' }
	];

	// ---------- Helpers ----------
	function fmtDate(iso: string): string {
		if (!iso) return '-';
		try {
			return new Intl.DateTimeFormat('id-ID', {
				weekday: 'long',
				day: 'numeric',
				month: 'long',
				year: 'numeric'
			}).format(new Date(iso));
		} catch {
			return iso;
		}
	}

	function ytEmbed(url: string): string {
		if (!url) return '';
		const m =
			url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/) ||
			url.match(/vimeo\.com\/(\d+)/);
		if (!m) return '';
		return url.includes('vimeo')
			? `https://player.vimeo.com/video/${m[1]}`
			: `https://www.youtube.com/embed/${m[1]}`;
	}

	function copyText(t: string) {
		navigator.clipboard?.writeText(t);
	}

	// ---------- Countdown ----------
	function tickCountdown() {
		const target = events.find((e) => e.key === 'akad') || events[0];
		if (!target?.date_iso) return;
		const diff = new Date(target.date_iso).getTime() - Date.now();
		if (diff <= 0) {
			cd = { d: 0, h: 0, m: 0, s: 0, done: true };
			return;
		}
		const sec = Math.floor(diff / 1000);
		cd = {
			d: Math.floor(sec / 86400),
			h: Math.floor((sec % 86400) / 3600),
			m: Math.floor((sec % 3600) / 60),
			s: sec % 60,
			done: false
		};
	}

	// ---------- Save the date (.ics) ----------
	function downloadIcs() {
		const ev = events[0];
		if (!ev) return;
		const dt = new Date(ev.date_iso);
		const fmt = (d: Date) =>
			d
				.toISOString()
				.replace(/[-:]/g, '')
				.replace(/\.\d{3}/, '');
		const ics = [
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'BEGIN:VEVENT',
			`SUMMARY:Pernikahan ${couple?.groom_name} & ${couple?.bride_name}`,
			`DTSTART:${fmt(dt)}`,
			`DTEND:${fmt(new Date(dt.getTime() + 3600_000))}`,
			`LOCATION:${ev.venue || ''} ${ev.address || ''}`,
			'END:VEVENT',
			'END:VCALENDAR'
		].join('\r\n');
		const blob = new Blob([ics], { type: 'text/calendar' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'save-the-date.ics';
		a.click();
	}

	// ---------- Musik ----------
	function toggleMusic() {
		if (!audioEl || !s.music_url) return;
		if (musicOn) {
			audioEl.pause();
			musicOn = false;
		} else {
			audioEl.volume = 0.5;
			audioEl.play().then(() => (musicOn = true)).catch(() => {});
		}
	}

	function openCover() {
		opened = true;
		document.body.style.overflow = '';
		setTimeout(() => {
			if (s.music_url && audioEl) {
				audioEl.volume = 0.5;
				audioEl.play().then(() => (musicOn = true)).catch(() => {});
			}
		}, 300);
	}

	// ---------- RSVP & Ucapan ----------
	async function submitRsvp() {
		if (!rsvpName.trim() || rsvpBusy) return;
		rsvpBusy = true;
		try {
			const r = await fetch(`/api/u/${data.account.slug}/rsvp`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: rsvpName,
					attendance: rsvpAtt,
					pax: rsvpAtt === 'hadir' ? rsvpPax : 0,
					message: rsvpMsg,
					guest_slug: guestSlug || undefined
				})
			});
			if (r.ok) rsvpDone = true;
		} finally {
			rsvpBusy = false;
		}
	}

	async function submitWish() {
		if (!wishName.trim() || !wishMsg.trim() || wishBusy) return;
		wishBusy = true;
		try {
			const r = await fetch(`/api/u/${data.account.slug}/wishes`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: wishName, message: wishMsg, attending: 'hadir', guest_slug: guestSlug || undefined })
			});
			if (r.ok) {
				const w = await r.json();
				wishesList = [w, ...wishesList];
				wishMsg = '';
			}
		} finally {
			wishBusy = false;
		}
	}

	let guestSlug = '';

	// ---------- Lifecycle ----------
	onMount(() => {
		// ?to= -> nama tamu
		const to = new URLSearchParams(location.search).get('to');
		if (to) {
			guestSlug = to;
			guestName = to
				.split('-')
				.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
				.join(' ');
			rsvpName = guestName;
			wishName = guestName;
		}
		document.body.style.overflow = 'hidden';

		applyTheme(data.account.theme, tokensOf(data.account.theme), baseOf(data.account.theme));
		applyBackground(s as unknown as Record<string, string>);

		tickCountdown();
		const iv = setInterval(tickCountdown, 1000);
		const stopReveal = initReveal();

		// scroll-spy nav
		const io = new IntersectionObserver(
			(entries) => {
				entries.forEach((e) => {
					if (e.isIntersecting) active = e.target.id;
				});
			},
			{ threshold: 0.4 }
		);
		sections.forEach((sec) => {
			const el = document.getElementById(sec.id);
			if (el) io.observe(el);
		});

		return () => {
			clearInterval(iv);
			stopReveal();
			io.disconnect();
		};
	});

	function tokensOf(slug: string): Record<string, string> | null {
		const t = data.themes.find((x) => x.slug === slug);
		return t ? t.tokens : null;
	}
	function baseOf(slug: string): string | null {
		const t = data.themes.find((x) => x.slug === slug);
		return t ? t.base : null;
	}

	// Dekorasi sparkle mengambang
	const sparkles = Array.from({ length: 10 }, (_, i) => i);
</script>

<svelte:head>
	<title>{couple ? `${couple.groom_name} & ${couple.bride_name} — Undangan Pernikahan` : 'Undangan Pernikahan'}</title>
	<meta
		name="description"
		content="Undangan pernikahan {couple?.groom_name || ''} & {couple?.bride_name || ''}."
	/>
</svelte:head>

<audio bind:this={audioEl} src={s.music_url} loop preload="none"></audio>

{#if s.music_url}
	<button class="music-btn" class:on={musicOn} onclick={toggleMusic} aria-label="Musik latar">
		{#if musicOn}❚❚{:else}♪{/if}
	</button>
{/if}

<!-- ================= COVER ================= -->
<div class="cover" class:opened class:deco-animated={decoAnimated} data-deco={decoration}>
	<div class="cover-bg"></div>
	<!-- Dekorasi sudut: bisa beranimasi (daun/bunga berayun) -->
	{#if decoration !== 'none'}
		<span class="cover-deco cd-tl"><Ornament variant={decoVariantTL} animated={decoAnimated} /></span>
		<span class="cover-deco cd-tr"><Ornament variant={decoVariantTR} animated={decoAnimated} /></span>
		<span class="cover-deco cd-bl"><Ornament variant={decoVariantTL} animated={decoAnimated} /></span>
		<span class="cover-deco cd-br"><Ornament variant={decoVariantTR} animated={decoAnimated} /></span>
	{/if}
	<div class="cover-inner">
		<p class="anim-down" style="animation-delay:.1s">The Wedding Of</p>

		{#if coverMode !== 'none'}
			<div class="anim-down" style="animation-delay:.2s">
				<CoverPhoto src={coverPhoto} mode={coverMode} groomName={couple?.groom_name || ''} brideName={couple?.bride_name || ''} />
			</div>
		{/if}

		<h1 class="script anim-down" style="animation-delay:.25s">
			{couple?.groom_name} &amp; {couple?.bride_name}
		</h1>
		<p class="anim-up" style="animation-delay:.5s">{fmtDate(events[0]?.date_iso || '')}</p>

		{#if guestName}
			<div class="guest-badge anim-up" style="animation-delay:.65s">
				<span>Kepada</span>
				<strong>{guestName}</strong>
			</div>
		{/if}

		<button class="open-btn anim-up" style="animation-delay:.85s" onclick={openCover}>
			Buka Undangan
		</button>
	</div>
</div>

<!-- ================= ISI UNDANGAN ================= -->
<main class:locked={!opened}>
	<!-- HERO -->
	<section id="home" class="hero">
		<div class="bg-layer"></div>
		<div class="bg-overlay"></div>
		<div class="orn-layer">
			<span class="orn ornament tl"><Ornament variant="corner" /></span>
			<span class="orn ornament tr"><Ornament variant="corner" /></span>
		</div>
		<div class="hero-content">
			<p data-reveal="down">Kami akan menikah</p>
			<h1 class="script" data-reveal="zoom" data-reveal-delay="120">
				{couple?.groom_name} &amp; {couple?.bride_name}
			</h1>
			<div class="divider-wrap" data-reveal="up" data-reveal-delay="240">
				<Ornament variant="divider" />
			</div>
			<p class="date" data-reveal="up" data-reveal-delay="320">{fmtDate(events[0]?.date_iso || '')}</p>

			<!-- Countdown -->
			<div class="countdown" data-reveal="up" data-reveal-delay="420">
				{#if cd.done}
					<p class="cd-done">Acara telah berlangsung 💛</p>
				{:else}
					{#each [{ v: cd.d, l: 'Hari' }, { v: cd.h, l: 'Jam' }, { v: cd.m, l: 'Menit' }, { v: cd.s, l: 'Detik' }] as it}
						<div class="cd-box"><strong>{String(it.v).padStart(2, '0')}</strong><span>{it.l}</span></div>
					{/each}
				{/if}
			</div>

			<button class="ghost-btn" data-reveal="up" data-reveal-delay="520" onclick={downloadIcs}>
				+ Simpan Tanggal
			</button>
		</div>
	</section>

	<!-- QUOTE -->
	{#if s.quote}
		<section class="quote-sec">
			<div class="container">
				<Ornament variant="sparkle" class="qs" />
				<p data-reveal="up">{s.quote}</p>
			</div>
		</section>
	{/if}

	<!-- MEMPELAI -->
	<section id="mempelai" class="section couple-sec">
		<div class="container">
			<p class="eyebrow" data-reveal="up">Mempelai</p>
			<h2 class="script sec-title" data-reveal="up" data-reveal-delay="80">Bismillahirrahmanirrahim</h2>
			<Ornament variant="divider" class="sec-div" />

			<div class="couple-grid">
				{#each [{ role: 'Mempelai Pria', p: couple?.groom_photo, n: couple?.groom_full || couple?.groom_name, ig: couple?.groom_ig, par: couple?.groom_parents }, { role: 'Mempelai Wanita', p: couple?.bride_photo, n: couple?.bride_full || couple?.bride_name, ig: couple?.bride_ig, par: couple?.bride_parents }] as m}
					<div class="person" data-reveal="up">
						<div class="photo-ring float">
							{#if m.p}<img src={m.p} alt={m.n || ''} loading="lazy" />{/if}
						</div>
						<h3 class="script person-name">{m.n}</h3>
						{#if m.par}<p class="par">{m.par}</p>{/if}
						{#if m.ig}
							<a class="ig" href={`https://instagram.com/${m.ig}`} target="_blank" rel="noopener">@{m.ig}</a>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- LOVE STORY -->
	{#if couple?.love_story}
		<section class="section story-sec">
			<div class="container">
				<p class="eyebrow" data-reveal="up">Cerita Kami</p>
				<h2 class="script sec-title" data-reveal="up" data-reveal-delay="80">Perjalanan Cinta</h2>
				<Ornament variant="divider" class="sec-div" />
				<p class="story" data-reveal="up" data-reveal-delay="140">{couple.love_story}</p>
			</div>
		</section>
	{/if}

	<!-- ACARA -->
	<section id="acara" class="section event-sec">
		<div class="container">
			<p class="eyebrow" data-reveal="up">Waktu &amp; Tempat</p>
			<h2 class="script sec-title" data-reveal="up" data-reveal-delay="80">Rangkaian Acara</h2>
			<Ornament variant="divider" class="sec-div" />

			<div class="event-grid">
				{#each events as ev, i}
					<div class="event-card" data-reveal="up" data-reveal-delay={i * 100}>
						<span class="orn ornament tl small"><Ornament variant="corner" /></span>
						<h3>{ev.title}</h3>
						<Ornament variant="sparkle" class="ec-spark" />
						<p class="ev-date">{fmtDate(ev.date_iso)}</p>
						{#if ev.time_text}<p class="ev-time">{ev.time_text}</p>{/if}
						{#if ev.venue}<p class="ev-venue">{ev.venue}</p>{/if}
						{#if ev.address}<p class="ev-addr">{ev.address}</p>{/if}
						{#if ev.maps_url}
							<a class="ghost-btn sm" href={ev.maps_url} target="_blank" rel="noopener">Lihat Lokasi</a>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- GALERI -->
	{#if gallery.length}
		<section id="galeri" class="section gallery-sec">
			<div class="container">
				<p class="eyebrow" data-reveal="up">Galeri</p>
				<h2 class="script sec-title" data-reveal="up" data-reveal-delay="80">Momen Kami</h2>
				<Ornament variant="divider" class="sec-div" />
				<div class="gallery-grid">
					{#each gallery as g, i}
						<button
							class="g-item"
							data-reveal="zoom"
							data-reveal-delay={(i % 3) * 80}
							onclick={() => (lbSrc = g.url)}
						>
							<img src={g.url} alt={g.caption || ''} loading="lazy" />
						</button>
					{/each}
				</div>
			</div>
		</section>
	{/if}

	<!-- VIDEO -->
	{#if s.video_url}
		<section class="section video-sec">
			<div class="container">
				<p class="eyebrow" data-reveal="up">Video</p>
				<h2 class="script sec-title" data-reveal="up" data-reveal-delay="80">Momen Bahagia</h2>
				<Ornament variant="divider" class="sec-div" />
				<div class="video-frame" data-reveal="zoom">
					{#if ytEmbed(s.video_url)}
						<iframe
							src={ytEmbed(s.video_url)}
							title="Video undangan"
							allow="autoplay; encrypted-media; picture-in-picture"
							allowfullscreen
						></iframe>
					{:else}
						<video src={s.video_url} controls playsinline></video>
					{/if}
				</div>
			</div>
		</section>
	{/if}

	<!-- LIVE STREAMING -->
	{#if s.live_url}
		<section class="section live-sec">
			<div class="container">
				<div class="live-card" data-reveal="up">
					<span class="live-dot"></span>
					<h3>Live Streaming</h3>
					<p>{s.live_text || 'Saksikan momen kami secara langsung.'}</p>
					<a class="solid-btn" href={s.live_url} target="_blank" rel="noopener">Tonton Live</a>
				</div>
			</div>
		</section>
	{/if}

	<!-- RSVP -->
	<section id="rsvp" class="section rsvp-sec">
		<div class="container">
			<p class="eyebrow" data-reveal="up">Konfirmasi</p>
			<h2 class="script sec-title" data-reveal="up" data-reveal-delay="80">Kehadiran Anda</h2>
			<Ornament variant="divider" class="sec-div" />

			<div class="card" data-reveal="up">
				{#if rsvpDone}
					<p class="ok">Terima kasih atas konfirmasinya 💛</p>
				{:else}
					<label>Nama</label>
					<input bind:value={rsvpName} placeholder="Nama Anda" />
					<label>Kehadiran</label>
					<div class="choice">
						{#each [['hadir', 'Hadir'], ['tidak_hadir', 'Tidak Hadir'], ['ragu', 'Ragu']] as [v, l]}
							<button class="chip" class:on={rsvpAtt === v} onclick={() => (rsvpAtt = v)}>{l}</button>
						{/each}
					</div>
					{#if rsvpAtt === 'hadir'}
						<label>Jumlah Orang</label>
						<div class="stepper">
							<button onclick={() => (rsvpPax = Math.max(1, rsvpPax - 1))}>−</button>
							<span>{rsvpPax}</span>
							<button onclick={() => (rsvpPax = Math.min(20, rsvpPax + 1))}>+</button>
						</div>
					{/if}
					<label>Pesan (opsional)</label>
					<textarea bind:value={rsvpMsg} rows="3" placeholder="Ucapan atau catatan"></textarea>
					<button class="solid-btn" disabled={rsvpBusy} onclick={submitRsvp}>
						{rsvpBusy ? 'Mengirim…' : 'Kirim Konfirmasi'}
					</button>
				{/if}
			</div>

			<!-- Buku tamu -->
			<div class="card guestbook" data-reveal="up" data-reveal-delay="120">
				<h3>Ucapan &amp; Doa</h3>
				<input bind:value={wishName} placeholder="Nama" />
				<textarea bind:value={wishMsg} rows="3" placeholder="Tulis ucapan…"></textarea>
				<button class="solid-btn sm" disabled={wishBusy} onclick={submitWish}>Kirim Ucapan</button>
				<div class="wish-list">
					{#each wishesList as w (w.id)}
						<div class="wish">
							<strong>{w.name}</strong>
							<p>{w.message}</p>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<!-- AMPLOP DIGITAL -->
	<section id="hadiah" class="section gift-sec">
		<div class="container">
			<p class="eyebrow" data-reveal="up">Tanda Kasih</p>
			<h2 class="script sec-title" data-reveal="up" data-reveal-delay="80">Amplop Digital</h2>
			<Ornament variant="divider" class="sec-div" />
			<p class="gift-note" data-reveal="up">
				Doa restu Anda sudah cukup bagi kami. Namun bila ingin memberi tanda kasih, tersedia:
			</p>

			<div class="gift-grid">
				{#each gifts as g, i}
					<div class="gift-card" data-reveal="up" data-reveal-delay={i * 80}>
						<p class="g-type">{g.type === 'ewallet' ? 'E-Wallet' : g.bank_name}</p>
						<p class="g-no">{g.account_no}</p>
						<p class="g-name">a.n. {g.account_name}</p>
						<button class="ghost-btn sm" onclick={() => copyText(g.account_no || '')}>Salin</button>
					</div>
				{/each}
			</div>

			{#if s.qris_image}
				<div class="qris" data-reveal="zoom">
					<p>Scan QRIS</p>
					<img src={s.qris_image} alt="QRIS" loading="lazy" />
				</div>
			{/if}

			{#if s.gift_address}
				<div class="gift-address" data-reveal="up">
					<h4>Kirim Hadiah</h4>
					<p>{s.gift_address}</p>
					<button class="ghost-btn sm" onclick={() => copyText(s.gift_address)}>Salin Alamat</button>
				</div>
			{/if}
		</div>
	</section>

	<!-- CLOSING -->
	<section class="closing-sec">
		<div class="container">
			<p data-reveal="up">Merupakan suatu kehormatan &amp; kebahagiaan bagi kami apabila</p>
			<h2 class="script" data-reveal="zoom">Anda berkenan hadir</h2>
			<Ornament variant="divider" class="sec-div" />
			<h3 class="script names">{couple?.groom_name} &amp; {couple?.bride_name}</h3>
		</div>
	</section>

	<!-- FOOTER + watermark -->
	<footer class="footer">
		{#if s.watermark_enabled}
			<p class="wm">{s.watermark_text || 'Undangan Digital'}</p>
		{/if}
		<p class="copy">© {new Date().getFullYear()} {couple?.groom_name} &amp; {couple?.bride_name}</p>
	</footer>
</main>

<!-- Lightbox -->
{#if lbSrc}
	<div class="lightbox" onclick={() => (lbSrc = null)} role="presentation">
		<img src={lbSrc} alt="" />
	</div>
{/if}

<!-- Navigasi bawah -->
{#if opened}
	<nav class="bottom-nav">
		{#each sections as sec}
			<a href={`#${sec.id}`} class:on={active === sec.id}>
				<span class="ni">{sec.icon}</span>
				<span class="nl">{sec.label}</span>
			</a>
		{/each}
	</nav>
{/if}

<style>
	/* =================== COVER =================== */
	.cover {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		place-items: center;
		transition:
			opacity 0.9s ease,
			visibility 0.9s;
	}
	.cover.opened {
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
	}
	.cover-bg {
		position: absolute;
		inset: 0;
		background-image: var(--bg-cover-mobile);
		background-color: var(--cream-2);
		background-position: var(--bg-position-mobile);
		background-size: var(--bg-size-mobile);
		background-repeat: var(--bg-repeat-mobile);
	}
	@media (min-width: 721px) {
		.cover-bg {
			background-image: var(--bg-cover);
			background-position: var(--bg-position);
			background-size: var(--bg-size);
			background-repeat: var(--bg-repeat);
			background-attachment: var(--bg-attachment);
		}
	}
	.cover-bg::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.55));
	}
	:global(body.theme-midnight) .cover-bg::after {
		background: linear-gradient(180deg, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.75));
	}
	/* Dekorasi sudut cover (floral/adat) — bisa beranimasi berayun */
	.cover-deco {
		position: absolute;
		width: clamp(90px, 26vw, 170px);
		height: clamp(90px, 26vw, 170px);
		color: var(--gold, #b08d47);
		opacity: 0.85;
		pointer-events: none;
		z-index: 2;
	}
	.cover-deco :global(svg) {
		width: 100%;
		height: 100%;
	}
	.cd-tl { top: 0; left: 0; }
	.cd-tr { top: 0; right: 0; transform: scaleX(-1); }
	.cd-bl { bottom: 0; left: 0; transform: scaleY(-1); }
	.cd-br { bottom: 0; right: 0; transform: scale(-1, -1); }
	/* Saat animasi aktif, ornamen berayun pelan */
	.cover.deco-animated .cd-tl,
	.cover.deco-animated .cd-bl { animation: sway 5s ease-in-out infinite; }
	.cover.deco-animated .cd-tr,
	.cover.deco-animated .cd-br { animation: sway 5.8s ease-in-out infinite reverse; }
	@media (prefers-reduced-motion: reduce) {
		.cover.deco-animated .cd-tl,
		.cover.deco-animated .cd-tr,
		.cover.deco-animated .cd-bl,
		.cover.deco-animated .cd-br { animation: none; }
	}
	/* Cadangan keyframe (jika belum didefinisikan global) */
	@keyframes sway {
		0%, 100% { transform-origin: 0% 0%; rotate: 0deg; }
		50% { rotate: 3.5deg; }
	}
	.cover-inner {
		position: relative;
		text-align: center;
		color: #fff;
		padding: 2rem;
		max-width: 560px;
	}
	.cover-inner p {
		letter-spacing: 0.28em;
		text-transform: uppercase;
		font-size: 0.72rem;
		opacity: 0.9;
	}
	.cover-inner h1 {
		font-size: clamp(2.8rem, 12vw, 5rem);
		margin: 0.4rem 0;
	}
	.guest-badge {
		margin: 1.4rem auto 0.4rem;
		border: 1px solid rgba(255, 255, 255, 0.4);
		border-radius: 999px;
		padding: 0.5rem 1.4rem;
		display: inline-flex;
		flex-direction: column;
		backdrop-filter: blur(4px);
		background: rgba(255, 255, 255, 0.08);
	}
	.guest-badge span {
		font-size: 0.62rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		opacity: 0.8;
	}
	.guest-badge strong {
		font-size: 1.05rem;
	}
	.open-btn {
		margin-top: 1.6rem;
		background: var(--gold);
		color: #fff;
		border: 0;
		padding: 0.85rem 2.2rem;
		border-radius: 999px;
		font-size: 0.85rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		cursor: pointer;
		box-shadow: 0 12px 34px -12px rgba(0, 0, 0, 0.6);
		transition: transform 0.3s;
	}
	.open-btn:hover {
		transform: translateY(-2px) scale(1.03);
	}

	/* =================== MAIN =================== */
	main.locked {
		display: none;
	}
	.container {
		max-width: 980px;
		margin: 0 auto;
		padding: 0 1.2rem;
	}

	/* HERO */
	.hero {
		position: relative;
		min-height: 100svh;
		display: grid;
		place-items: center;
		text-align: center;
		overflow: hidden;
		padding: 4rem 1.2rem;
	}
	.bg-layer {
		position: absolute;
		inset: 0;
		background-image: var(--bg-hero-mobile);
		background-color: var(--cream-2);
		background-position: var(--bg-position-mobile);
		background-size: var(--bg-size-mobile);
		background-repeat: var(--bg-repeat-mobile);
	}
	@media (min-width: 721px) {
		.bg-layer {
			background-image: var(--bg-hero);
			background-position: var(--bg-position);
			background-size: var(--bg-size);
			background-repeat: var(--bg-repeat);
			background-attachment: var(--bg-attachment);
		}
	}
	.bg-overlay {
		position: absolute;
		inset: 0;
		background: var(--bg-overlay, transparent);
	}
	.orn-layer {
		position: absolute;
		inset: 0;
		color: var(--gold);
	}
	.ornament {
		position: absolute;
		opacity: 0.75;
		color: var(--gold);
	}
	.ornament.tl {
		top: -10px;
		left: -10px;
		width: 140px;
		height: 140px;
	}
	.ornament.tr {
		top: -10px;
		right: -10px;
		width: 140px;
		height: 140px;
		transform: scaleX(-1);
	}
	.ornament.small {
		width: 84px;
		height: 84px;
	}
	.hero-content {
		position: relative;
		z-index: 2;
	}
	.hero-content > p {
		letter-spacing: 0.3em;
		text-transform: uppercase;
		font-size: 0.72rem;
		color: var(--ink-soft);
	}
	.hero-content h1 {
		font-size: clamp(3rem, 14vw, 6rem);
		color: var(--ink);
		margin: 0.3rem 0;
	}
	.divider-wrap {
		color: var(--gold);
		margin: 0.4rem auto;
	}
	.date {
		font-family: var(--serif);
		font-size: 1.2rem;
		color: var(--ink-soft);
	}

	.countdown {
		display: flex;
		gap: 0.6rem;
		justify-content: center;
		margin: 1.6rem 0;
		flex-wrap: wrap;
	}
	.cd-box {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 14px;
		padding: 0.7rem 0.9rem;
		min-width: 66px;
		box-shadow: var(--shadow);
	}
	.cd-box strong {
		display: block;
		font-family: var(--serif);
		font-size: 1.7rem;
		color: var(--sage-dark);
	}
	.cd-box span {
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}
	.cd-done {
		font-family: var(--serif);
		font-size: 1.4rem;
		color: var(--gold);
	}

	/* Tombol */
	.ghost-btn {
		display: inline-block;
		background: transparent;
		border: 1px solid var(--gold);
		color: var(--gold);
		padding: 0.6rem 1.5rem;
		border-radius: 999px;
		font-size: 0.78rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			background 0.3s,
			color 0.3s;
	}
	.ghost-btn:hover {
		background: var(--gold);
		color: #fff;
	}
	.ghost-btn.sm,
	.solid-btn.sm {
		padding: 0.45rem 1.1rem;
		font-size: 0.72rem;
	}
	.solid-btn {
		background: var(--sage-dark);
		color: #fff;
		border: 0;
		padding: 0.75rem 1.8rem;
		border-radius: 999px;
		font-size: 0.8rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
		transition: transform 0.25s;
	}
	.solid-btn:hover {
		transform: translateY(-2px);
	}
	.solid-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}

	/* Section umum */
	.section {
		padding: 4.5rem 0;
	}
	.eyebrow {
		text-align: center;
		letter-spacing: 0.32em;
		text-transform: uppercase;
		font-size: 0.68rem;
		color: var(--gold);
	}
	.sec-title {
		text-align: center;
		font-size: clamp(2rem, 8vw, 3rem);
		color: var(--ink);
		margin: 0.2rem 0;
	}
	:global(.sec-div) {
		color: var(--gold);
		margin: 0.6rem auto 1.6rem;
	}

	.quote-sec {
		padding: 3.5rem 0;
		background: var(--cream-2);
		text-align: center;
	}
	.quote-sec p {
		font-family: var(--serif);
		font-style: italic;
		font-size: 1.15rem;
		max-width: 720px;
		margin: 0.8rem auto 0;
		color: var(--ink-soft);
	}
	:global(.qs) {
		color: var(--gold);
	}

	/* Mempelai */
	.couple-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 2.6rem;
		margin-top: 1rem;
	}
	@media (min-width: 721px) {
		.couple-grid {
			grid-template-columns: 1fr 1fr;
			gap: 2rem;
		}
	}
	.person {
		text-align: center;
	}
	.photo-ring {
		width: 200px;
		height: 200px;
		margin: 0 auto 1rem;
		border-radius: 50%;
		padding: 8px;
		background: linear-gradient(135deg, var(--gold), transparent 60%);
	}
	.photo-ring img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 50%;
	}
	.person-name {
		font-size: 2rem;
		color: var(--ink);
	}
	.par {
		font-size: 0.86rem;
		color: var(--ink-soft);
		max-width: 320px;
		margin: 0.3rem auto;
	}
	.ig {
		display: inline-block;
		margin-top: 0.5rem;
		font-size: 0.8rem;
		color: var(--gold);
		border-bottom: 1px solid currentColor;
	}

	/* Story */
	.story {
		max-width: 720px;
		margin: 0 auto;
		text-align: center;
		color: var(--ink-soft);
		font-size: 1.02rem;
		line-height: 1.9;
	}

	/* Acara */
	.event-sec {
		background: var(--cream-2);
	}
	.event-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.6rem;
	}
	@media (min-width: 721px) {
		.event-grid {
			grid-template-columns: 1fr 1fr;
			gap: 2rem;
		}
	}
	.event-card {
		position: relative;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 2.2rem 1.6rem;
		text-align: center;
		box-shadow: var(--shadow);
		overflow: hidden;
	}
	.event-card h3 {
		font-family: var(--serif);
		font-size: 1.7rem;
		color: var(--ink);
	}
	:global(.ec-spark) {
		color: var(--gold);
		margin: 0.4rem auto 0.8rem;
	}
	.ev-date {
		font-family: var(--serif);
		font-size: 1.1rem;
		color: var(--sage-dark);
		margin: 0.3rem 0 0;
	}
	.ev-time,
	.ev-venue {
		color: var(--ink-soft);
		margin: 0.15rem 0;
	}
	.ev-venue {
		font-weight: 600;
		color: var(--ink);
	}
	.ev-addr {
		font-size: 0.85rem;
		color: var(--ink-soft);
		margin-bottom: 1rem;
	}

	/* Galeri */
	.gallery-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.7rem;
	}
	@media (min-width: 721px) {
		.gallery-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	.g-item {
		padding: 0;
		border: 0;
		border-radius: 12px;
		overflow: hidden;
		cursor: pointer;
		background: none;
		aspect-ratio: 3 / 4;
	}
	.g-item img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.6s;
	}
	.g-item:hover img {
		transform: scale(1.07);
	}

	/* Video */
	.video-frame {
		max-width: 760px;
		margin: 0 auto;
		border-radius: var(--radius);
		overflow: hidden;
		box-shadow: var(--shadow);
		aspect-ratio: 16 / 9;
		background: #000;
	}
	.video-frame iframe,
	.video-frame video {
		width: 100%;
		height: 100%;
		border: 0;
	}

	/* Live */
	.live-card {
		max-width: 560px;
		margin: 0 auto;
		text-align: center;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 2.4rem 1.6rem;
		box-shadow: var(--shadow);
	}
	.live-dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #e5484d;
		margin-bottom: 0.6rem;
		animation: pulseGrow 1.6s infinite;
	}
	.live-card h3 {
		font-family: var(--serif);
		font-size: 1.6rem;
	}

	/* RSVP */
	.card {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 1.6rem;
		box-shadow: var(--shadow);
		max-width: 640px;
		margin: 0 auto 1.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.card label {
		font-size: 0.78rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-soft);
		margin-top: 0.4rem;
	}
	input,
	textarea {
		width: 100%;
		padding: 0.7rem 0.9rem;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--cream);
		color: var(--ink);
		font-family: inherit;
		font-size: 0.95rem;
	}
	input:focus,
	textarea:focus {
		outline: 2px solid var(--gold);
		outline-offset: 1px;
	}
	.choice {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.chip {
		flex: 1;
		min-width: 90px;
		padding: 0.6rem;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--cream);
		color: var(--ink-soft);
		cursor: pointer;
		font-size: 0.85rem;
	}
	.chip.on {
		background: var(--sage-dark);
		color: #fff;
		border-color: var(--sage-dark);
	}
	.stepper {
		display: flex;
		align-items: center;
		gap: 1rem;
		justify-content: center;
	}
	.stepper button {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: 1px solid var(--line);
		background: var(--cream);
		font-size: 1.2rem;
		cursor: pointer;
		color: var(--ink);
	}
	.stepper span {
		font-family: var(--serif);
		font-size: 1.4rem;
		min-width: 30px;
		text-align: center;
	}
	.ok {
		text-align: center;
		font-family: var(--serif);
		font-size: 1.3rem;
		color: var(--sage-dark);
		padding: 1rem 0;
	}
	.guestbook h3 {
		font-family: var(--serif);
		font-size: 1.5rem;
		text-align: center;
		margin-bottom: 0.6rem;
	}
	.wish-list {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		max-height: 420px;
		overflow-y: auto;
	}
	.wish {
		background: var(--cream);
		border-radius: 10px;
		padding: 0.7rem 0.9rem;
	}
	.wish strong {
		font-size: 0.85rem;
		color: var(--sage-dark);
	}
	.wish p {
		margin: 0.2rem 0 0;
		font-size: 0.9rem;
		color: var(--ink-soft);
	}

	/* Hadiah */
	.gift-sec {
		background: var(--cream-2);
	}
	.gift-note {
		text-align: center;
		max-width: 620px;
		margin: 0 auto 1.6rem;
		color: var(--ink-soft);
	}
	.gift-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
		max-width: 720px;
		margin: 0 auto;
	}
	@media (min-width: 721px) {
		.gift-grid {
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		}
	}
	.gift-card {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 14px;
		padding: 1.2rem;
		text-align: center;
	}
	.g-type {
		font-size: 0.72rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--gold);
	}
	.g-no {
		font-family: var(--serif);
		font-size: 1.3rem;
		color: var(--ink);
		margin: 0.3rem 0;
	}
	.g-name {
		font-size: 0.82rem;
		color: var(--ink-soft);
		margin-bottom: 0.8rem;
	}
	.qris,
	.gift-address {
		max-width: 380px;
		margin: 1.6rem auto 0;
		text-align: center;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 14px;
		padding: 1.2rem;
	}
	.qris img {
		max-width: 240px;
		margin: 0.8rem auto 0;
		border-radius: 10px;
	}
	.gift-address h4 {
		font-family: var(--serif);
		font-size: 1.2rem;
		margin: 0 0 0.4rem;
	}

	/* Closing */
	.closing-sec {
		padding: 4.5rem 0;
		text-align: center;
		background: var(--cream);
	}
	.closing-sec p {
		color: var(--ink-soft);
	}
	.closing-sec h2 {
		font-size: clamp(2rem, 9vw, 3.4rem);
		color: var(--ink);
		margin: 0.4rem 0;
	}
	.names {
		font-size: 2rem;
		color: var(--gold);
	}

	/* Footer */
	.footer {
		text-align: center;
		padding: 1.6rem;
		background: var(--sage-dark);
		color: rgba(255, 255, 255, 0.85);
	}
	.wm {
		font-size: 0.7rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		opacity: 0.8;
		margin: 0;
	}
	.copy {
		font-size: 0.75rem;
		margin: 0.4rem 0 0;
		opacity: 0.75;
	}

	/* Lightbox */
	.lightbox {
		position: fixed;
		inset: 0;
		z-index: 200;
		background: rgba(0, 0, 0, 0.88);
		display: grid;
		place-items: center;
		padding: 1.6rem;
	}
	.lightbox img {
		max-width: 92vw;
		max-height: 88vh;
		border-radius: 10px;
	}

	/* Musik */
	.music-btn {
		position: fixed;
		right: 1rem;
		bottom: 5.4rem;
		z-index: 90;
		width: 46px;
		height: 46px;
		border-radius: 50%;
		border: 0;
		background: var(--sage-dark);
		color: #fff;
		font-size: 1.1rem;
		cursor: pointer;
		box-shadow: var(--shadow);
	}
	.music-btn.on {
		animation: pulseGrow 2s infinite;
	}

	/* Bottom nav */
	.bottom-nav {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 90;
		display: flex;
		justify-content: space-around;
		background: color-mix(in srgb, var(--surface) 92%, transparent);
		backdrop-filter: blur(10px);
		border-top: 1px solid var(--line);
		padding: 0.4rem 0.2rem calc(0.4rem + env(safe-area-inset-bottom));
	}
	.bottom-nav a {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		font-size: 0.6rem;
		color: var(--ink-soft);
		padding: 0.2rem 0.5rem;
		letter-spacing: 0.04em;
	}
	.bottom-nav a.on {
		color: var(--gold);
	}
	.ni {
		font-size: 1rem;
	}
</style>
