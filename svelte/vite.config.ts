import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Paksa runes mode (Svelte 5) kecuali untuk library.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ out: 'build' }),
			csrf: { checkOrigin: true }
		})
	],
	server: {
		port: Number(process.env.PORT) || 3300,
		host: true
	}
});
