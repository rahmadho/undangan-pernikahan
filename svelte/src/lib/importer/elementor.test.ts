/**
 * elementor.test.ts — Uji unit parser impor (PARSER MURNI).
 *
 * Jalankan:  node --test --experimental-strip-types src/lib/importer/elementor.test.ts
 * (atau: npm run test:importer — lihat catatan di README importer.)
 *
 * Cakupan:
 *  1. Utilitas murni: textOf (sanitasi HTML), parseDateId, parseTimeId, splitCouple.
 *  2. detectFormat.
 *  3. Kasus tepi: kosong, content bukan array, JSON rusak, kedalaman ekstrem.
 *  4. BUKTI pada file JSON NYATA user: LW001.json & LW002.json (fixtures/).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
	parseElementor,
	detectFormat,
	textOf,
	parseDateId,
	parseTimeId,
	splitCouple,
	resolveTitleOrientation,
	imageUrl,
	imageSource
} from './elementor.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const loadFixture = (name: string): unknown =>
	JSON.parse(readFileSync(join(HERE, 'fixtures', name), 'utf8'));

/* ========================================================================== */
/* 1. Utilitas teks murni (sanitasi HTML / anti-XSS)                          */
/* ========================================================================== */

test('textOf: buang tag, ubah <br> jadi newline, decode entitas', () => {
	assert.equal(textOf('Halo <b>Dunia</b>'), 'Halo Dunia');
	assert.equal(textOf('Baris1<br>Baris2'), 'Baris1\nBaris2');
	assert.equal(textOf('A &amp; B &lt;tag&gt;'), 'A & B <tag>');
	assert.equal(textOf('<script>alert(1)</script>aman'), 'alert(1)aman');
	assert.equal(textOf(null), '');
	assert.equal(textOf(undefined), '');
	assert.equal(textOf(12345), '12345');
});

test('textOf: TIDAK menyisakan tag HTML apa pun (kriteria §9 no.6)', () => {
	const dirty = '<div class="x"><h1>Judul</h1><p style="color:red">Isi</p></div>';
	const out = textOf(dirty);
	assert.ok(!/[<>]/.test(out), `masih ada markup: ${out}`);
	assert.ok(out.includes('Judul') && out.includes('Isi'));
});

test('textOf: decode entitas numerik', () => {
	assert.equal(textOf('&#169; 2021'), '© 2021');
	assert.equal(textOf('&#x2764;'), '❤');
});

/* ========================================================================== */
/* 2. Parsing tanggal & waktu                                                 */
/* ========================================================================== */

test('parseDateId: format Indonesia "Jumat, 18 April 2021"', () => {
	assert.equal(parseDateId('Jumat, 18 April 2021'), '2021-04-18');
	assert.equal(parseDateId('Thursday, 15 Mei 2021'), '2021-05-15');
	assert.equal(parseDateId('18 Agustus 2022'), '2022-08-18');
});

test('parseDateId: format numerik', () => {
	assert.equal(parseDateId('13.05.2021'), '2021-05-13');
	assert.equal(parseDateId('18/04/2021'), '2021-04-18');
	assert.equal(parseDateId('2021-04-18'), '2021-04-18');
});

test('parseDateId: gagal → string kosong (bukan lempar)', () => {
	assert.equal(parseDateId(''), '');
	assert.equal(parseDateId('besok sore'), '');
	assert.equal(parseDateId('32/13/2021'), '');
	assert.equal(parseDateId('1 Januari 1800'), '');
});

test('parseTimeId: ekstrak jam:menit', () => {
	assert.equal(parseTimeId('15.00 WIB'), '15:00');
	assert.equal(parseTimeId('08.00 - 09.00 WIB'), '08:00');
	assert.equal(parseTimeId('09:30'), '09:30');
	assert.equal(parseTimeId('tanpa jam'), '');
	assert.equal(parseTimeId('25.99'), '');
});

test('splitCouple: pisah nama dengan & / dan / +', () => {
	assert.deepEqual(splitCouple('Fajira & Dion'), { left: 'Fajira', right: 'Dion' });
	assert.deepEqual(splitCouple('Gilbert dan Hana'), { left: 'Gilbert', right: 'Hana' });
	assert.deepEqual(splitCouple('Raka Aditya & Sinta Maharani'), {
		left: 'Raka Aditya',
		right: 'Sinta Maharani'
	});
	assert.deepEqual(splitCouple('Tanpa Pemisah'), { left: 'Tanpa Pemisah', right: '' });
});

