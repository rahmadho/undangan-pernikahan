'use strict';

/**
 * upload.js — Konfigurasi unggah file (multer) untuk musik latar undangan.
 *
 * File disimpan di `data/uploads/` dengan nama unik, disajikan statis di
 * `/uploads/<nama>`. Hanya menerima file audio (mp3, m4a, ogg, wav, aac)
 * dengan batas ukuran 10 MB.
 *
 * Dipisah dari index.js supaya mudah diuji & diganti storage-nya
 * (mis. S3 di masa depan).
 */

const fs = require('fs');
const path = require('path');
const multer = require('multer');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_BYTES = Number(process.env.UPLOAD_MAX_MB || 10) * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a',
  'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/webm',
  'audio/flac', 'audio/x-flac',
]);
const ALLOWED_EXT = new Set(['.mp3', '.m4a', '.ogg', '.wav', '.aac', '.webm', '.flac']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXT.has(ext) ? ext : '.mp3';
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    cb(null, `music-${unique}${safeExt}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const okMime = ALLOWED_MIME.has(String(file.mimetype).toLowerCase());
  const okExt = ALLOWED_EXT.has(ext);
  if (okMime || okExt) return cb(null, true);
  cb(new Error('Format file tidak didukung. Gunakan MP3, M4A, OGG, WAV, AAC, atau FLAC.'));
}

const uploadMusic = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_BYTES, files: 1 },
});

module.exports = { uploadMusic, UPLOAD_DIR, MAX_BYTES };
