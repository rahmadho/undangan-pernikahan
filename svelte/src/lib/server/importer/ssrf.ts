/**
 * ssrf.ts — Guard SSRF + pengunduh gambar remote untuk mode `imageMode="download"`.
 *
 * Rujukan rancangan: `docs/import-json-rancangan.md` §5 & §7 (SSRF guard).
 *
 * Prinsip keamanan:
 *  1. Hanya izinkan skema http/https.
 *  2. Tolak host privat/loopback/link-local/ULA/multicast & metadata cloud
 *     (mis. 169.254.169.254) — baik IP literal maupun nama domain (di-resolve
 *     DNS lebih dulu agar tidak bisa bypass via hostname yang menunjuk IP privat).
 *  3. Redirect dibatasi (`maxRedirects`) dan SETIAP hop divalidasi ulang.
 *  4. Batas ukuran (Content-Length & total byte) untuk cegah DoS.
 *  5. Hanya MIME gambar aman (JPG/PNG/WEBP/AVIF/GIF). **SVG ditolak** (XSS).
 *
 * Modul ini tidak mengimpor `$env`; batas disuntikkan lewat parameter/opsi.
 */
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

/** MIME gambar yang diizinkan untuk diunduh (tanpa SVG). */
export const SAFE_IMAGE_MIMES = new Set([
	'image/jpeg',
	'image/jpg',
	'image/png',
	'image/webp',
	'image/avif',
	'image/gif'
]);

/** Ekstensi kanonik per MIME (untuk penamaan berkas). */
const MIME_EXT: Record<string, string> = {
	'image/jpeg': '.jpg',
	'image/jpg': '.jpg',
	'image/png': '.png',
	'image/webp': '.webp',
	'image/avif': '.avif',
	'image/gif': '.gif'
};

/** Apakah IPv4 masuk rentang privat/reserved (harus ditolak). */
function isPrivateIPv4(ip: string): boolean {
	const p = ip.split('.').map((x) => Number(x));
	if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return true;
	const [a, b] = p;
	if (a === 0) return true; // 0.0.0.0/8
	if (a === 10) return true; // 10/8
	if (a === 127) return true; // loopback
	if (a === 169 && b === 254) return true; // link-local / cloud metadata
	if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
	if (a === 192 && b === 168) return true; // 192.168/16
	if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
	if (a >= 224) return true; // multicast / reserved
	return false;
}

/** Apakah IPv6 privat/loopback/ULA/link-local (harus ditolak). */
function isPrivateIPv6(ip: string): boolean {
	const s = ip.toLowerCase().split('%')[0];
	if (s === '::1' || s === '::') return true;
	if (s.startsWith('fe80')) return true; // link-local
	if (s.startsWith('fc') || s.startsWith('fd')) return true; // ULA fc00::/7
	if (s.startsWith('ff')) return true; // multicast
	// IPv4-mapped (::ffff:a.b.c.d) → cek bagian IPv4-nya.
	const m = s.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
	if (m) return isPrivateIPv4(m[1]);
	return false;
}

/** Cek string IP literal (v4/v6) privat atau tidak. */
export function isPrivateIp(ip: string): boolean {
	const v = isIP(ip);
	if (v === 4) return isPrivateIPv4(ip);
	if (v === 6) return isPrivateIPv6(ip);
	return true; // bukan IP valid → anggap tidak aman.
}

/** Hasil validasi URL untuk unduhan. */
export interface UrlGuardResult {
	ok: boolean;
	reason?: string;
	url?: URL;
	/** Alamat IP publik yang di-resolve (dipakai pemanggil untuk pinning opsional). */
	addresses?: string[];
}

/**
 * Validasi URL remote aman untuk diunduh (tanpa memuat isi).
 * Melakukan resolusi DNS untuk memastikan SEMUA alamat hasil resolve publik.
 */
