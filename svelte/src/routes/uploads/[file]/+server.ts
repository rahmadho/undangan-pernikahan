import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { UPLOAD_DIR } from '$lib/server/upload';

const MIME: Record<string, string> = {
	'.mp3': 'audio/mpeg',
	'.m4a': 'audio/mp4',
	'.ogg': 'audio/ogg',
	'.wav': 'audio/wav',
	'.aac': 'audio/aac',
	'.flac': 'audio/flac',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml'
};

/** GET /uploads/[file] — sajikan file upload. */
export const GET: RequestHandler = async ({ params }) => {
	// Cegah path traversal.
	const name = basename(params.file || '');
	if (!name || name.includes('..')) throw error(400, { message: 'Nama file tidak valid.' });

	try {
		const buf = await readFile(join(UPLOAD_DIR, name));
		const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
		return new Response(new Uint8Array(buf), {
			headers: {
				'Content-Type': MIME[ext] || 'application/octet-stream',
				'Cache-Control': 'public, max-age=31536000, immutable'
			}
		});
	} catch {
		throw error(404, { message: 'File tidak ditemukan.' });
	}
};
