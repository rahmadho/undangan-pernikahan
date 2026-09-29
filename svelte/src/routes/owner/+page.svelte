<script lang="ts">
	import { onMount } from 'svelte';
	import { ownerJson, saveOwnerPw, loadOwnerPw, clearOwnerPw } from '$lib/api';

	let ready = $state(false);
	let authed = $state(false);
	let password = $state('');
	let err = $state('');
	let loading = $state(false);
	let accounts = $state<any[]>([]);
	let toast = $state('');

	const THEMES = ['botanical', 'midnight', 'blush', 'javanese', 'minimal', 'baroque'];

	// form buat client
	let nTitle = $state('');
	let nSlug = $state('');
	let nPassword = $state('');
	let nDays = $state(90);
	let nTheme = $state('botanical');

	onMount(async () => {
		const pw = loadOwnerPw();
		if (pw) {
			password = pw;
			await login(true);
		}
		ready = true;
	});

	async function login(silent = false) {
		err = '';
		loading = true;
		try {
			const r = await fetch('/api/owner/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password })
			});
			if (!r.ok) {
				if (!silent) err = (await r.json()).message || 'Password salah.';
				clearOwnerPw();
				return;
			}
			saveOwnerPw(password);
			authed = true;
			await load();
		} catch {
			if (!silent) err = 'Tidak dapat menghubungi server.';
		} finally {
			loading = false;
		}
	}

	function logout() {
		clearOwnerPw();
		authed = false;
	}

	async function load() {
		accounts = await ownerJson('/api/owner/accounts');
	}

	function showToast(m: string) {
		toast = m;
		setTimeout(() => (toast = ''), 2500);
	}

	async function createAccount() {
		if (!nTitle.trim() || nPassword.length < 5) {
			showToast('Judul & password (min 5) wajib diisi.');
			return;
		}
		try {
			await ownerJson('/api/owner/accounts', {
				method: 'POST',
				body: JSON.stringify({ title: nTitle, slug: nSlug, password: nPassword, days: nDays, theme: nTheme })
			});
			nTitle = '';
			nSlug = '';
			nPassword = '';
			await load();
			showToast('Client dibuat ✓');
		} catch (e) {
			showToast((e as Error).message);
		}
	}

	async function toggleStatus(a: any) {
		const status = a.status === 'active' ? 'suspended' : 'active';
		await ownerJson('/api/owner/accounts', { method: 'PUT', body: JSON.stringify({ id: a.id, status }) });
		await load();
		showToast('Status diubah');
	}

	async function extend(a: any, days: number) {
		await ownerJson('/api/owner/accounts', { method: 'PUT', body: JSON.stringify({ id: a.id, days }) });
		await load();
		showToast(`Diperpanjang ${days} hari`);
	}

	async function changePw(a: any) {
		const pw = prompt(`Password baru untuk ${a.title}:`);
		if (!pw || pw.length < 5) return;
		await ownerJson('/api/owner/accounts', { method: 'PUT', body: JSON.stringify({ id: a.id, password: pw }) });
		showToast('Password diganti ✓');
	}

	async function del(a: any) {
		if (!confirm(`Hapus client "${a.title}" beserta SEMUA datanya? Tindakan ini permanen.`)) return;
		await ownerJson('/api/owner/accounts?id=' + a.id, { method: 'DELETE' });
		await load();
		showToast('Client dihapus');
	}

	function fmtDate(s: string | null) {
		if (!s) return 'tanpa batas';
		return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
	}
	function expired(s: string | null) {
		return s ? new Date(s).getTime() < Date.now() : false;
	}
</script>

<svelte:head><title>Owner — Panel SaaS</title></svelte:head>

