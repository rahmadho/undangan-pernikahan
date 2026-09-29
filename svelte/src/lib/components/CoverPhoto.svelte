<script lang="ts">
	/**
	 * CoverPhoto.svelte — menampilkan foto cover dengan berbagai opsi bingkai/efek.
	 *
	 * mode:
	 *   'plain'    — foto bulat sederhana di tengah
	 *   'frame'    — bingkai persegi rounded + border putih (kartu foto)
	 *   'shadow'   — foto dengan bayangan lembut menonjol
	 *   'polaroid' — gaya polaroid (bingkai putih tebal, caption bawah)
	 *   'arch'     — lengkung atas (arch/gate) khas undangan adat
	 *   'circle'   — lingkaran penuh dengan ring emas
	 *   'none'     — tanpa foto (hanya latar)
	 */
	let {
		src = '',
		mode = 'plain',
		groomName = '',
		brideName = '',
		alt = 'Foto mempelai'
	}: {
		src?: string;
		mode?: string;
		groomName?: string;
		brideName?: string;
		alt?: string;
	} = $props();

	const initials = $derived(
		(groomName.trim()[0] || '') + (brideName.trim()[0] || '')
	);
</script>

{#if mode !== 'none'}
	<div class="cover-photo cp-{mode}">
		{#if src}
			<img {src} {alt} loading="eager" />
		{:else}
			<div class="cp-placeholder" aria-hidden="true">
				<span class="cp-initials">{initials || '❤'}</span>
			</div>
		{/if}
		{#if mode === 'polaroid'}
			<span class="cp-caption">{groomName.split(' ')[0]} &amp; {brideName.split(' ')[0]}</span>
		{/if}
		{#if mode === 'arch' || mode === 'circle'}
			<span class="cp-ring" aria-hidden="true"></span>
		{/if}
	</div>
{/if}

<style>
	.cover-photo {
		position: relative;
		margin: 0 auto 1.1rem;
		overflow: hidden;
		background: var(--cream-2, #efe9db);
	}

	/* Placeholder saat belum ada foto */
	.cp-placeholder {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		background: linear-gradient(150deg, var(--sage, #7d8f6d), var(--sage-dark, #57684a));
	}
	.cp-initials {
		font-family: var(--serif, serif);
		font-size: 2.2rem;
		letter-spacing: 0.05em;
		color: #fff;
		opacity: 0.92;
	}

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	/* ---------- MODE: plain (bulat kecil) ---------- */
	.cp-plain {
		width: 128px;
		height: 128px;
		border-radius: 50%;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
	}

	/* ---------- MODE: frame (kartu foto rounded + border) ---------- */
	.cp-frame {
		width: min(260px, 68vw);
		aspect-ratio: 4 / 5;
		border-radius: 16px;
		border: 5px solid var(--surface, #fff);
		box-shadow: 0 14px 40px rgba(0, 0, 0, 0.22);
	}

	/* ---------- MODE: shadow (foto tanpa bingkai, bayangan kuat) ---------- */
	.cp-shadow {
		width: min(240px, 64vw);
		aspect-ratio: 3 / 4;
		border-radius: 8px;
		box-shadow: 0 22px 50px -8px rgba(0, 0, 0, 0.45), 0 8px 16px rgba(0, 0, 0, 0.18);
	}

	/* ---------- MODE: polaroid ---------- */
	.cp-polaroid {
		width: min(230px, 62vw);
		aspect-ratio: 4 / 5;
		padding: 10px 10px 34px;
		background: #fff;
		border-radius: 3px;
		box-shadow: 0 10px 26px rgba(0, 0, 0, 0.2);
		transform: rotate(-1.5deg);
	}
	.cp-polaroid img,
	.cp-polaroid .cp-placeholder {
		border-radius: 2px;
	}
	.cp-caption {
		position: absolute;
		bottom: 8px;
		left: 0;
		right: 0;
		text-align: center;
		font-family: var(--script, cursive);
		font-size: 1.15rem;
		color: #555;
	}

	/* ---------- MODE: arch (lengkung atas) ---------- */
	.cp-arch {
		width: min(236px, 64vw);
		aspect-ratio: 3 / 4.4;
		border-radius: 50% 50% 12px 12px / 34% 34% 12px 12px;
		border: 4px solid var(--gold, #b08d47);
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.24);
	}

	/* ---------- MODE: circle (lingkaran + ring emas) ---------- */
	.cp-circle {
		width: min(216px, 60vw);
		aspect-ratio: 1;
		border-radius: 50%;
		border: 4px solid var(--gold, #b08d47);
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.24);
	}
	.cp-ring {
		position: absolute;
		inset: -10px;
		border-radius: inherit;
		border: 1px solid var(--gold, #b08d47);
		opacity: 0.5;
		pointer-events: none;
	}

	@media (max-width: 480px) {
		.cp-frame { width: 62vw; }
		.cp-shadow { width: 58vw; }
	}
</style>
