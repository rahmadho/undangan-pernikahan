<script lang="ts">
	/**
	 * Ornament.svelte — dekorasi floral/adat SVG (bisa diwarnai via currentColor).
	 *
	 * Varian lama : corner, divider, sparkle
	 * Varian BARU : leaf-vine, flower-cluster, peacock,
	 *               batik-kawung, songket, corner-adat
	 *
	 * Semua SVG memakai viewBox rapi + fill/stroke = currentColor agar
	 * bisa diwarnai via CSS tema (var(--sage), var(--gold), dst).
	 *
	 * Prop `animated`: bila true, tambahkan class animasi (deco-*) sehingga
	 * elemen ikut beranimasi halus (lihat style.css). Default false.
	 */
	let {
		variant = 'corner',
		class: cls = '',
		animated = false
	}: { variant?: string; class?: string; animated?: boolean } = $props();

	// Pilih kelas animasi yang sesuai per varian.
	const animClass = $derived(
		animated
			? variant === 'leaf-vine'
				? 'deco-sway leaf'
				: variant === 'flower-cluster'
					? 'deco-bloom'
					: variant === 'peacock'
						? 'deco-drift'
						: variant === 'sparkle'
							? 'deco-flutter'
							: 'deco-sway'
			: ''
	);
</script>