{#if toast}<div class="toast">{toast}</div>{/if}

{#if !ready}
	<div class="center">Memuat…</div>
{:else if !authed}
	<div class="center">
		<form class="login" onsubmit={(e) => { e.preventDefault(); login(); }}>
			<h1>👑 Owner Panel</h1>
			<p class="sub">Kelola semua client undangan</p>
			<label for="opw">Password Owner</label>
			<input id="opw" type="password" bind:value={password} />
			{#if err}<p class="err">{err}</p>{/if}
			<button class="btn" disabled={loading}>{loading ? '…' : 'Masuk'}</button>
		</form>
	</div>
{:else}
	<header class="topbar">
		<strong>👑 Owner Panel</strong>
		<div class="acts">
			<span class="muted">{accounts.length} client</span>
			<button class="ghost" onclick={logout}>Keluar</button>
		</div>
	</header>

	<main class="wrap">
		<div class="card">
			<h3>Buat Client Baru</h3>
			<div class="grid2">
				<input bind:value={nTitle} placeholder="Nama pasangan (mis. Dewi & Arif)" />
				<input bind:value={nSlug} placeholder="Slug URL (opsional)" />
			</div>
			<div class="grid3">
				<input bind:value={nPassword} placeholder="Password admin client" />
				<input type="number" bind:value={nDays} min="1" placeholder="Masa aktif (hari)" />
				<select bind:value={nTheme}>{#each THEMES as t}<option>{t}</option>{/each}</select>
			</div>
			<button class="btn" onclick={createAccount}>+ Buat Client</button>
		</div>

		<div class="card">
			<h3>Daftar Client</h3>
			<table>
				<thead>
					<tr><th>Judul</th><th>Slug</th><th>Tema</th><th>Status</th><th>Aktif s/d</th><th>Tamu</th><th>RSVP</th><th></th></tr>
				</thead>
				<tbody>
					{#each accounts as a}
						<tr>
							<td><strong>{a.title}</strong></td>
							<td><a href={`/u/${a.slug}`} target="_blank">/{a.slug}</a></td>
							<td>{a.theme}</td>
							<td>
								<span class="pill" class:off={a.status !== 'active'}>{a.status}</span>
								{#if expired(a.expires_at)}<span class="pill off">kedaluwarsa</span>{/if}
							</td>
							<td>{fmtDate(a.expires_at)}</td>
							<td>{a.guest_count}</td>
							<td>{a.rsvp_count}</td>
							<td class="acts">
								<button class="ghost sm" onclick={() => toggleStatus(a)}>{a.status === 'active' ? 'Suspend' : 'Aktifkan'}</button>
								<button class="ghost sm" onclick={() => extend(a, 30)}>+30h</button>
								<button class="ghost sm" onclick={() => changePw(a)}>Pw</button>
								<button class="danger sm" onclick={() => del(a)}>Hapus</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</main>
{/if}

<style>
	:global(body) { background: #14131a; color: #eee; }
	.center { display: grid; place-items: center; min-height: 100vh; padding: 1rem; }
	.login { background: #201e2a; border-radius: 16px; padding: 2rem; width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: .4rem; }
	.login h1 { margin: 0; font-size: 1.4rem; }
	.sub { color: #999; font-size: .84rem; margin: 0 0 .6rem; }
	.err { color: #ff8080; font-size: .82rem; }
	.topbar { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.4rem; border-bottom: 1px solid #2c2a38; position: sticky; top: 0; background: #14131a; z-index: 10; }
	.wrap { max-width: 1100px; margin: 0 auto; padding: 1.4rem; }
	.card { background: #201e2a; border-radius: 14px; padding: 1.4rem; margin-bottom: 1.2rem; display: flex; flex-direction: column; gap: .5rem; }
	.card h3 { margin: 0 0 .4rem; }
	label { font-size: .76rem; color: #aaa; text-transform: uppercase; }
	input, select { background: #2a2836; border: 1px solid #38354a; color: #eee; padding: .6rem .7rem; border-radius: 8px; font-family: inherit; width: 100%; }
	.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: .6rem; }
	.grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: .6rem; }
	@media (max-width: 640px) { .grid2, .grid3 { grid-template-columns: 1fr; } }
	.btn { background: #d8b978; color: #201e2a; border: 0; border-radius: 10px; padding: .7rem 1.3rem; cursor: pointer; font-weight: 600; align-self: flex-start; }
	.ghost { background: transparent; border: 1px solid #555; color: #ccc; border-radius: 8px; padding: .35rem .7rem; cursor: pointer; font-size: .78rem; }
	.ghost.sm, .danger.sm { padding: .25rem .5rem; font-size: .7rem; }
	.danger { background: #7a2a2a; color: #ffd0d0; border: 0; border-radius: 8px; padding: .35rem .7rem; cursor: pointer; }
	.acts { display: flex; gap: .3rem; flex-wrap: wrap; }
	table { width: 100%; border-collapse: collapse; font-size: .82rem; }
	th, td { text-align: left; padding: .5rem .4rem; border-bottom: 1px solid #2c2a38; }
	th { color: #999; font-size: .7rem; text-transform: uppercase; }
	a { color: #d8b978; }
	.pill { background: #2e4a34; color: #b6e6c2; border-radius: 999px; padding: 2px 8px; font-size: .68rem; }
	.pill.off { background: #4a2a2a; color: #ffb6b6; }
	.muted { color: #888; font-size: .8rem; }
	.toast { position: fixed; bottom: 1.2rem; left: 50%; transform: translateX(-50%); background: #d8b978; color: #201e2a; padding: .7rem 1.4rem; border-radius: 999px; font-weight: 600; z-index: 100; }
</style>
