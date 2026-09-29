'use strict';

/**
 * Seed data contoh multi-tenant.
 *
 * Membuat:
 *   - 1 owner (super admin)  : username `owner`,  password `owner123`
 *   - 1 account demo (client): slug `demo`,       password `admin123`
 * plus data undangan lengkap untuk account demo tersebut.
 *
 * Idempoten: kalau owner/account sudah ada, data contoh tidak ditimpa
 * kecuali dijalankan dengan --force.
 */

const { db } = require('./schema');
const { hashPassword } = require('../security');

const OWNER = { username: 'owner', password: 'owner123' };

const DEMO_ACCOUNT = {
  slug: 'demo',
  title: 'Rizky & Amelia',
  password: 'admin123',
  theme: 'botanical',
};

const DEFAULT_COUPLE = {
  groom_name: 'Rizky',
  groom_full: 'Rizky Pratama, S.T.',
  groom_ig: 'rizkypratama',
  groom_photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600',
  groom_parents: 'Putra dari Bapak H. Ahmad Pratama & Ibu Hj. Siti Aminah',
  bride_name: 'Amelia',
  bride_full: 'Amelia Putri, S.E.',
  bride_ig: 'ameliaputri',
  bride_photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600',
  bride_parents: 'Putri dari Bapak Ir. Budi Santoso & Ibu Dewi Lestari',
  love_story:
    'Kami bertemu pertama kali di bangku kuliah pada tahun 2018. Berawal dari teman satu kelompok tugas, ' +
    'kebersamaan itu tumbuh menjadi cerita yang tak pernah kami duga. Setelah 6 tahun bersama, ' +
    'dengan menyebut nama Tuhan, kami memutuskan untuk melangkah ke jenjang yang lebih serius.',
};

const DEFAULT_EVENTS = [
  {
    key: 'akad',
    title: 'Akad Nikah',
    date_iso: '2027-06-14T08:00:00+07:00',
    time_text: '08.00 - 10.00 WIB',
    venue: 'Masjid Al-Ikhlas',
    address: 'Jl. Merdeka No. 123, Jakarta Selatan',
    maps_url: 'https://maps.google.com/?q=Masjid+Al+Ikhlas+Jakarta',
    sort: 1,
  },
  {
    key: 'resepsi',
    title: 'Resepsi',
    date_iso: '2027-06-14T11:00:00+07:00',
    time_text: '11.00 - 14.00 WIB',
    venue: 'Gedung Graha Sari',
    address: 'Jl. Sudirman Kav. 45, Jakarta Pusat',
    maps_url: 'https://maps.google.com/?q=Gedung+Graha+Sari+Jakarta',
    sort: 2,
  },
];

const DEFAULT_GUESTS = [
  { slug: 'budi-santoso', name: 'Budi Santoso', phone: '081234567890', category: 'Keluarga', quota: 4 },
  { slug: 'siti-rahayu', name: 'Siti Rahayu', phone: '081234567891', category: 'Kawan', quota: 2 },
  { slug: 'andi-wijaya', name: 'Andi Wijaya', phone: '081234567892', category: 'Kantor', quota: 2 },
  { slug: 'dewi-lestari', name: 'Dewi Lestari', phone: '081234567893', category: 'Keluarga', quota: 3 },
];

const DEFAULT_WISHES = [
  { name: 'Budi Santoso', message: 'Selamat menempuh hidup baru! Semoga menjadi keluarga yang sakinah, mawaddah, warahmah. 🤍', attending: 'hadir' },
  { name: 'Siti Rahayu', message: 'Barakallahu lakuma wa baraka alaikuma wa jamaa bainakuma fii khair. Selamat ya!', attending: 'hadir' },
  { name: 'Andi Wijaya', message: 'Turut berbahagia! Maaf belum bisa hadir, doa terbaik dari jauh. 🙏', attending: 'tidak_hadir' },
];

const DEFAULT_GIFTS = [
  { type: 'bank', bank_name: 'BCA', account_no: '1234567890', account_name: 'Rizky Pratama', sort: 1 },
  { type: 'bank', bank_name: 'Mandiri', account_no: '9876543210', account_name: 'Amelia Putri', sort: 2 },
  { type: 'ewallet', bank_name: 'GoPay', account_no: '081234567890', account_name: 'Rizky Pratama', sort: 3 },
];