{#if variant === 'corner'}
	<svg class="orn {cls} {animClass}" viewBox="0 0 200 200" fill="none" aria-hidden="true">
		<g stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none" opacity="0.9">
			<path d="M8 8c40 6 62 22 74 52" />
			<path d="M8 8c6 40 22 62 52 74" />
			<path d="M40 40c-14-8-26-6-32-2M40 40c-8-14-6-26-2-32" />
		</g>
		<g fill="currentColor" opacity="0.55">
			<circle cx="74" cy="74" r="5" />
			<circle cx="100" cy="52" r="3.4" />
			<circle cx="52" cy="100" r="3.4" />
			<path d="M74 74c10-6 14-2 20-8-6 6-2 10-8 20-2-6-6-10-12-12Z" />
			<circle cx="120" cy="40" r="2.2" />
			<circle cx="40" cy="120" r="2.2" />
		</g>
	</svg>
{:else if variant === 'divider'}
	<svg class="divider {cls} {animClass}" viewBox="0 0 240 24" fill="none" aria-hidden="true">
		<line x1="0" y1="12" x2="86" y2="12" stroke="currentColor" stroke-width="1" opacity="0.5" />
		<line x1="154" y1="12" x2="240" y2="12" stroke="currentColor" stroke-width="1" opacity="0.5" />
		<path d="M120 4c6 0 10 3.6 10 8s-4 8-10 8-10-3.6-10-8 4-8 10-8Z" fill="currentColor" opacity="0.85" />
		<path d="M104 12c5-4 9-4 14 0-5 4-9 4-14 0Z" fill="currentColor" opacity="0.5" />
		<path d="M136 12c-5-4-9-4-14 0 5 4 9 4 14 0Z" fill="currentColor" opacity="0.5" />
	</svg>
{:else if variant === 'sparkle'}
	<svg class="sparkle {cls} {animClass}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<path
			d="M12 2c1.5 5 3.5 7 8.5 8.5-5 1.5-7 3.5-8.5 8.5-1.5-5-3.5-7-8.5-8.5C8.5 9 10.5 7 12 2Z"
			fill="currentColor"
		/>
	</svg>
{:else if variant === 'leaf-vine'}
	<!-- Sulur daun melengkung (bisa berayun) -->
	<svg class="vine {cls} {animClass}" viewBox="0 0 120 220" fill="none" aria-hidden="true">
		<g stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.9">
			<path d="M60 216C60 176 46 158 46 128S60 78 60 44 60 12 60 4" />
			<path d="M52 190c-14-2-24-10-28-24 14 0 24 6 28 24Z" fill="currentColor" stroke="none" opacity="0.55" />
			<path d="M68 156c14-2 24-10 28-24-14 0-24 6-28 24Z" fill="currentColor" stroke="none" opacity="0.55" />
			<path d="M52 120c-14-2-24-10-28-24 14 0 24 6 28 24Z" fill="currentColor" stroke="none" opacity="0.55" />
			<path d="M68 86c14-2 24-10 28-24-14 0-24 6-28 24Z" fill="currentColor" stroke="none" opacity="0.55" />
			<path d="M55 58c-12-2-20-8-24-20 12 0 20 6 24 20Z" fill="currentColor" stroke="none" opacity="0.5" />
		</g>
		<g fill="currentColor" opacity="0.75">
			<circle cx="60" cy="4" r="4" />
			<circle cx="46" cy="128" r="2.4" />
			<circle cx="60" cy="44" r="2.4" />
		</g>
	</svg>
{:else if variant === 'flower-cluster'}
	<!-- Gerombolan bunga watercolor -->
	<svg class="cluster {cls} {animClass}" viewBox="0 0 200 200" fill="none" aria-hidden="true">
		<g fill="currentColor">
			<!-- bunga besar -->
			<g opacity="0.9">
				<circle cx="70" cy="70" r="22" />
				<circle cx="52" cy="52" r="14" />
				<circle cx="88" cy="52" r="14" />
				<circle cx="52" cy="88" r="14" />
				<circle cx="88" cy="88" r="14" />
			</g>
			<circle cx="70" cy="70" r="9" opacity="0.55" />
			<!-- bunga sedang -->
			<g opacity="0.85">
				<circle cx="132" cy="118" r="17" />
				<circle cx="117" cy="103" r="11" />
				<circle cx="147" cy="103" r="11" />
				<circle cx="117" cy="133" r="11" />
				<circle cx="147" cy="133" r="11" />
			</g>
			<circle cx="132" cy="118" r="7" opacity="0.5" />
			<!-- kuncup kecil -->
			<circle cx="150" cy="58" r="10" opacity="0.8" />
			<circle cx="46" cy="140" r="9" opacity="0.75" />
			<circle cx="100" cy="160" r="7" opacity="0.7" />
			<circle cx="168" cy="82" r="5" opacity="0.6" />
			<!-- daun penyeimbang -->
			<path d="M100 92c10-10 22-12 34-8-10 10-22 12-34 8Z" opacity="0.45" />
			<path d="M96 128c-12-6-26-4-36 6 12 6 26 4 36-6Z" opacity="0.4" />
		</g>
	</svg>
{:else if variant === 'peacock'}
	<!-- Burung merak sederhana bergaya (tema adat/premium) -->
	<svg class="peacock {cls} {animClass}" viewBox="0 0 200 220" fill="none" aria-hidden="true">
		<!-- kipas ekor -->
		<g fill="currentColor" opacity="0.35">
			<path d="M100 150C56 150 26 122 26 86S56 22 100 22s74 28 74 64-30 64-74 64Z" />
		</g>
		<g fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.7">
			<path d="M100 150 60 60" />
			<path d="M100 150 78 40" />
			<path d="M100 150 100 34" />
			<path d="M100 150 122 40" />
			<path d="M100 150 140 60" />
			<path d="M100 150 44 90" />
			<path d="M100 150 156 90" />
		</g>
		<!-- mata ekor -->
		<g fill="currentColor" opacity="0.85">
			<circle cx="100" cy="34" r="4" />
			<circle cx="78" cy="40" r="3.4" />
			<circle cx="122" cy="40" r="3.4" />
			<circle cx="60" cy="60" r="3" />
			<circle cx="140" cy="60" r="3" />
			<circle cx="44" cy="90" r="2.6" />
			<circle cx="156" cy="90" r="2.6" />
		</g>
		<!-- badan & kepala -->
		<g fill="currentColor" opacity="0.9">
			<path d="M100 108c14 0 24 12 24 34 0 18-10 34-24 34s-24-16-24-34c0-22 10-34 24-34Z" />
			<path d="M100 96c6-8 6-16 2-24 8 4 12 12 10 22l-6 4Z" />
			<circle cx="104" cy="70" r="4" />
		</g>
		<path d="M100 108v68" stroke="currentColor" stroke-width="1" opacity="0.4" />
	</svg>
{:else if variant === 'batik-kawung'}
	<!-- Motif kawung (Jawa) — empat bulatan/pilin di sekitar pusat -->
	<svg class="kawung {cls} {animClass}" viewBox="0 0 200 200" fill="none" aria-hidden="true">
		<g fill="currentColor" opacity="0.85">
			<!-- kawung 2x2 -->
			<path d="M100 12c22 0 40 18 40 40s-18 40-40 40-40-18-40-40 18-40 40-40Z" opacity="0.5" />
			<path d="M100 108c22 0 40 18 40 40s-18 40-40 40-40-18-40-40 18-40 40-40Z" opacity="0.5" />
			<path d="M52 60c22 0 40 18 40 40s-18 40-40 40-40-18-40-40 18-40 40-40Z" opacity="0.5" />
			<path d="M148 60c22 0 40 18 40 40s-18 40-40 40-40-18-40-40 18-40 40-40Z" opacity="0.5" />
		</g>
		<g fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.9">
			<circle cx="100" cy="52" r="12" />
			<circle cx="100" cy="148" r="12" />
			<circle cx="52" cy="100" r="12" />
			<circle cx="148" cy="100" r="12" />
			<circle cx="100" cy="100" r="7" />
		</g>
		<g fill="currentColor" opacity="0.8">
			<circle cx="100" cy="52" r="3" />
			<circle cx="100" cy="148" r="3" />
			<circle cx="52" cy="100" r="3" />
			<circle cx="148" cy="100" r="3" />
		</g>
	</svg>
{:else if variant === 'songket'}
	<!-- Motif songket Minang — zig-zag/anyaman emas -->
	<svg class="songket {cls} {animClass}" viewBox="0 0 240 60" fill="none" aria-hidden="true">
		<g stroke="currentColor" fill="none" stroke-width="1.6" stroke-linejoin="round" opacity="0.9">
			<path d="M0 30 20 10 40 30 60 10 80 30 100 10 120 30 140 10 160 30 180 10 200 30 220 10 240 30" />
			<path d="M0 46 20 26 40 46 60 26 80 46 100 26 120 46 140 26 160 46 180 26 200 46 220 26 240 46" opacity="0.5" />
			<path d="M0 14 20 34 40 14 60 34 80 14 100 34 120 14 140 34 160 14 180 34 200 14 220 34 240 14" opacity="0.5" />
		</g>
		<g fill="currentColor" opacity="0.85">
			<circle cx="20" cy="30" r="2.4" />
			<circle cx="60" cy="30" r="2.4" />
			<circle cx="100" cy="30" r="2.4" />
			<circle cx="140" cy="30" r="2.4" />
			<circle cx="180" cy="30" r="2.4" />
			<circle cx="220" cy="30" r="2.4" />
		</g>
	</svg>
{:else if variant === 'corner-adat'}
	<!-- Sudut bermotif batik/songket untuk tema adat -->
	<svg class="orn-adat {cls} {animClass}" viewBox="0 0 200 200" fill="none" aria-hidden="true">
		<g stroke="currentColor" stroke-width="1.4" fill="none" opacity="0.9">
			<path d="M6 6h60M6 6v60" stroke-width="2" />
			<path d="M14 14c30 0 48 18 48 48" />
			<path d="M14 14c0 30 18 48 48 48" />
			<path d="M22 22 44 44M22 40 40 22" opacity="0.6" />
		</g>
		<!-- aksen kawung -->
		<g fill="currentColor" opacity="0.55">
			<circle cx="44" cy="44" r="6" />
			<path d="M44 24c9 0 16 7 16 16s-7 16-16 16-16-7-16-16 7-16 16-16Z" opacity="0.4" />
			<path d="M24 44c9 0 16 7 16 16s-7 16-16 16-16-7-16-16 7-16 16-16Z" opacity="0.4" />
		</g>
		<!-- sulur songket -->
		<g stroke="currentColor" fill="none" stroke-width="1" opacity="0.7">
			<path d="M70 42 82 54 70 66M42 70 54 82 66 70" />
			<path d="M96 30c8 6 12 14 12 24" opacity="0.5" />
		</g>
		<g fill="currentColor" opacity="0.7">
			<circle cx="82" cy="54" r="2.4" />
			<circle cx="54" cy="82" r="2.4" />
		</g>
	</svg>
{/if}

<style>
	.orn,
	.vine,
	.cluster,
	.peacock,
	.kawung,
	.orn-adat {
		width: 100%;
		height: 100%;
		display: block;
		transform-box: fill-box;
	}
	.divider {
		width: 190px;
		height: 24px;
	}
	.sparkle {
		width: 22px;
		height: 22px;
	}
	.divider,
	.sparkle,
	.songket {
		display: block;
		margin: 0 auto;
	}
	.songket {
		width: 240px;
		height: 60px;
	}
	.vine {
		max-width: 120px;
	}
</style>
