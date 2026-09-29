'use strict';

/**
 * security.js — Utilitas keamanan ringan tanpa dependensi eksternal.
 *
 * - Hash password admin dengan scrypt (node:crypto), kompatibel dengan
 *   password lama yang masih plaintext (lihat verifyPassword).
 * - Rate limiter in-memory sederhana untuk membatasi spam pada endpoint publik.
 */

const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Password hashing (scrypt)
// ---------------------------------------------------------------------------
const SCRYPT_KEYLEN = 64;
const HASH_PREFIX = 'scrypt$';

/**
 * Buat hash password dengan scrypt + salt acak.
 * Format tersimpan: `scrypt$<saltHex>$<hashHex>`
 * @param {string} password
 * @returns {string}
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN);
  return `${HASH_PREFIX}${salt.toString('hex')}$${derived.toString('hex')}`;
}

/**
 * Cek apakah sebuah string sudah berupa hash scrypt yang kita buat.
 * @param {string} value
 * @returns {boolean}
 */
function isHashed(value) {
  return typeof value === 'string' && value.startsWith(HASH_PREFIX) && value.split('$').length === 3;
}

/**
 * Verifikasi password terhadap nilai tersimpan.
 * Mendukung dua format:
 *  - hash scrypt (`scrypt$salt$hash`)  -> perbandingan aman waktu konstan
 *  - plaintext (data lama)             -> dibandingkan langsung
 *
 * @param {string} password - input dari user
 * @param {string} stored   - nilai di database
 * @returns {{ ok: boolean, legacy: boolean }} legacy=true bila stored masih plaintext
 */
function verifyPassword(password, stored) {
  if (password == null || stored == null) return { ok: false, legacy: false };

  if (isHashed(stored)) {
    const [, saltHex, hashHex] = stored.split('$');
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const derived = crypto.scryptSync(String(password), salt, expected.length);
    const ok = derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
    return { ok, legacy: false };
  }

  // Format lama: plaintext. Bandingkan dengan aman.
  const a = Buffer.from(String(password));
  const b = Buffer.from(String(stored));
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { ok, legacy: true };
}

// ---------------------------------------------------------------------------
// Rate limiter in-memory (fixed window)
// ---------------------------------------------------------------------------
/**
 * Membuat middleware rate limiter berbasis IP + key.
 * @param {object} opts
 * @param {number} opts.windowMs  - panjang jendela waktu (ms)
 * @param {number} opts.max       - maksimum request per jendela
 * @param {string} [opts.message] - pesan error
 * @returns {import('express').RequestHandler}
 */
function rateLimit({ windowMs, max, message } = {}) {
  const hits = new Map(); // key -> { count, resetAt }

  // Bersihkan entri kedaluwarsa secara berkala (tanpa menahan event loop).
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, rec] of hits) {
      if (rec.resetAt <= now) hits.delete(key);
    }
  }, Math.max(windowMs, 60000));
  if (cleanup.unref) cleanup.unref();

  return function rateLimiter(req, res, next) {
    // req.ip butuh app.set('trust proxy', ...) bila di belakang proxy.
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${req.path}|${ip}`;
    const now = Date.now();

    let rec = hits.get(key);
    if (!rec || rec.resetAt <= now) {
      rec = { count: 0, resetAt: now + windowMs };
      hits.set(key, rec);
    }

    rec.count += 1;
    const remaining = Math.max(0, max - rec.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (rec.count > max) {
      const retryAfter = Math.ceil((rec.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message || 'Terlalu banyak permintaan. Coba lagi nanti.' });
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// Security headers (pengganti ringan helmet)
// ---------------------------------------------------------------------------
/**
 * Middleware penambah security headers dasar.
 * @returns {import('express').RequestHandler}
 */
function securityHeaders() {
  return function headers(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  };
}

module.exports = { hashPassword, verifyPassword, isHashed, rateLimit, securityHeaders };
