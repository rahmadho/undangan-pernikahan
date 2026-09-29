'use strict';

/**
 * sqlite.js — Lapisan kompatibilitas (compatibility shim) untuk better-sqlite3.
 *
 * Meniru sebagian API `better-sqlite3` yang dipakai proyek ini, di atas modul
 * bawaan Node.js `node:sqlite` (tersedia sejak Node.js >= 22.5.0).
 * Tanpa dependensi eksternal & tanpa kompilasi native — jadi `npm install`
 * tidak pernah gagal karena node-gyp / build tools.
 *
 * API yang didukung (drop-in, sesuai server/db/schema.js, seed.js, index.js):
 *   const db = new Database(DB_PATH);
 *   db.pragma('journal_mode = WAL');   // jalankan PRAGMA <str> (str sudah ada '=')
 *   db.pragma('foreign_keys = ON');
 *   db.exec(sqlMultiStatement);        // DDL banyak statement
 *   db.prepare(sql).get(...args);      // 1 baris, atau undefined
 *   db.prepare(sql).all(...args);      // array baris
 *   db.prepare(sql).run(...args);      // { changes, lastInsertRowid }
 *   db.transaction(fn);                // -> tx yang dibungkus BEGIN/COMMIT/ROLLBACK
 *   db.close();
 *
 * Catatan binding (sama seperti node:sqlite):
 *   - Parameter anonim  -> argumen terpisah:        stmt.get(a, b, c)
 *   - Parameter bernama -> satu objek (@name keys): stmt.run({ key: val })
 *   Karena itu .get/.all/.run kita menyebar argumen apa adanya: stmt.get(...args).
 */

// ---------------------------------------------------------------------------
// Impor node:sqlite + pesan ramah jika versi Node.js terlalu tua.
// ---------------------------------------------------------------------------
let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (err) {
  throw new Error(
    'Modul bawaan "node:sqlite" tidak tersedia pada Node.js ini.\n' +
      'Modul ini membutuhkan Node.js versi 22.5.0 atau lebih baru.\n' +
      'Versi Node.js Anda sekarang: ' +
      process.version +
      '\n' +
      'Silakan perbarui Node.js (cek dengan "node -v"), lalu jalankan ulang aplikasi.\n' +
      'Unduh di: https://nodejs.org/ (pilih versi LTS terbaru).\n' +
      'Detail asli: ' +
      (err && err.message ? err.message : String(err))
  );
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Normalisasi hasil .run() agar konsisten dengan better-sqlite3.
 * node:sqlite mengembalikan lastInsertRowid/changes sebagai BigInt, sedangkan
 * aplikasi mengharapkan Number (mis. res.json({ id: info.lastInsertRowid })).
 */
function normalizeRunResult(info) {
  if (!info || typeof info !== 'object') {
    return { changes: 0, lastInsertRowid: 0 };
  }
  const lastInsertRowid =
    typeof info.lastInsertRowid === 'bigint' ? Number(info.lastInsertRowid) : info.lastInsertRowid;
  const changes = typeof info.changes === 'bigint' ? Number(info.changes) : info.changes;
  return {
    changes: changes == null ? 0 : changes,
    lastInsertRowid: lastInsertRowid == null ? 0 : lastInsertRowid,
  };
}

// ---------------------------------------------------------------------------
// Statement wrapper — meniru objek hasil db.prepare(...) di better-sqlite3.
// ---------------------------------------------------------------------------
class Statement {
  constructor(stmt) {
    // `stmt` = instance StatementSync dari node:sqlite.
    this._stmt = stmt;
  }

  /**
   * Ambil satu baris. Mengembalikan `undefined` bila tidak ada baris
   * (node:sqlite sudah berperilaku demikian).
   */
  get(...args) {
    return this._stmt.get(...args);
  }

  /** Ambil semua baris sebagai array of plain object. */
  all(...args) {
    return this._stmt.all(...args);
  }

  /** Jalankan statement tulis. Mengembalikan { changes, lastInsertRowid }. */
  run(...args) {
    const info = this._stmt.run(...args);
    return normalizeRunResult(info);
  }
}

// ---------------------------------------------------------------------------
// Database — wrapper utama.
// ---------------------------------------------------------------------------
class Database {
  /**
   * @param {string} filename - path file database, atau ':memory:'.
   * @param {object} [options] - opsi diteruskan ke DatabaseSync (opsional).
   */
  constructor(filename, options = {}) {
    this._db = new DatabaseSync(filename, options);
  }

  /**
   * Compile statement SQL menjadi objek Statement.
   * @param {string} sql
   * @returns {Statement}
   */
  prepare(sql) {
    return new Statement(this._db.prepare(sql));
  }

  /**
   * Eksekusi satu atau banyak statement sekaligus (DDL multi-statement).
   * @param {string} sql
   */
  exec(sql) {
    return this._db.exec(sql);
  }

  /**
   * Jalankan PRAGMA. `str` sudah memuat tanda '=', mis. 'journal_mode = WAL'.
   * Dijalankan sebagai `PRAGMA <str>`; tidak mengembalikan apa pun
   * (sesuai pemakaian proyek ini, tanpa callback).
   * @param {string} str
   */
  pragma(str) {
    this.exec('PRAGMA ' + str);
    return undefined;
  }

  /**
   * Bungkus `fn` dalam transaksi. Mengembalikan fungsi yang dapat dipanggil
   * langsung (`tx()`): BEGIN -> fn() -> COMMIT, dan ROLLBACK lalu melempar
   * ulang error bila terjadi kesalahan.
   *
   * @param {Function} fn
   * @returns {Function} transaksi yang bisa dipanggil
   */
  transaction(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('db.transaction(fn) membutuhkan sebuah fungsi.');
    }

    const self = this;
    return function (...args) {
      self.exec('BEGIN');
      try {
        const result = fn.apply(this === undefined ? null : this, args);
        self.exec('COMMIT');
        return result;
      } catch (err) {
        // ROLLBACK diupayakan, tapi jangan sampai error rollback menutupi
        // error asli (mis. BEGIN belum sempat jalan).
        try {
          self.exec('ROLLBACK');
        } catch (_ignored) {
          /* abaikan */
        }
        throw err;
      }
    };
  }

  /** Tutup koneksi database. */
  close() {
    return this._db.close();
  }

  /** Akses ke instance node:sqlite asli bila sewaktu-waktu dibutuhkan. */
  get raw() {
    return this._db;
  }
}

// Ekspor default berupa kelas Database (dipakai `new Database(...)`),
// sekaligus menempelkan helper tipe terkait untuk pemakaian lanjutan.
Database.Database = Database;
Database.DatabaseSync = DatabaseSync;
Database.Statement = Statement;

module.exports = Database;
