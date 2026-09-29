<script lang="ts">
	import { page } from '$app/state';
</script>

<div style="padding:2rem;font-family:sans-serif;max-width:700px;margin:0 auto">
	<h1>Terjadi kesalahan ({page.status})</h1>
	<p>{page.error?.message}</p>
	<a href="/">← Kembali</a>
</div>
