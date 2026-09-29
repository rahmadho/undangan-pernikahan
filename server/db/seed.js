'use strict';

const { db } = require('./schema');

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

const DEFAULT_SETTINGS = {
  music_url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3',
  quote:
    '"Dan di antara tanda-tanda kekuasaan-Nya ialah Dia menciptakan untukmu pasangan hidup dari jenjangmu sendiri supaya kamu dapat ketenangan hati dan menjadikan kasih sayang di antara kamu." (QS. Ar-Rum: 21)',
  admin_password: 'admin123',
};

function seed({ force = false } = {}) {
  const hasCouple = db.prepare('SELECT COUNT(*) AS c FROM couple').get().c > 0;
  const hasEvents = db.prepare('SELECT COUNT(*) AS c FROM events').get().c > 0;
  if (hasCouple && hasEvents && !force) {
    console.log('ℹ️  Database sudah berisi data. Gunakan --force untuk menimpa.');
    return;
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM couple').run();
    db.prepare('DELETE FROM events').run();
    db.prepare('DELETE FROM guests').run();
    db.prepare('DELETE FROM wishes').run();
    db.prepare('DELETE FROM gifts').run();
    db.prepare('DELETE FROM gallery').run();
    db.prepare('DELETE FROM rsvp').run();
    db.prepare('DELETE FROM settings').run();

    db.prepare(`
      INSERT INTO couple (id, groom_name, groom_full, groom_ig, groom_photo, groom_parents,
                          bride_name, bride_full, bride_ig, bride_photo, bride_parents, love_story)
      VALUES (1, @groom_name, @groom_full, @groom_ig, @groom_photo, @groom_parents,
              @bride_name, @bride_full, @bride_ig, @bride_photo, @bride_parents, @love_story)
    `).run(DEFAULT_COUPLE);

    const insEvent = db.prepare(`
      INSERT INTO events (key, title, date_iso, time_text, venue, address, maps_url, sort)
      VALUES (@key, @title, @date_iso, @time_text, @venue, @address, @maps_url, @sort)
    `);
    DEFAULT_EVENTS.forEach((e) => insEvent.run(e));

    const insGuest = db.prepare(
      'INSERT INTO guests (slug, name, phone, category, quota) VALUES (@slug, @name, @phone, @category, @quota)'
    );
    DEFAULT_GUESTS.forEach((g) => insGuest.run(g));

    const insWish = db.prepare(
      'INSERT INTO wishes (name, message, attending) VALUES (@name, @message, @attending)'
    );
    DEFAULT_WISHES.forEach((w) => insWish.run(w));

    const insGift = db.prepare(
      'INSERT INTO gifts (type, bank_name, account_no, account_name, sort) VALUES (@type, @bank_name, @account_no, @account_name, @sort)'
    );
    DEFAULT_GIFTS.forEach((g) => insGift.run(g));

    const insGallery = db.prepare('INSERT INTO gallery (url, caption, sort) VALUES (@url, @caption, @sort)');
    DEFAULT_GALLERY.forEach((g) => insGallery.run(g));

    const insSet = db.prepare('INSERT INTO settings (key, value) VALUES (@key, @value)');
    Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => insSet.run({ key, value }));
  });

  tx();
  console.log('✅ Data contoh berhasil dimasukkan ke database.');
}

if (require.main === module) {
  const force = process.argv.includes('--force');
  seed({ force });
}

module.exports = { seed };
