/**
 * db.ts — Koneksi PostgreSQL untuk SvelteKit.
 *
 * Memakai `pg` Pool. Kredensial dari environment:
 *   DATABASE_URL   -> connection string (diprioritaskan)
 *   ATAU PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE
 *
 * Semua query di aplikasi WAJIB lewat helper di sini (query/one/many/run/tx)
 * supaya tidak ada SQL yang tersebar sembarangan.
 */
import pg from 'pg';
import { env } from '$env/dynamic/private';

const { Pool } = pg;

/** Bangun konfigurasi pool dari env. */
function buildPool(): pg.Pool {
	const url = env.DATABASE_URL;
	const sslDisabled = env.PGSSL === 'false';
	const ssl = sslDisabled ? false : { rejectUnauthorized: false };
	// Schema khusus aplikasi (default: 'wedding'). Dibuat oleh ensureSchema().
	const schema = env.PGSCHEMA || 'wedding';
	// search_path agar semua query otomatis mengarah ke schema kita.
	const options = `-c search_path=${schema},public`;

	if (url) {
		return new Pool({ connectionString: url, ssl, max: Number(env.PG_POOL_MAX) || 10, options });
	}

	return new Pool({
		host: env.PGHOST || 'localhost',
		port: Number(env.PGPORT) || 5432,
		user: env.PGUSER || 'postgres',
		password: env.PGPASSWORD || '',
		database: env.PGDATABASE || 'postgres',
		ssl,
		max: Number(env.PG_POOL_MAX) || 10,
		options
	});
}

/** Nama schema aplikasi. */
export const SCHEMA = env.PGSCHEMA || 'wedding';

// Reuse pool antar HMR di dev.
const globalForDb = globalThis as unknown as { __pgPool?: pg.Pool };
export const pool: pg.Pool = globalForDb.__pgPool ?? buildPool();
if (!globalForDb.__pgPool) globalForDb.__pgPool = pool;

export type Row = Record<string, any>;

/** Jalankan query, kembalikan semua baris. */
export async function many<T = Row>(text: string, params: any[] = []): Promise<T[]> {
	const res = await pool.query(text, params);
	return res.rows as T[];
}

/** Jalankan query, kembalikan 1 baris atau null. */
export async function one<T = Row>(text: string, params: any[] = []): Promise<T | null> {
	const res = await pool.query(text, params);
	return (res.rows[0] as T) ?? null;
}

/** Jalankan query tulis (INSERT/UPDATE/DELETE). Kembalikan jumlah baris terpengaruh. */
export async function run(text: string, params: any[] = []): Promise<number> {
	const res = await pool.query(text, params);
	return res.rowCount ?? 0;
}

/** Jalankan query tulis & kembalikan baris pertama (mis. RETURNING id). */
export async function runReturning<T = Row>(text: string, params: any[] = []): Promise<T | null> {
	const res = await pool.query(text, params);
	return (res.rows[0] as T) ?? null;
}

/** Transaksi: fn menerima client; commit otomatis atau rollback bila throw. */
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		const out = await fn(client);
		await client.query('COMMIT');
		return out;
	} catch (err) {
		try {
			await client.query('ROLLBACK');
		} catch {
			/* abaikan */
		}
		throw err;
	} finally {
		client.release();
	}
}

/** Uji koneksi (dipakai /healthz). */
export async function ping(): Promise<boolean> {
	try {
		await pool.query('SELECT 1');
		return true;
	} catch {
		return false;
	}
}
