/**
 * api.ts (client) — pembungkus fetch dengan header auth.
 * Menyimpan slug & password admin di localStorage.
 */
import { browser } from '$app/environment';

const LS_KEY = 'wedding.admin';

export interface AdminCreds {
	slug: string;
	password: string;
}

export function saveCreds(c: AdminCreds) {
	if (browser) localStorage.setItem(LS_KEY, JSON.stringify(c));
}
export function loadCreds(): AdminCreds | null {
	if (!browser) return null;
	try {
		return JSON.parse(localStorage.getItem(LS_KEY) || 'null');
	} catch {
		return null;
	}
}
export function clearCreds() {
	if (browser) localStorage.removeItem(LS_KEY);
}

/** Fetch dengan header admin otomatis. */
export async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
	const c = loadCreds();
	const headers = new Headers(opts.headers);
	if (c) {
		headers.set('x-account', c.slug);
		headers.set('x-admin-password', c.password);
	}
	if (opts.body && typeof opts.body === 'string') headers.set('Content-Type', 'application/json');
	return fetch(path, { ...opts, headers });
}

/** JSON helper. */
export async function apiJson<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
	const r = await apiFetch(path, opts);
	if (!r.ok) {
		const e = await r.json().catch(() => ({ message: r.statusText }));
		throw new Error(e.message || 'Terjadi kesalahan.');
	}
	return r.json();
}

const OWNER_KEY = 'wedding.owner';
export function saveOwnerPw(pw: string) {
	if (browser) localStorage.setItem(OWNER_KEY, pw);
}
export function loadOwnerPw(): string {
	return browser ? localStorage.getItem(OWNER_KEY) || '' : '';
}
export function clearOwnerPw() {
	if (browser) localStorage.removeItem(OWNER_KEY);
}

/** Fetch untuk owner. */
export async function ownerFetch(path: string, opts: RequestInit = {}): Promise<Response> {
	const headers = new Headers(opts.headers);
	headers.set('x-owner-password', loadOwnerPw());
	if (opts.body && typeof opts.body === 'string') headers.set('Content-Type', 'application/json');
	return fetch(path, { ...opts, headers });
}
export async function ownerJson<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
	const r = await ownerFetch(path, opts);
	if (!r.ok) {
		const e = await r.json().catch(() => ({ message: r.statusText }));
		throw new Error(e.message || 'Terjadi kesalahan.');
	}
	return r.json();
}