const DEFAULT_GALLERY = [
  { url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800', caption: 'Pertemuan pertama', sort: 1 },
  { url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800', caption: 'Lamaran', sort: 2 },
  { url: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800', caption: 'Pre-wedding', sort: 3 },
];

// Backsound demo — Canon in D Major (Kevin MacLeod, CC-BY / ISRC USUAN1100301).
const DEFAULT_SETTINGS = {
  music_url:
    'https://upload.wikimedia.org/wikipedia/commons/c/c6/Canon_in_D_Major_%28ISRC_USUAN1100301%29.mp3',
  quote:
    '"Dan di antara tanda-tanda kekuasaan-Nya ialah Dia menciptakan untukmu pasangan hidup dari jenjangmu sendiri supaya kamu dapat ketenangan hati dan menjadikan kasih sayang di antara kamu." (QS. Ar-Rum: 21)',
};

/** Pastikan owner ada (untuk login super admin). */
function ensureOwner({ force = false } = {}) {
  const existing = db.prepare('SELECT id FROM owners WHERE username = ?').get(OWNER.username);
  const hash = hashPassword(OWNER.password);
  if (existing) {
    if (force) db.prepare('UPDATE owners SET password_hash = ? WHERE id = ?').run(hash, existing.id);
    return existing.id;
  }
  const info = db
    .prepare('INSERT INTO owners (username, password_hash) VALUES (?, ?)')
    .run(OWNER.username, hash);
  return Number(info.lastInsertRowid);
}

/** Isi konten contoh ke sebuah account. */
function seedAccountContent(accountId) {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM couple WHERE account_id = ?').run(accountId);
    db.prepare('DELETE FROM events WHERE account_id = ?').run(accountId);
    db.prepare('DELETE FROM guests WHERE account_id = ?').run(accountId);
    db.prepare('DELETE FROM wishes WHERE account_id = ?').run(accountId);
    db.prepare('DELETE FROM gifts WHERE account_id = ?').run(accountId);
    db.prepare('DELETE FROM gallery WHERE account_id = ?').run(accountId);
    db.prepare('DELETE FROM rsvp WHERE account_id = ?').run(accountId);
    db.prepare('DELETE FROM settings WHERE account_id = ?').run(accountId);

    db.prepare(`
      INSERT INTO couple (account_id, groom_name, groom_full, groom_ig, groom_photo, groom_parents,
                          bride_name, bride_full, bride_ig, bride_photo, bride_parents, love_story)
      VALUES (@account_id, @groom_name, @groom_full, @groom_ig, @groom_photo, @groom_parents,
              @bride_name, @bride_full, @bride_ig, @bride_photo, @bride_parents, @love_story)
    `).run({ account_id: accountId, ...DEFAULT_COUPLE });

    const insEvent = db.prepare(`
      INSERT INTO events (account_id, key, title, date_iso, time_text, venue, address, maps_url, sort)
      VALUES (@account_id, @key, @title, @date_iso, @time_text, @venue, @address, @maps_url, @sort)
    `);
    DEFAULT_EVENTS.forEach((e) => insEvent.run({ account_id: accountId, ...e }));

    const insGuest = db.prepare(
      'INSERT INTO guests (account_id, slug, name, phone, category, quota) VALUES (@account_id, @slug, @name, @phone, @category, @quota)'
    );
    DEFAULT_GUESTS.forEach((g) => insGuest.run({ account_id: accountId, ...g }));

    const insWish = db.prepare(
      'INSERT INTO wishes (account_id, name, message, attending) VALUES (@account_id, @name, @message, @attending)'
    );
    DEFAULT_WISHES.forEach((w) => insWish.run({ account_id: accountId, ...w }));

    const insGift = db.prepare(
      'INSERT INTO gifts (account_id, type, bank_name, account_no, account_name, sort) VALUES (@account_id, @type, @bank_name, @account_no, @account_name, @sort)'
    );
    DEFAULT_GIFTS.forEach((g) => insGift.run({ account_id: accountId, ...g }));

    const insGallery = db.prepare('INSERT INTO gallery (account_id, url, caption, sort) VALUES (@account_id, @url, @caption, @sort)');
    DEFAULT_GALLERY.forEach((g) => insGallery.run({ account_id: accountId, ...g }));

    const insSet = db.prepare('INSERT INTO settings (account_id, key, value) VALUES (@account_id, @key, @value)');
    Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => insSet.run({ account_id: accountId, key, value }));
  });
  tx();
}

/** Buat account baru + (opsional) konten contoh. Dipakai owner & seed. */
function createAccount({ slug, title, password, theme = 'botanical', withSample = false, status = 'active' }) {
  const info = db
    .prepare(
      `INSERT INTO accounts (slug, title, password_hash, theme, status)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(String(slug).toLowerCase().trim(), title || slug, hashPassword(String(password)), theme, status);
  const accountId = Number(info.lastInsertRowid);
  if (withSample) seedAccountContent(accountId);
  return accountId;
}

function seed({ force = false } = {}) {
  ensureOwner({ force });

  const hasAccount = db.prepare('SELECT COUNT(*) AS c FROM accounts').get().c > 0;
  if (hasAccount && !force) {
    console.log('ℹ️  Sudah ada account. Gunakan --force untuk menimpa data contoh account "demo".');
    return;
  }

  let account = db.prepare('SELECT * FROM accounts WHERE slug = ?').get(DEMO_ACCOUNT.slug);
  if (!account) {
    const id = createAccount({
      slug: DEMO_ACCOUNT.slug,
      title: DEMO_ACCOUNT.title,
      password: DEMO_ACCOUNT.password,
      theme: DEMO_ACCOUNT.theme,
      withSample: true,
    });
    account = { id };
  } else {
    db.prepare('UPDATE accounts SET password_hash = ?, theme = ?, title = ? WHERE id = ?').run(
      hashPassword(DEMO_ACCOUNT.password),
      DEMO_ACCOUNT.theme,
      DEMO_ACCOUNT.title,
      account.id
    );
    seedAccountContent(account.id);
  }

  console.log('✅ Data contoh multi-tenant berhasil dimasukkan.');
  console.log(`   • Owner     : ${OWNER.username} / ${OWNER.password}`);
  console.log(`   • Undangan  : /u/${DEMO_ACCOUNT.slug}  (admin: /u/${DEMO_ACCOUNT.slug}/admin)`);
  console.log(`   • Password  : ${DEMO_ACCOUNT.password}`);
}

if (require.main === module) {
  const force = process.argv.includes('--force');
  seed({ force });
}

module.exports = { seed, createAccount, seedAccountContent, ensureOwner, OWNER, DEMO_ACCOUNT };
