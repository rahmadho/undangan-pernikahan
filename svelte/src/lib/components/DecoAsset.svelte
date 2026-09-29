<script lang="ts">
	/**
	 * DecoAsset.svelte — lapisan dekorasi dari ASET FILE LOKAL (opsional).
	 *
	 * ⚠️ PENTING: Komponen ini TERPISAH dari `Ornament.svelte`. Ia tidak
	 * menyentuh, mengganti, atau membungkus dekorasi SVG inline yang sudah ada.
	 * Ia hanya menambah lapisan opsional di atas/di belakang konten, dan hanya
	 * aktif bila `id` valid (bukan 'none'). Dekorasi bawaan tetap dirender
	 * seperti biasa.
	 *
	 * Cara kerja
	 * ----------
	 * File SVG lokal di-*mask* lewat CSS `mask-image`, lalu diwarnai dengan
	 * `background: currentColor`. Hasilnya: aset ikut warna tema persis seperti
	 * ornamen inline (yang pakai `currentColor`). Tidak ada <img>, jadi tidak
	 * ada alt-text palsu / noise untuk pembaca layar.
	 *
	 * Aksesibilitas
	 * -------------
	 *  - `aria-hidden="true"` + `role="presentation"`: murni hiasan.
	 *  - Tidak bisa di-fokus (bukan elemen interaktif).
	 *  - `pointer-events: none` (lihat CSS) agar tidak memblokir klik/link.
	 *  - Animasi menghormati `prefers-reduced-motion` (lihat style.css).
	 *
	 * Keamanan
	 * --------
	 * Hanya `id` yang ada di katalog `decoAssets.ts` yang dirender; URL selalu
	 * berasal dari catalog (path tetap), sehingga tidak ada nilai user yang
	 * masuk ke CSS/URL.
	 */
	import {
		decoAssetUrl,
		getDecoAsset,
		normalizeDecoAsset,
		type DecoAsset
	} from '$lib/decoAssets';

	let {
		id = 'none',
		animated = false,
		class: cls = ''
	}: { id?: string; animated?: boolean; class?: string } = $props();

	// Normalisasi sekali: buang nilai tak dikenal → 'none' (tidak render apa pun).
	const asset = $derived<DecoAsset | undefined>(getDecoAsset(normalizeDecoAsset(id)));
	const url = $derived(asset ? decoAssetUrl(asset) : '');
	const animClass = $derived(animated ? 'deco-asset-anim' : '');
</script>

{#if asset}
	<!-- Sudut: 4 elemen diputar per sudut via CSS modifier. -->
	{#if asset.kind === 'corner'}
		<span
			class="deco-asset deco-asset-corner {cls} {animClass}"
			style="--deco-mask:url('{url}')"
			aria-hidden="true"
			role="presentation"
		>
			<span class="deco-asset-face daf-tl"></span>
			<span class="deco-asset-face daf-tr"></span>
			<span class="deco-asset-face daf-bl"></span>
			<span class="deco-asset-face daf-br"></span>
		</span>
	{:else if asset.kind === 'repeat'}
		<!-- Pola berulang: satu lapisan mask dengan repeat. -->
		<span
			class="deco-asset deco-asset-repeat {cls} {animClass}"
			style="--deco-mask:url('{url}')"
			aria-hidden="true"
			role="presentation"
		></span>
	{:else}
		<!-- Blok tunggal (flourish / divider / vine). -->
		<span
			class="deco-asset deco-asset-block {cls} {animClass}"
			style="--deco-mask:url('{url}')"
			aria-hidden="true"
			role="presentation"
		></span>
	{/if}
{/if}

<style>
	/*
	 * Semua elemen dekorasi aset:
	 *  - di-mask dari file SVG lokal (--deco-mask) → bisa diwarnai tema
	 *  - background: currentColor → warna ikut tema
	 *  - pointer-events: none → tidak memblokir klik
	 *  - aria-hidden (di markup) → tidak dibaca pembaca layar
	 */
	.deco-asset {
		display: block;
		pointer-events: none;
		color: inherit;
		/* Warna aset = warna teks/aksen konteks (mengikuti tema). */
		background-color: currentColor;
		-webkit-mask-image: var(--deco-mask);
		mask-image: var(--deco-mask);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-position: center;
		mask-position: center;
		-webkit-mask-size: contain;
		mask-size: contain;
	}

	/* --- Blok tunggal & pembatas --- */
	.deco-asset-block {
		width: 100%;
		max-width: 320px;
		aspect-ratio: 5 / 3;
		margin: 0 auto;
	}

	/* --- Pola berulang (repeat) — mask ikut berulang --- */
	.deco-asset-repeat {
		width: 100%;
		height: 100%;
		opacity: 0.5;
		-webkit-mask-repeat: repeat;
		mask-repeat: repeat;
		-webkit-mask-size: 160px 160px;
		mask-size: 160px 160px;
	}

	/* --- Empat sudut: satu container, 4 wajah diputar --- */
	.deco-asset-corner {
		position: relative;
		display: block;
		width: 100%;
		height: 100%;
	}
	.deco-asset-face {
		position: absolute;
		width: 46%;
		height: 46%;
		background-color: currentColor;
		-webkit-mask-image: var(--deco-mask);
		mask-image: var(--deco-mask);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-size: contain;
		mask-size: contain;
		-webkit-mask-position: center;
		mask-position: center;
	}
	.daf-tl {
		top: 0;
		left: 0;
	}
	.daf-tr {
		top: 0;
		right: 0;
		transform: scaleX(-1);
	}
	.daf-bl {
		bottom: 0;
		left: 0;
		transform: scaleY(-1);
	}
	.daf-br {
		bottom: 0;
		right: 0;
		transform: scale(-1, -1);
	}

	/* --- Animasi lembut (hanya saat animated=true) --- */
	.deco-asset-anim {
		animation: deco-asset-float 7s ease-in-out infinite;
	}
	@keyframes deco-asset-float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-8px);
		}
	}

	/* --- Hormati prefers-reduced-motion --- */
	@media (prefers-reduced-motion: reduce) {
		.deco-asset-anim {
			animation: none !important;
		}
	}
</style>
