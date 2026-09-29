/**
 * seed.ts — Data contoh: owner awal + account demo lengkap dengan konten.
 * Idempoten: hanya mengisi bila tabel masih kosong (kecuali force).
 */
import { one, many, run, runReturning } from './db';
import { hashPassword } from './security';
import { env } from '$env/dynamic/private';

/** Pastikan ada owner. Pakai OWNER_USERNAME/OWNER_PASSWORD dari env bila kosong. */
export async function ensureOwner(): Promise<void> {
	const existing = await one('SELECT id FROM owners ORDER BY id LIMIT 1');
	if (existing) return;
	const username = env.OWNER_USERNAME || 'owner';
	const password = env.OWNER_PASSWORD || 'owner123';
	await run('INSERT INTO owners (username, password_hash) VALUES ($1, $2)', [
		username,
		hashPassword(password)
	]);
	console.log(`👑 Owner awal dibuat: ${username} / ${password} (GANTI!)`);
}

/** Buat account demo lengkap (idempoten). */
export async function seedDemo(): Promise<number> {
	const slug = 'demo';
	const existing = await one<{ id: number }>('SELECT id FROM accounts WHERE slug = $1', [slug]);
	if (existing) return existing.id;

	const acc = await runReturning<{ id: number }>(
		`INSERT INTO accounts (slug, title, password_hash, theme, status, plan)
		 VALUES ($1, $2, $3, $4, 'active', 'basic') RETURNING id`,
		[slug, 'Rizky & Amelia', hashPassword('admin123'), 'botanical']
	);
	const id = acc!.id;

	// Mempelai
	await run(
		`INSERT INTO couple (account_id, groom_name, groom_full, groom_ig, groom_photo, groom_parents,
		  bride_name, bride_full, bride_ig, bride_photo, bride_parents, love_story)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		[
			id,
			'Rizky',
			'Rizky Pratama, S.T.',
			'rizkypratama',
			'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80',
			'Putra kedua dari Bapak Ahmad Pratama & Ibu Siti Aminah',
			'Amelia',
			'Amelia Putri, S.E.',
			'ameliaputri',
			'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&q=80',
			'Putri pertama dari Bapak Budi Santoso & Ibu Dewi Lestari',
			'Berawal dari pertemuan sederhana di sebuah acara kampus, kami saling mengenal dan mulai berbagi banyak cerita. Tanpa disadari, kebersamaan itu tumbuh menjadi rasa nyaman yang semakin kuat dari hari ke hari.'
		]
	);

	// Acara
	const events = [
		['akad', 'Akad Nikah', '2027-06-14T08:00:00+07:00', 'Pukul 08.00 - 10.00 WIB', 'Masjid Al-Ikhlas', 'Jl. Merdeka No. 45, Jakarta', 'https://maps.google.com/?q=-6.2088,106.8456', 0],
		['resepsi', 'Resepsi', '2027-06-14T11:00:00+07:00', 'Pukul 11.00 - 14.00 WIB', 'Gedung Graha Indah', 'Jl. Sudirman No. 88, Jakarta', 'https://maps.google.com/?q=-6.2088,106.8456', 1]
	];
	for (const e of events) {
		await run(
			`INSERT INTO events (account_id, key, title, date_iso, time_text, venue, address, maps_url, sort)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			[id, ...e]
		);
	}

	// Galeri
	const gallery = [
		['https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80', 'Momen bahagia kami', 0],
		['https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800&q=80', 'Kebersamaan', 1],
		['https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&q=80', 'Cinta kami', 2],
		['https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&q=80', 'Hari istimewa', 3]
	];
	for (const g of gallery) {
		await run('INSERT INTO gallery (account_id, url, caption, sort) VALUES ($1,$2,$3,$4)', [id, ...g]);
	}

	// Amplop digital
	const gifts = [
		['bank', 'BCA', '1234567890', 'Rizky Pratama', 0],
		['bank', 'Mandiri', '0987654321', 'Amelia Putri', 1],
		['ewallet', 'GoPay', '081234567890', 'Amelia Putri', 2]
	];
	for (const g of gifts) {
		await run(
			'INSERT INTO gifts (account_id, type, bank_name, account_no, account_name, sort) VALUES ($1,$2,$3,$4,$5,$6)',
			[id, ...g]
		);
	}

	// Ucapan contoh
	const wishes = [
		['Budi Santoso', 'Selamat menempuh hidup baru, semoga menjadi keluarga sakinah mawaddah warahmah.', 'hadir'],
		['Siti Nurhaliza', 'Barakallahu lakuma wa baraka alaikuma. Bahagia selalu ya!', 'hadir'],
		['Ahmad Fauzi', 'Turut berbahagia, semoga langgeng sampai kakek nenek. 🎉', 'hadir']
	];
	for (const w of wishes) {
		await run('INSERT INTO wishes (account_id, name, message, attending) VALUES ($1,$2,$3,$4)', [id, ...w]);
	}

	// Tamu contoh
	const guests = [
		['budi-santoso', 'Budi Santoso', '081234567890', 'Keluarga', 2],
		['siti-nurhaliza', 'Siti Nurhaliza', '081298765432', 'Teman', 2],
		['keluarga-hartono', 'Keluarga Hartono', '', 'Keluarga', 4]
	];
	for (const g of guests) {
		await run(
			'INSERT INTO guests (account_id, slug, name, phone, category, quota) VALUES ($1,$2,$3,$4,$5,$6)',
			[id, ...g]
		);
	}

	// Settings
	const settings: [string, string][] = [
		['quote', '"Dan di antara tanda-tanda kekuasaan-Nya ialah Dia menciptakan untukmu pasangan hidup dari jenismu sendiri supaya kamu dapat ketenangan hati." (QS. Ar-Rum: 21)'],
		['music_url', ''],
		['background_position', 'center center'],
		['background_size', 'cover'],
		['background_repeat', 'no-repeat'],
		['background_attachment', 'fixed'],
		['watermark_enabled', '1'],
		['watermark_text', 'Undangan Digital'],
		// -- Foto & dekorasi cover (fitur baru) --
		['cover_mode', 'plain'], // plain | frame | shadow | polaroid | arch | circle | none
		['cover_photo', ''], // URL foto untuk cover (kosong = pakai latar)
		['decoration', 'floral'], // floral | leaves-sway | ethnic-jawa | ethnic-minang | none
		['decoration_animated', '1'] // '1' = dekorasi bergerak (daun/bunga berayun)
	];
	for (const [k, v] of settings) {
		await run(
			'INSERT INTO settings (account_id, key, value) VALUES ($1,$2,$3) ON CONFLICT (account_id, key) DO UPDATE SET value = EXCLUDED.value',
			[id, k, v]
		);
	}

	console.log(`📇 Account demo dibuat (slug: demo, password: admin123).`);
	return id;
}

/** Jalankan semua seed. */
export async function seedAll(): Promise<void> {
	await ensureOwner();
	await seedDemo();
}
