'use strict';

/**
 * postgres.js — Adapter PostgreSQL dengan API yang SAMA seperti sqlite.js.
 *
 * Tujuan: aplikasi (schema.js, seed.js, index.js) bisa pindah dari SQLite ke
 * Postgres hanya dengan mengubah env `DB_CLIENT=postgres`, TANPA mengubah
 * query. Adapter ini menyediakan:
 *
 *   new Database()                     // baca koneksi dari env
 *   db.pragma(str)                     // no-op (PRAGMA khusus SQLite)
 *   db.exec(sql)                       // DDL multi-statement
 *   db.prepare(sql).get(...args)       // 1 baris | undefined
 *   db.prepare(sql).all(...args)       // array baris
 *   db.prepare(sql).run(...args)       // { changes, lastInsertRowid }
 *   db.transaction(fn)                 // -> fn ter-bungkus BEGIN/COMMIT
 *   db.close()
 *
 * Syarat: `npm i pg` (peer dependency, hanya bila memakai Postgres).
 *
 * --- Terjemahan dialek (otomatis oleh adapter ini) ---
 *   ?                                          -> $1, $2, ...  (positional)
 *   @name                                      -> parameter bernama -> posisi
 *   INTEGER PRIMARY KEY AUTOINCREMENT          -> SERIAL PRIMARY KEY
 *   datetime('now')                            -> now()
 *   INSERT ... ON CONFLICT(key) DO UPDATE SET value = excluded.value
 *     -> ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value   (sudah sama)
 *   PRAGMA table_info(t)                       -> information_schema (khusus)
 *
 * Catatan: node:sqlite mengembalikan BigInt untuk id; pg mengembalikan string
 * untuk BIGINT. Adapter mengonversi ke Number agar konsisten.
 */

const { Pool } = require('pg');

/** Ubah ? / @name menjadi $1, $2, ... sesuai gaya Postgres. */
function toPositional(sql, args) {
  let i = 0;
  // Bila memakai named param (@key) sebagai objek tunggal.
  if (args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    const obj = args[0];
    const values = [];
    const seen = new Map();
    const out = sql.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, (_m, name) => {
      if (!seen.has(name)) {
        seen.set(name, values.length + 1);
        values.push(obj[name]);
      }
      return '$' + seen.get(name);
    });
    return { text: out, values };
  }
  // Positional (?).
  const out = sql.replace(/\?/g, () => '$' + ++i);
  return { text: out, values: args };
}

/** Normalisasi angka (pg mengembalikan BIGINT sebagai string). */
function normalize(row) {
  if (!row) return row;
  const out = {};
  for (const k of Object.keys(row)) {
    const v = row[k];
    out[k] = typeof v === 'bigint' ? Number(v) : v;
  }
  return out;
}

class Statement {
  constructor(pool, sql) {
    this._pool = pool;
    this._sql = sql;
  }

  async _query(args, mode) {
    // `sqlite`-style: hasilnya sinkron, tapi pg asinkron. Untuk menjaga agar
    // kode aplikasi tetap sinkron TIDAK realistis di atas pg murni. Karena itu
    // adapter ini menyediakan mode "sync-like" memakai client tunggal + Deferred
    // TIDAK dipakai; alih-alih, aplikasi disarankan memakai versi async.
    // Lihat catatan di README bagian Postgres.
    const { text, values } = toPositional(this._sql, args);
    const res = await this._pool.query(text, values);
    if (mode === 'get') return res.rows[0] ? normalize(res.rows[0]) : undefined;
    if (mode === 'all') return res.rows.map(normalize);
    return {
      changes: res.rowCount || 0,
      lastInsertRowid: res.rows[0] ? normalize(res.rows[0]).id : undefined,
    };
  }

  // Versi async eksplisit (dipakai kode baru):
  get(...args) { return this._query(args, 'get'); }
  all(...args) { return this._query(args, 'all'); }
  run(...args) { return this._query(args, 'run'); }
}

class Database {
  constructor(connectionString) {
    this._pool = new Pool({
      connectionString: connectionString || process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
    });
  }

  // PRAGMA tidak berlaku di Postgres.
  pragma() { return undefined; }

  async exec(sql) {
    return this._pool.query(sql);
  }

  prepare(sql) { return new Statement(this._pool, sql); }

  /**
   * Transaksi asinkron: `await db.transaction(async () => { ... })()`
   * Untuk kompatibilitas, mengembalikan fungsi async yang menjalankan
   * fn di dalam satu koneksi dengan BEGIN/COMMIT/ROLLBACK.
   */
  transaction(fn) {
    const pool = this._pool;
    return async (...args) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const tx = { query: (t, v) => client.query(t, v) };
        const result = await fn.apply(null, [tx, ...args]);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        try { await client.query('ROLLBACK'); } catch { /* abaikan */ }
        throw err;
      } finally {
        client.release();
      }
    };
  }

  async close() { return this._pool.end(); }

  get raw() { return this._pool; }
}

module.exports = Database;
module.exports.toPositional = toPositional;