/* ========================================================================== */
/* 3. Gambar: ekstraksi URL & klasifikasi sumber                              */
/* ========================================================================== */

test('imageUrl: toleran urutan key & bentuk', () => {
	assert.equal(imageUrl({ id: 11, url: 'http://a/x.jpg' }), 'http://a/x.jpg');
	assert.equal(imageUrl({ url: 'http://a/x.jpg', id: '11' }), 'http://a/x.jpg');
	assert.equal(imageUrl('http://a/x.jpg'), 'http://a/x.jpg');
	assert.equal(imageUrl(null), '');
	assert.equal(imageUrl({}), '');
});

test('imageSource: remote vs local vs unknown', () => {
	assert.equal(imageSource('https://x/y.jpg'), 'remote');
	assert.equal(imageSource('http://x/y.jpg'), 'remote');
	assert.equal(imageSource('/uploads/img-1.jpg'), 'local');
	assert.equal(imageSource(''), 'unknown');
});

/* ========================================================================== */
/* 4. Deteksi format                                                          */
/* ========================================================================== */

test('detectFormat: mengenali Elementor & menolak yang lain', () => {
	assert.equal(detectFormat({ content: [], type: 'page', version: '0.4' }), 'elementor');
	assert.equal(detectFormat({ content: [{ elType: 'section' }] }), 'elementor');
	assert.equal(detectFormat(null), 'unknown');
	assert.equal(detectFormat({ foo: 1 }), 'unknown');
	assert.equal(detectFormat({ content: 'bukan-array' }), 'unknown');
});

/* ========================================================================== */
/* 5. Kasus tepi / defensif                                                   */
/* ========================================================================== */

test('parseElementor: content kosong → draft kosong tanpa error', () => {
	const d = parseElementor({ content: [], title: 'X', version: '0.4', type: 'page' });
	assert.equal(d.report.format, 'elementor');
	assert.equal(d.report.sectionCount, 0);
	assert.equal(d.couple.groom_name, '');
	assert.deepEqual(d.events, []);
	assert.deepEqual(d.gallery, []);
});

test('parseElementor: content bukan array → lempar pesan Indonesia', () => {
	assert.throws(() => parseElementor({ content: 'nope' }), /content/);
	assert.throws(() => parseElementor(null), /objek/);
	assert.throws(() => parseElementor('{rusak'), /tidak valid/);
});

test('parseElementor: toleran elements list-of-list & kedalaman ekstrem', () => {
	const deep: any = { elType: 'column', elements: [] };
	let cur = deep;
	for (let i = 0; i < 50; i++) {
		const next = { elType: 'column', elements: [] as any[] };
		cur.elements.push([next]); // sengaja nested list
		cur = next;
	}
	cur.elements.push({ elType: 'widget', widgetType: 'heading', settings: { title: 'Dalam' } });
	// Tidak boleh lempar / hang.
	const d = parseElementor({ content: [deep], type: 'page' });
	assert.equal(d.report.format, 'elementor');
	assert.ok(d.report.nodeCount > 0);
});

test('parseElementor: judul tanpa pemisah → bride terisi, groom review', () => {
	const d = parseElementor({
		content: [
			{
				elType: 'section',
				settings: {},
				elements: [
					{
						elType: 'column',
						elements: [
							{
								elType: 'widget',
								widgetType: 'heading',
								settings: { title: 'Pernikahan Bahagia', typography_font_family: 'Great Vibes', typography_font_size: { size: 60 } }
							}
						]
					}
				]
			}
		],
		type: 'page'
	});
	assert.equal(d.couple.bride_name, 'Pernikahan Bahagia');
	assert.equal(d.couple.groom_name, '');
	const r = d.report.entries.find((e) => e.field === 'couple.groom_name');
	assert.equal(r?.status, 'review');
});

test('parseElementor: input berupa string JSON di-parse', () => {
	const d = parseElementor('{"content":[],"type":"page"}');
	assert.equal(d.report.format, 'elementor');
});

/* ========================================================================== */
/* 6. BUKTI pada JSON NYATA USER — LW001 (8 section)                          */
/* ========================================================================== */

