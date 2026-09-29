'use strict';

/**
 * env.js — memuat variabel dari file `.env` (bila ada) SEBELUM modul lain
 * membaca process.env. Modul ini di-require paling awal di server/index.js.
 *
 * - Memakai paket `dotenv` bila terpasang (opsional, tidak wajib).
 * - Bila `dotenv` tidak ada, dipakai pembaca `.env` minimal bawaan supaya
 *   aplikasi tetap jalan tanpa dependensi tambahan.
 * - Tidak menimpa env yang sudah di-set oleh sistem/hosting.
 */

const fs = require('fs');
const path = require('path');

let loaded = false;

function loadEnvDotFile(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return false; // file tidak ada -> lewati
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // buang kutip pembungkus
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
  return true;
}

function loadEnv() {
  if (loaded) return;
  loaded = true;

  try {
    // dotenv (opsional) — cari .env di root proyek.
    const dotenv = require('dotenv');
    dotenv.config({ path: path.join(__dirname, '..', '.env') });
    return;
  } catch {
    /* dotenv tidak terpasang -> pakai fallback di bawah */
  }

  loadEnvDotFile(path.join(__dirname, '..', '.env'));
}

module.exports = { loadEnv, loadEnvDotFile };
