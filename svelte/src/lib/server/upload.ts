/**
 * upload.ts — Simpan file upload (musik/gambar) ke disk.
 *
 * SvelteKit memakai Web Request/FormData, jadi kita TIDAK pakai multer —
 * cukup baca File dari formData() lalu tulis dengan fs. Lebih ringan & aman.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';

/** Direktori upload (relatif ke cwd server). */
export const UPLOAD_DIR = env.UPLOAD_DIR || './data/uploads';
export const PUBLIC_PREFIX = '/uploads';

const AUDIO_EXT = ['.mp3', '.m4a', '.ogg', '.wav', '.aac', '.flac'];
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
const AUDIO_MIME = ['audio/'];
const IMAGE_MIME = ['image/'];

export type UploadKind = 'audio' | 'image';

export interface UploadResult {
	url: string;
	name: string;
	size: number;
}

/**
 * Simpan satu file dari FormData.
 * @throws Error dengan pesan ramah bila tipe/ukuran tidak valid.
 */
export async function saveUpload(file: File, kind: UploadKind): Promise<UploadResult> {
	const ext = extname(file.name).toLowerCase();
	const allowedExt = kind === 'audio' ? AUDIO_EXT : IMAGE_EXT;
	const allowedMime = kind === 'audio' ? AUDIO_MIME : IMAGE_MIME;

	if (!allowedExt.includes(ext)) {
		throw new Error(
			kind === 'audio'
				? `Format audio harus salah satu: ${AUDIO_EXT.join(', ')}`
				: `Format gambar harus salah satu: ${IMAGE_EXT.join(', ')}`
		);
	}
	// Terima bila MIME spesifik cocok ATAU MIME generik (banyak klien/tools
	// mengirim application/octet-stream). Ekstensi sudah diverifikasi di atas.
	const genericMime = !file.type || file.type === 'application/octet-stream';
	if (!genericMime && !allowedMime.some((m) => file.type.startsWith(m))) {
		throw new Error('Tipe file tidak sesuai.');
	}

	const maxMb = kind === 'audio' ? Number(env.UPLOAD_MAX_MB) || 10 : Number(env.IMAGE_MAX_MB) || 6;
	if (file.size > maxMb * 1024 * 1024) {
		throw new Error(`Ukuran file maksimal ${maxMb} MB.`);
	}

	await mkdir(UPLOAD_DIR, { recursive: true });
	const name = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`;
	const buf = Buffer.from(await file.arrayBuffer());
	await writeFile(join(UPLOAD_DIR, name), buf);

	return { url: `${PUBLIC_PREFIX}/${name}`, name, size: file.size };
}

/**
 * Simpan byte gambar mentah (hasil unduhan importer) ke disk.
 * Ekstensi sudah divalidasi pemanggil (whitelist MIME jpg/png/webp/avif/gif).
 * @returns URL publik `/uploads/img-<uniq><ext>`.
 */
export async function saveImageBytes(buf: Buffer, ext: string): Promise<UploadResult> {
	const safeExt = /^\.(jpg|jpeg|png|webp|avif|gif)$/i.test(ext) ? ext.toLowerCase() : '.jpg';
	await mkdir(UPLOAD_DIR, { recursive: true });
	const name = `img-${Date.now()}-${randomBytes(4).toString('hex')}${safeExt}`;
	await writeFile(join(UPLOAD_DIR, name), buf);
	return { url: `${PUBLIC_PREFIX}/${name}`, name, size: buf.byteLength };
}