test('LW001.json (nyata): nama pasangan, event, galeri, kutipan, latar', () => {
	const d = parseElementor(loadFixture('LW001.json'));

	// Format & metadata.
	assert.equal(d.report.format, 'elementor');
	assert.equal(d.report.templateTitle, 'LW001');
	assert.equal(d.report.sectionCount, 8);

	// Nama pasangan dari judul "Fajira & Dion" — tema ini menulis "Bride & Groom"
	// (wanita lebih dulu), sehingga peran harus diambil dari urutan profil
	// mempelai: Dion = PRIYA (groom), Fajira = WANITA (bride). REGRESI: dulu tertukar.
	assert.equal(d.couple.groom_name, 'Dion');
	assert.equal(d.couple.bride_name, 'Fajira');

	// Profil mempelai dari image-box (urut: pria, wanita).
	assert.equal(d.couple.groom_full, 'Dion Cahya Putra');
	assert.equal(d.couple.bride_full, 'Fajira Dian Eka');
	assert.match(d.couple.groom_photo, /optimize-proriat-hospitality/);
	assert.match(d.couple.bride_photo, /optimize-oswaldo-ibanez/);

	// Event dengan tanggal 2021-04-18 (kriteria penerimaan §9 no.1).
	const ev = d.events[0];
	assert.equal(ev.date_iso, '2021-04-18T15:00');
	assert.equal(ev.time_text, '15.00 WIB');
	assert.equal(ev.venue, 'Hotel Indonesia, Jakarta');
	assert.match(ev.address, /Jalan M\.H\. Thamrin/);
	assert.match(ev.maps_url, /google\.com\/maps/);

	// Galeri ≥ 5.
	assert.ok(d.gallery.length >= 5, `galeri=${d.gallery.length}`);
	assert.match(d.gallery[0].url, /pexels-leah-kelley/);

	// Kutipan doa panjang.
	assert.ok(d.settings.quote.length > 120);
	assert.match(d.settings.quote, /Semoga Allah/);
	assert.ok(!/[<>]/.test(d.settings.quote), 'kutipan masih mengandung markup');

	// Latar cover + overlay + attachment.
	assert.match(d.settings.background_image, /optimize-pexels-min-an-758898/);
	assert.match(d.settings.background_image_mobile, /landingstar\.id/);
	assert.equal(d.settings.background_overlay, '#879BAF');
	assert.equal(d.settings.background_overlay_opacity, '0.95');
	assert.equal(d.settings.background_attachment, 'fixed');

	// Tombol WA di-skip, bukan error.
	const btn = d.report.entries.find((e) => e.field === 'button');
	btn && assert.equal(btn.status, 'skipped');
	// Tidak ada entri 'error' untuk field utama pada file yang sehat ini.
	assert.equal(d.report.entries.filter((e) => e.status === 'error').length, 0);
});

/* ========================================================================== */
/* 6b. REGRESI: groom/bride TIDAK boleh tertukar pada tema "Bride & Groom"    */
/* ========================================================================== */

test('REGRESI LW001: Dion = PRIYA (groom), Fajira = WANITA (bride)', () => {
	const d = parseElementor(loadFixture('LW001.json'));

	// Inti regresi: judul tertulis "Fajira & Dion" (wanita dulu), tetapi
	// Fajira adalah pengantin WANITA dan Dion adalah pengantin PRIA.
	assert.equal(d.couple.groom_name, 'Dion', 'groom_name harus Dion (pria)');
	assert.equal(d.couple.bride_name, 'Fajira', 'bride_name harus Fajira (wanita)');
	assert.notEqual(d.couple.groom_name, 'Fajira');
	assert.notEqual(d.couple.bride_name, 'Dion');

	// Konsistensi nama singkat (judul) dengan nama lengkap (profil image-box):
	// bagian pertama nama lengkap harus memuat nama judul di sisi yang sama.
	assert.ok(
		d.couple.groom_full.startsWith('Dion'),
		`groom_full="${d.couple.groom_full}" harus diawali nama groom "${d.couple.groom_name}"`
	);
	assert.ok(
		d.couple.bride_full.startsWith('Fajira'),
		`bride_full="${d.couple.bride_full}" harus diawali nama bride "${d.couple.bride_name}"`
	);

	// Deteksi urutan "Bride & Groom" dilaporkan agar reviewer tahu sisi ditukar.
	const swapped = d.report.entries.find(
		(e) => e.field === 'couple.groom_name' && /Bride & Groom/.test(e.note ?? '')
	);
	assert.ok(swapped, 'laporan harus menandai urutan "Bride & Groom" terdeteksi');
});