export async function guardRemoteUrl(raw: string): Promise<UrlGuardResult> {
	let url: URL;
	try {
		url = new URL(String(raw || '').trim());
	} catch {
		return { ok: false, reason: 'URL tidak valid.' };
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		return { ok: false, reason: `Protokol "${url.protocol}" tidak diizinkan (hanya http/https).` };
	}
	const host = url.hostname.replace(/^\[|\]$/g, '');
	// Tolak host tanpa titik yang bukan IP (mis. "localhost", nama internal).
	if (isIP(host) === 0 && !host.includes('.')) {
		return { ok: false, reason: 'Host tanpa domain publik tidak diizinkan.' };
	}
	if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) {
		return { ok: false, reason: 'Host internal/local tidak diizinkan.' };
	}

	// IP literal: cek langsung.
	if (isIP(host) !== 0) {
		if (isPrivateIp(host)) return { ok: false, reason: 'Alamat IP privat/loopback ditolak.' };
		return { ok: true, url, addresses: [host] };
	}

	// Nama domain: resolve DNS, pastikan tidak ada alamat privat.
	try {
		const results = await lookup(host, { all: true });
		if (!results.length) return { ok: false, reason: 'Host tidak dapat di-resolve.' };
		const addrs = results.map((r) => r.address);
		if (addrs.some((a) => isPrivateIp(a))) {
			return { ok: false, reason: 'Host menunjuk alamat privat (SSRF ditolak).' };
		}
		return { ok: true, url, addresses: addrs };
	} catch {
		return { ok: false, reason: 'Host tidak dapat di-resolve.' };
	}
}

export interface FetchImageOptions {
	/** Batas ukuran byte per gambar. */
	maxBytes: number;
	/** Maksimum redirect yang diikuti (default 3). */
	maxRedirects?: number;
	/** Timeout total (ms, default 8000). */
	timeoutMs?: number;
}

export interface FetchedImage {
	bytes: Buffer;
	mime: string;
	ext: string;
	/** URL final setelah redirect. */
	finalUrl: string;
}

/**
 * Unduh satu gambar remote dengan guard SSRF, batas ukuran, dan whitelist MIME.
 * @throws Error berbahasa Indonesia bila ditolak/gagal.
 */
export async function fetchImage(rawUrl: string, opts: FetchImageOptions): Promise<FetchedImage> {
	const maxRedirects = opts.maxRedirects ?? 3;
	const timeoutMs = opts.timeoutMs ?? 8000;
	let current = rawUrl;

	for (let hop = 0; hop <= maxRedirects; hop++) {
		const guard = await guardRemoteUrl(current);
		if (!guard.ok || !guard.url) throw new Error(guard.reason || 'URL ditolak.');

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		let res: Response;
		try {
			res = await fetch(guard.url, {
				redirect: 'manual',
				signal: controller.signal,
				headers: { 'user-agent': 'WeddingImporter/1.0 (+image-fetch)' }
			});
		} catch (e) {
			clearTimeout(timer);
			throw new Error(`Gagal mengunduh gambar: ${(e as Error).message}`);
		}
		clearTimeout(timer);

		// Redirect manual → validasi ulang hop berikutnya.
		if (res.status >= 300 && res.status < 400) {
			const loc = res.headers.get('location');
			if (!loc) throw new Error('Redirect tanpa tujuan.');
			current = new URL(loc, guard.url).toString();
			continue;
		}
		if (!res.ok) throw new Error(`Server gambar menolak (HTTP ${res.status}).`);

		const mime = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
		if (!SAFE_IMAGE_MIMES.has(mime)) {
			throw new Error(`Tipe konten tidak diizinkan: "${mime || 'tidak diketahui'}" (hanya gambar).`);
		}

		// Batas ukuran via Content-Length (awal) + total saat dibaca.
		const len = Number(res.headers.get('content-length') || '0');
		if (len && len > opts.maxBytes) {
			throw new Error(`Gambar melebihi batas ukuran (${Math.round(opts.maxBytes / 1024 / 1024)} MB).`);
		}
		const buf = Buffer.from(await res.arrayBuffer());
		if (buf.byteLength > opts.maxBytes) {
			throw new Error(`Gambar melebihi batas ukuran (${Math.round(opts.maxBytes / 1024 / 1024)} MB).`);
		}
		if (buf.byteLength === 0) throw new Error('Gambar kosong.');

		return { bytes: buf, mime, ext: MIME_EXT[mime] || '.jpg', finalUrl: guard.url.toString() };
	}
	throw new Error('Terlalu banyak pengalihan (redirect).');
}
