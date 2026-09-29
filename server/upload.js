'use strict';

/**
 * upload.js — Konfigurasi unggah file (multer) untuk musik latar undangan.
 *
 * File disimpan di `data/uploads/` dengan nama unik, disajikan statis di
 * `/uploads/<nama>`. Menerima file audio (mp3, m4a, ogg, wav, aac — maks 10 MB)
 * dan gambar latar (jpg, png, webp, avif, gif — maks 6 MB).
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

// Gambar latar: hanya format web (jangan SVG — bisa memuat skrip).
const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);
const IMAGE_MAX_BYTES = Number(process.env.IMAGE_MAX_MB || 6) * 1024 * 1024;

function makeStorage(prefix, allowedExt, fallbackExt) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = allowedExt.has(ext) ? ext : fallbackExt;
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      cb(null, `${prefix}-${unique}${safeExt}`);
    },
  });
}

function makeFilter(allowedMime, allowedExt, message) {
  return (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const okMime = allowedMime.has(String(file.mimetype).toLowerCase());
    const okExt = allowedExt.has(ext);
    if (okMime || okExt) return cb(null, true);
    cb(new Error(message));
  };
}

const uploadMusic = multer({
  storage: makeStorage('music', ALLOWED_EXT, '.mp3'),
  fileFilter: makeFilter(ALLOWED_MIME, ALLOWED_EXT, 'Format file tidak didukung. Gunakan MP3, M4A, OGG, WAV, AAC, atau FLAC.'),
  limits: { fileSize: MAX_BYTES, files: 1 },
});

const uploadImage = multer({
  storage: makeStorage('img', IMAGE_EXT, '.jpg'),
  fileFilter: makeFilter(IMAGE_MIME, IMAGE_EXT, 'Format gambar tidak didukung. Gunakan JPG, PNG, WEBP, AVIF, atau GIF.'),
  limits: { fileSize: IMAGE_MAX_BYTES, files: 1 },
});

module.exports = { uploadMusic, uploadImage, UPLOAD_DIR, MAX_BYTES, IMAGE_MAX_BYTES };