test('REGRESI: resolveTitleOrientation menukar sisi hanya saat profil menentukan', () => {
	// Judul "Bride & Groom": kiri = wanita (Fajira) → tukar.
	assert.deepEqual(resolveTitleOrientation('Fajira', 'Dion', 'Dion Cahya Putra', 'Fajira Dian Eka'), {
		groom: 'Dion',
		bride: 'Fajira',
		note: 'Urutan judul "Bride & Groom" terdeteksi dari profil mempelai — sisi pria/wanita ditukar.'
	});
	// Judul "Groom & Bride" (konvensi lazim): kiri = pria → biarkan.
	assert.deepEqual(resolveTitleOrientation('Gilbert', 'Hana', 'Gilbert Sanjaya, SE', 'Hana Dian Cempaka, SE'), {
		groom: 'Gilbert',
		bride: 'Hana'
	});
	// Tanpa info profil: fallback ke konvensi kiri = pria (tidak menukar).
	assert.deepEqual(resolveTitleOrientation('Budi', 'Siti', '', ''), { groom: 'Budi', bride: 'Siti' });
});

/* ========================================================================== */
/* 7. BUKTI pada JSON NYATA USER — LW002 (6 section, galeri via `image`)      */
/* ========================================================================== */

test('LW002.json (nyata): nama, dua acara, galeri image, kutipan', () => {
	const d = parseElementor(loadFixture('LW002.json'));

	assert.equal(d.report.format, 'elementor');
	assert.equal(d.report.templateTitle, 'LW002');
	assert.equal(d.report.sectionCount, 6);

	assert.equal(d.couple.groom_name, 'Gilbert');
	assert.equal(d.couple.bride_name, 'Hana');
	assert.equal(d.couple.groom_full, 'Gilbert Sanjaya, SE');
	assert.equal(d.couple.bride_full, 'Hana Dian Cempaka, SE');
	assert.match(d.couple.groom_parents, /Putra Kedua/);

	// Dua acara: Pemberkatan & Resepsi (jalur heading berurutan).
	assert.equal(d.events.length, 2);
	const [e1, e2] = d.events;
	assert.equal(e1.date_iso, '2021-05-15T08:00');
	assert.match(e1.title, /Pemberkatan/i);
	assert.equal(e2.date_iso, '2021-05-15T11:00');
	// Venue dari heading "Lokasi:" → "Hotel Cipanas 2, Jawa Barat".
	assert.match(d.events[1].venue, /Hotel Cipanas/);

	// Galeri dari 5 widget `image`.
	assert.ok(d.gallery.length >= 5, `galeri=${d.gallery.length}`);
	assert.match(d.gallery[0].url, /optimize-pexels-trung-nguyen-1751682/);

	// Kutipan Matius.
	assert.match(d.settings.quote, /Matius 19:6/);
	assert.ok(!/[<>]/.test(d.settings.quote));
});

/* ========================================================================== */
/* 8. Integritas gambar (report.images)                                       */
/* ========================================================================== */

test('report.images: semua gambar terdaftar dengan sumber & peran', () => {
	const d = parseElementor(loadFixture('LW001.json'));
	assert.ok(d.images.length >= d.gallery.length, 'images harus mencakup galeri');
	const usedFor = new Set(d.images.map((i) => i.usedFor));
	assert.ok(usedFor.has('cover'));
	assert.ok(usedFor.has('groom_photo'));
	assert.ok(usedFor.has('bride_photo'));
	assert.ok(usedFor.has('gallery'));
	for (const img of d.images) {
		assert.ok(['remote', 'local', 'unknown'].includes(img.source));
		assert.ok(img.url.length > 0);
	}
});

/* ========================================================================== */
/* 9. Determinisme & kemurnian                                                */
/* ========================================================================== */

test('parser deterministik: dua kali parse hasilkan JSON identik', () => {
	const raw = loadFixture('LW001.json');
	const a = JSON.stringify(parseElementor(raw));
	const b = JSON.stringify(parseElementor(raw));
	assert.equal(a, b);
});

test('parser murni: tidak memutasi input', () => {
	const raw: any = loadFixture('LW002.json');
	const before = JSON.stringify(raw);
	parseElementor(raw);
	assert.equal(JSON.stringify(raw), before);
});
