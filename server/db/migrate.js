'use strict';

/**
 * migrate.js — Utilitas migrasi/seed database lintas-backend (SQLite & Postgres).
 *
 * Tujuan: satu perintah untuk menyiapkan database di server produksi:
 *
 *   node server/db/migrate.js            # buat tabel + owner + data contoh bila kosong
 *   node server/db/migrate.js --force    # timpa data contoh account "demo"
 *   node server/db/migrate.js --no-seed  # hanya tabel + owner (tanpa data contoh)
 *
 * Karena `schema.js` dan `seed.js` saat ini SINKRON (SQLite):
 *   - Pada SQLite  : menjalankan init() + seed() secara langsung.
 *   - Pada Postgres: DDL dibuat via adapter async (await db.exec), namun
 *     pengisian data contoh dilewati dengan peringatan (butuh versi async).
 *     Tabel tetap tercipta sehingga aplikasi bisa dipakai; owner dibuat
 *     otomatis saat server pertama kali start.
 */

const { loadEnv } = require('../env');
loadEnv();

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const noSeed = args.includes('--no-seed');

  const { db, init } = require('./schema');

  const IS_PG = ['postgres', 'pg'].includes(String(process.env.DB_CLIENT || 'sqlite').toLowerCase());

  // 1) Buat tabel (untuk SQLite `init()` sudah dipanggil saat require schema;
  //    untuk Postgres pengembaliannya Promise).
  try {
    const r = init();
    if (r && typeof r.then === 'function') await r;
    console.log('✅ Skema database siap.');
  } catch (err) {
    console.error('❌ Gagal menyiapkan skema:', err.message);
    process.exitCode = 1;
    return;
  }

  // 2) Seed data contoh.
  if (noSeed) {
    console.log('ℹ️  --no-seed: melewati pengisian data contoh.');
  } else if (IS_PG) {
    console.warn(
      '⚠️  Pengisian data contoh via CLI belum mendukung Postgres (butuh pull asynchronous).\n' +
        '   Tabel & owner akan dibuat otomatis saat `npm start` pertama kali.'
    );
    try {
      const { ensureOwner } = require('./seed');
      ensureOwner({ force });
      console.log('✅ Owner dipastikan ada.');
    } catch (err) {
      console.warn('⚠️  Gagal memastikan owner:', err.message);
    }
  } else {
    const { seed } = require('./seed');
    seed({ force });
  }

  // 3) Tutup koneksi bila asinkron.
  try {
    const c = db.close();
    if (c && typeof c.then === 'function') await c;
  } catch {
    /* abaikan */
  }
}

main().catch((err) => {
  console.error('❌ Migrasi gagal:', err);
  process.exit(1);
});
