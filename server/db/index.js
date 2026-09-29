'use strict';

/**
 * index.js — Pemilih backend database.
 *
 *   DB_CLIENT=sqlite   (default)  -> sqlite.js  (sinkron, tanpa dependensi)
 *   DB_CLIENT=postgres            -> postgres.js (butuh `npm i pg`, async)
 *
 * ALL access ke database melewati modul ini + `schema.js`, sehingga pindah
 * backend = ganti env, bukan rombak query.
 *
 * PENTING soal perbedaan sync/async:
 *   - SQLite (node:sqlite) bersifat SINKRON: `db.prepare(sql).get()` langsung
 *     mengembalikan baris.
 *   - Postgres (pg) bersifat ASINKRON: `await db.prepare(sql).get()`.
 *   Karena itu, saat memakai Postgres, seluruh handler Express yang menyentuh
 *   DB harus diubah menjadi `async` dan memakai `await`. Adapter Postgres di
 *   folder ini sudah menyediakan API yang sama (hanya perlu `await`).
 *   Lihat README bagian "Migrasi ke PostgreSQL" untuk langkah lengkap.
 */

const client = (process.env.DB_CLIENT || 'sqlite').toLowerCase();

let Database;
if (client === 'postgres' || client === 'pg') {
  Database = require('./postgres');
} else {
  Database = require('./sqlite');
}

module.exports = { Database, client };
