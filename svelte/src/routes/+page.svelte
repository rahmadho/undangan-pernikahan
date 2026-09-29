<script lang="ts">
	import { onMount } from 'svelte';
	let slug = $state('');
	onMount(() => {
		const saved = localStorage.getItem('wedding.admin');
		if (saved) {
			try { const c = JSON.parse(saved); slug = c.slug; } catch {}
		}
	});
</script>

<svelte:head><title>Undangan Pernikahan Online</title></svelte:head>

<div class="home">
	<div class="hero">
		<h1>💍 Undangan Pernikahan Online</h1>
		<p>Platform SaaS undangan digital — tema modular, latar kustom, dan fitur lengkap.</p>

		<div class="actions">
			{#if slug}
				<a class="btn primary" href={`/u/${slug}/admin`}>Buka Panel Admin</a>
				<a class="btn" href={`/u/${slug}`}>Lihat Undangan</a>
			{:else}
				<a class="btn primary" href="/u/demo">Lihat Contoh Undangan</a>
				<a class="btn" href="/u/demo/admin">Panel Admin (demo)</a>
			{/if}
		</div>

		<div class="feats">
			<div><span>🎨</span><h3>Tema Modular</h3><p>Pilih preset atau buat tema warna & font sendiri.</p></div>
			<div><span>🖼️</span><h3>Latar Kustom</h3><p>Gambar latar desktop & mobile terpisah + overlay.</p></div>
			<div><span>🎵</span><h3>Musik & Video</h3><p>Upload backsound, embed video & live streaming.</p></div>
			<div><span>✉️</span><h3>RSVP & Ucapan</h3><p>Konfirmasi kehadiran dan buku tamu real-time.</p></div>
			<div><span>💝</span><h3>Amplop Digital</h3><p>Bank, e-wallet, QRIS, dan alamat kirim hadiah.</p></div>
			<div><span>👑</span><h3>Multi-Client</h3><p>Owner panel untuk kelola banyak undangan.</p></div>
		</div>

		<a class="owner-link" href="/owner">Masuk sebagai Owner →</a>
	</div>
</div>

<style>
	:global(body) { background: #f7f4ec; }
	.home { min-height: 100vh; display: grid; place-items: center; padding: 2rem 1rem; }
	.hero { max-width: 900px; text-align: center; }
	h1 { font-size: clamp(1.8rem, 5vw, 3rem); margin: 0 0 .6rem; color: #2c3a2a; }
	.hero > p { color: #6f6a5f; font-size: 1.05rem; }
	.actions { display: flex; gap: .8rem; justify-content: center; margin: 1.8rem 0; flex-wrap: wrap; }
	.btn { border: 1px solid #b08d47; color: #8a6d33; padding: .75rem 1.6rem; border-radius: 999px; font-size: .9rem; }
	.btn.primary { background: #b08d47; color: #fff; }
	.feats { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin: 2.4rem 0; text-align: left; }
	.feats > div { background: #fff; border-radius: 14px; padding: 1.2rem; box-shadow: 0 10px 30px -20px rgba(0,0,0,.3); }
	.feats span { font-size: 1.6rem; }
	.feats h3 { margin: .4rem 0 .2rem; font-size: 1.05rem; color: #2c3a2a; }
	.feats p { margin: 0; font-size: .85rem; color: #7a7568; }
	.owner-link { color: #8a6d33; font-size: .88rem; border-bottom: 1px solid currentColor; }
</style>
