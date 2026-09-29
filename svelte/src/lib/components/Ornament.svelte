<script lang="ts">
	/**
	 * Ornament.svelte — dekorasi floral SVG (bisa diwarnai via currentColor).
	 * Varian: corner (sudut), divider (pembatas), sparkle.
	 */
	let { variant = 'corner', class: cls = '' }: { variant?: string; class?: string } = $props();
</script>

{#if variant === 'corner'}
	<svg class="orn {cls}" viewBox="0 0 200 200" fill="none" aria-hidden="true">
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
	<svg class="divider {cls}" viewBox="0 0 240 24" fill="none" aria-hidden="true">
		<line x1="0" y1="12" x2="86" y2="12" stroke="currentColor" stroke-width="1" opacity="0.5" />
		<line x1="154" y1="12" x2="240" y2="12" stroke="currentColor" stroke-width="1" opacity="0.5" />
		<path d="M120 4c6 0 10 3.6 10 8s-4 8-10 8-10-3.6-10-8 4-8 10-8Z" fill="currentColor" opacity="0.85" />
		<path d="M104 12c5-4 9-4 14 0-5 4-9 4-14 0Z" fill="currentColor" opacity="0.5" />
		<path d="M136 12c-5-4-9-4-14 0 5 4 9 4 14 0Z" fill="currentColor" opacity="0.5" />
	</svg>
{:else if variant === 'sparkle'}
	<svg class="sparkle {cls}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<path
			d="M12 2c1.5 5 3.5 7 8.5 8.5-5 1.5-7 3.5-8.5 8.5-1.5-5-3.5-7-8.5-8.5C8.5 9 10.5 7 12 2Z"
			fill="currentColor"
		/>
	</svg>
{/if}

<style>
	.orn {
		width: 100%;
		height: 100%;
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
	.sparkle {
		display: block;
		margin: 0 auto;
	}
</style>
