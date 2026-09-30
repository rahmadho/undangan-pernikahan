/**
 * elementor.ts — Parser MURNI Elementor / Landingstar JSON → ImportDraft.
 *
 * Rujukan: `docs/import-json-rancangan.md` §4 (strategi pemetaan) & §6.1.
 *
 * Karakteristik modul:
 *  - **Murni & deterministik**: tanpa I/O, tanpa `$env`, tanpa `fetch`, tanpa
 *    akses DB. Input apa pun (termasuk `null`/string rusak) menghasilkan output
 *    atau melempar Error dengan pesan Indonesia yang informatif.
 *  - **Defensif**: traversal toleran terhadap `elements` bersarang (list-of-list),
 *    memiliki batas kedalaman & jumlah node, dan membersihkan HTML.
 *  - **Tidak menulis data apa pun** — hanya menyusun `ImportDraft` + laporan.
 *
 * Bentuk sumber (ringkas):
 *   { title, type:"page", version:"0.4", page_settings:[], content:[section...] }
 *   section → column → (widget | section bersarang) → column → widget
 *   widget = { elType:"widget", widgetType:"heading"|"icon-box"|..., settings:{} }
 */

import type {
	DraftCouple,
	DraftEvent,
	DraftGalleryItem,
	DraftSettings,
	FieldStatus,
	ImageRef,
	ImportDraft,
	ImportReport,
	ReportEntry
} from './types.ts';
import { IMPORT_LIMITS } from './types.ts';

/* -------------------------------------------------------------------------- */
/* Utilitas teks murni                                                        */
/* -------------------------------------------------------------------------- */

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	ndash: '–',
	mdash: '—',
	hellip: '…',
	lsquo: '‘',
	rsquo: '’',
	ldquo: '“',
	rdquo: '”'
};

/**
 * Bersihkan HTML menjadi teks polos:
 *  - `<br>` / `</p>` → newline
 *  - buang seluruh tag lain
 *  - decode entitas nama & numerik
 *  - rapikan spasi berlebih, buang spasi di tepi
 *
 * Ini kunci pertahanan XSS tersimpan (rancangan §7): kita tidak pernah
 * menyimpan markup Elementor.
 */
export function textOf(input: unknown): string {
	if (input == null) return '';
	let s = typeof input === 'string' ? input : String(input);
	// Blok → newline agar tidak menempel antar-paragraf.
	s = s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-6]|li)>/gi, '\n');
	// Buang tag apa pun yang tersisa (termasuk komentar).
	s = s.replace(/<[^>]*>/g, '');
	// Decode entitas.
	s = s
		.replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCodePoint(parseInt(h, 16)))
		.replace(/&#(\d+);/g, (_, d) => safeCodePoint(parseInt(d, 10)))
		.replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[String(name).toLowerCase()] ?? m);
	// Rapikan spasi (jaga newline tunggal).
	s = s
		.split('\n')
		.map((line) => line.replace(/[ \t\f\v\u00a0]+/g, ' ').trim())
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	return s;
}

function safeCodePoint(code: number): string {
	if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
	try {
		return String.fromCodePoint(code);
	} catch {
		return '';
	}
}

/** Ambil & bersihkan teks sebuah widget/node `settings`. */
export function textOfSetting(settings: unknown, key: string): string {
	if (!settings || typeof settings !== 'object') return '';
	return textOf((settings as Record<string, unknown>)[key]);
}

/** Buang tag & trim (alias eksplisit untuk keterbacaan di parser). */
function clean(v: unknown): string {
	return textOf(v);
}

/* -------------------------------------------------------------------------- */
/* Utilitas struktur                                                          */
/* -------------------------------------------------------------------------- */

type Node = Record<string, unknown>;

function asArray(v: unknown): unknown[] {
	return Array.isArray(v) ? v : [];
}

function isObj(v: unknown): v is Node {
	return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Ekstrak URL dari objek gambar Elementor. Toleran terhadap:
 *  - `{ url, id }`  /  `{ id, url }`
 *  - `{ url: "" }`  /  string langsung  /  null
 */
export function imageUrl(v: unknown): string {
	if (!v) return '';
	if (typeof v === 'string') return v.trim();
	if (isObj(v)) {
		const u = v.url;
		return typeof u === 'string' ? u.trim() : '';
	}
	return '';
}

/** Klasifikasi asal gambar (lokal `/uploads` vs remote http). */
export function imageSource(url: string): ImageRef['source'] {
	const u = String(url || '').trim();
	if (!u) return 'unknown';
	if (u.startsWith('/uploads/')) return 'local';
	if (/^https?:\/\//i.test(u)) return 'remote';
	return 'unknown';
}

/* -------------------------------------------------------------------------- */
/* Flatten dokumen                                                            */
/* -------------------------------------------------------------------------- */

export interface FlatNode {
	elType: string;
	widgetType: string;
	settings: Node;
	/** Index section top-level tempat node berada (-1 bila di luar section). */
	sectionIndex: number;
	/** Judul/label section (dari `divider.text` pertama, ternormalisasi). */
	sectionLabel: string;
	/** Urutan global kemunculan node (0-based). */
	order: number;
}

interface SectionInfo {
	index: number;
	settings: Node;
	nodes: Node[]; // widget-widget di dalam section (termasuk nested)
	label: string;
}

interface WalkResult {
	nodes: FlatNode[];
	sections: SectionInfo[];
	nodeCount: number;
	truncated: boolean;
}

/**
 * Telusuri `content` secara rekursif & toleran.
 * Mengumpulkan daftar widget (flatten) dan daftar section top-level.
 * Menjaga batas kedalaman & jumlah node (cegah DoS).
 */
function walk(content: unknown): WalkResult {
	const nodes: FlatNode[] = [];
	const sections: SectionInfo[] = [];
	let nodeCount = 0;
	let truncated = false;

	const visit = (
		raw: unknown,
		depth: number,
		sectionIndex: number,
		sectionLabel: string,
		section: SectionInfo | null,
		isTopLevel: boolean
	): void => {
		if (truncated) return;
		if (depth > IMPORT_LIMITS.maxDepth) {
			truncated = true;
			return;
		}
		// Toleran terhadap `elements` berupa list-of-list.
		for (const childRaw of asArray(raw)) {
			if (truncated) return;
			// list bersarang → telusuri tanpa menambah kedalaman konseptual
			if (Array.isArray(childRaw)) {
				visit(childRaw, depth + 1, sectionIndex, sectionLabel, section, isTopLevel);
				continue;
			}
			if (!isObj(childRaw)) continue;
			if (nodeCount >= IMPORT_LIMITS.maxNodes) {
				truncated = true;
				return;
			}
			nodeCount++;

			const elType = typeof childRaw.elType === 'string' ? childRaw.elType : '';
			const settings = isObj(childRaw.settings) ? childRaw.settings : {};
			let curSection = section;
			let curIndex = sectionIndex;
			let curLabel = sectionLabel;

			if (elType === 'section' && isTopLevel) {
				curIndex = sections.length;
				curSection = { index: curIndex, settings, nodes: [], label: '' };
				sections.push(curSection);
				curLabel = '';
			}

			if (elType === 'widget') {
				const widgetType =
					typeof childRaw.widgetType === 'string' ? childRaw.widgetType : '';
				const flat: FlatNode = {
					elType,
					widgetType,
					settings,
					sectionIndex: curIndex,
					sectionLabel: curLabel,
					order: nodes.length
				};
				nodes.push(flat);
				if (curSection) curSection.nodes.push(childRaw);
			}

			const children = childRaw.elements;
			if (children != null) {
				// Hanya child dari section top-level yang boleh menandai section baru.
				visit(children, depth + 1, curIndex, curLabel, curSection, false);
			}
		}
	};

	visit(content, 0, -1, '', null, true);

	// Isi label tiap section dari `divider.text` pertama di dalamnya.
	for (const sec of sections) {
		sec.label = firstDividerLabel(sec.nodes);
	}

	return { nodes, sections, nodeCount, truncated };
}

function firstDividerLabel(widgetNodes: Node[]): string {
	for (const w of widgetNodes) {
		if (w.widgetType === 'divider') {
			const t = textOf((isObj(w.settings) ? w.settings : {}).text);
			if (t) return t;
		}
	}
	return '';
}

/* -------------------------------------------------------------------------- */
/* Deteksi format                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Deteksi apakah objek JSON ini menyerupai ekspor Elementor.
 * Dipakai endpoint untuk 400 yang informatif dan untuk laporan.
 */
export function detectFormat(json: unknown): 'elementor' | 'unknown' {
	if (!isObj(json)) return 'unknown';
	if (!Array.isArray(json.content)) return 'unknown';
	const looksLikeElementor =
		json.type === 'page' ||
		typeof json.version === 'string' ||
		'title' in json ||
		json.content.some((s) => isObj(s) && (s.elType === 'section' || 'elements' in s));
	return looksLikeElementor ? 'elementor' : 'unknown';
}

/* -------------------------------------------------------------------------- */
/* Ikon & kata kunci                                                          */
/* -------------------------------------------------------------------------- */

function iconValue(settings: Node): string {
	const ic = settings.selected_icon;
	if (isObj(ic) && typeof ic.value === 'string') return ic.value.toLowerCase();
	if (isObj(settings.icon) && typeof settings.icon.value === 'string')
		return String(settings.icon.value).toLowerCase();
	return '';
}

const KEY_CALENDAR = /calendar|date|tanggal/i;
const KEY_CLOCK = /clock|time|jam|watch/i;
const KEY_PIN = /map-?marker|location|pin|map/i;

/* -------------------------------------------------------------------------- */
/* Parse tanggal & waktu (defensif)                                           */
/* -------------------------------------------------------------------------- */

const BULAN_ID: Record<string, number> = {
	januari: 1,
	jan: 1,
	februari: 2,
	feb: 2,
	maret: 3,
	mar: 3,
	april: 4,
	apr: 4,
	mei: 5,
	may: 5,
	juni: 6,
	jun: 6,
	juli: 7,
	jul: 7,
	agustus: 8,
	agu: 8,
	ags: 8,
	aug: 8,
	september: 9,
	sep: 9,
	sept: 9,
	oktober: 10,
	okt: 10,
	oct: 10,
	november: 11,
	nov: 11,
	desember: 12,
	des: 12,
	dec: 12
};

function pad2(n: number): string {
	return String(n).padStart(2, '0');
}

/**
 * Parse tanggal dari teks bebas ke `YYYY-MM-DD`.
 * Didukung:
 *  - "Jumat, 18 April 2021" (hari opsional, nama bulan Indonesia/Inggris)
 *  - "18/04/2021", "18-04-2021", "2021-04-18"
 *  - "13.05.2021" (dd.mm.yyyy)
 * Gagal → '' (pemanggil menandai review).
 */
export function parseDateId(input: string): string {
	const s = String(input || '')
		.toLowerCase()
		.replace(/[.,](?=\s|$)/g, '')
		.trim();
	if (!s) return '';

	// ISO / yyyy-mm-dd
	let m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
	if (m) {
		const [, y, mo, d] = m;
		const mm = Number(mo);
		const dd = Number(d);
		if (isValidYmd(Number(y), mm, dd)) return `${y}-${pad2(mm)}-${pad2(dd)}`;
	}

	// "18 April 2021" / "18 agu 2021"
	m = s.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
	if (m) {
		const bulan = BULAN_ID[m[2]];
		if (bulan) {
			const dd = Number(m[1]);
			const y = Number(m[3]);
			if (isValidYmd(y, bulan, dd)) return `${y}-${pad2(bulan)}-${pad2(dd)}`;
		}
	}

	// dd/mm/yyyy atau dd-mm-yyyy atau dd.mm.yyyy
	m = s.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
	if (m) {
		const dd = Number(m[1]);
		const mm = Number(m[2]);
		const y = Number(m[3]);
		if (isValidYmd(y, mm, dd)) return `${y}-${pad2(mm)}-${pad2(dd)}`;
	}

	return '';
}

function isValidYmd(y: number, mo: number, d: number): boolean {
	if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return false;
	if (y < 1900 || y > 2200) return false;
	if (mo < 1 || mo > 12) return false;
	if (d < 1 || d > 31) return false;
	return true;
}

/**
 * Ambil jam:menit dari teks waktu ("15.00 WIB", "08.00 - 09.00 WIB") → "15:00".
 * Kosong bila tak ditemukan.
 */
export function parseTimeId(input: string): string {
	const m = String(input || '').match(/(\d{1,2})[.:](\d{2})/);
	if (!m) return '';
	const hh = Number(m[1]);
	const mm = Number(m[2]);
	if (hh > 23 || mm > 59) return '';
	return `${pad2(hh)}:${pad2(mm)}`;
}

/** Gabung tanggal + jam opsional → `YYYY-MM-DD[THH:mm]`. */
function combineDate(dateIso: string, timeText: string): string {
	if (!dateIso) return '';
	const t = parseTimeId(timeText);
	return t ? `${dateIso}T${t}` : dateIso;
}

/* -------------------------------------------------------------------------- */
/* Klasifikasi teks judul pasangan                                            */
/* -------------------------------------------------------------------------- */

const SCRIPT_FONTS = /great\s*vibes|dancing|parisienne|amita|allura|sacramento|pacifico|playfair/i;

function fontFamily(settings: Node): string {
	return typeof settings.typography_font_family === 'string'
		? settings.typography_font_family
		: '';
}

function fontSizePx(settings: Node): number {
	const fs = settings.typography_font_size;
	if (isObj(fs) && Number.isFinite(Number(fs.size))) return Number(fs.size);
	if (typeof fs === 'number') return fs;
	return 0;
}

const SPLIT_RE = /\s*(?:&|&amp;|\bdan\b|\bdengan\b|\b\+)\s*/i;

/** Pisah "Fajira & Dion" → { left, right }. Ambigu → right kosong. */
export function splitCouple(text: string): { left: string; right: string } {
	const t = clean(text);
	const parts = t.split(SPLIT_RE).filter(Boolean);
	if (parts.length >= 2) return { left: parts[0], right: parts.slice(1).join(' ') };
	return { left: t, right: '' };
}

/** Normalisasi nama untuk pencocokan longgar: huruf kecil, tanpa tanda baca, spasi tunggal. */
function normalizeName(s: string): string {
	return clean(s)
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Apakah `titleName` (mis. "Dion") merujuk ke orang dengan nama lengkap
 * `fullName` (mis. "Dion Cahya Putra")? Cocok bila salah satu token nama
 * judul muncul sebagai kata di nama lengkap (atau sebaliknya, untuk nama 1 kata).
 */
function nameMatches(titleName: string, fullName: string): boolean {
	const a = normalizeName(titleName);
	const b = normalizeName(fullName);
	if (!a || !b) return false;
	if (a === b) return true;
	const aTokens = a.split(' ');
	const bTokens = b.split(' ');
	const [shorter, longer] = aTokens.length <= bTokens.length ? [aTokens, bTokens] : [bTokens, aTokens];
	// Semua token nama yang lebih pendek harus ada di nama yang lebih panjang.
	return shorter.length > 0 && shorter.every((tok) => longer.includes(tok));
}

/**
 * Tentukan sisi pria/wanita dari judul pasangan.
 *
 * Urutan `title-left` = pria diasumsikan benar (konvensi "Groom & Bride"),
 * TETAPI bila salah satu sisi judul secara eksplisit cocok dengan nama
 * lengkap profil, peran dari profil dipakai (otoritatif) — mencegah bug
 * penukaran groom/bride pada tema "Bride & Groom" (mis. LW001 "Fajira & Dion").
 */
export function resolveTitleOrientation(
	left: string,
	right: string,
	groomFull: string,
	brideFull: string
): { groom: string; bride: string; note?: string } {
	const leftIsGroom = nameMatches(left, groomFull);
	const leftIsBride = nameMatches(left, brideFull);
	const rightIsGroom = nameMatches(right, groomFull);

	// Kiri cocok dengan profil mempelai WANITA (dan bukan pria) → sisi terbalik.
	if (leftIsBride && !leftIsGroom) {
		return {
			groom: right,
			bride: left,
			note: 'Urutan judul "Bride & Groom" terdeteksi dari profil mempelai — sisi pria/wanita ditukar.'
		};
	}
	// Kanan cocok dengan pria → juga menandakan urutan terbalik.
	if (rightIsGroom && !nameMatches(right, brideFull)) {
		return {
			groom: right,
			bride: left,
			note: 'Urutan judul "Bride & Groom" terdeteksi dari profil mempelai — sisi pria/wanita ditukar.'
		};
	}
	return { groom: left, bride: right };
}

/** Heuristik: apakah node heading ini kandidat "judul pasangan". */
function isCoupleTitleHeading(n: FlatNode): boolean {
	if (n.widgetType !== 'heading') return false;
	const t = textOfSetting(n.settings, 'title');
	if (!t || t.length > 80) return false;
	if (isClosingHeading(t)) return false;
	const hasSeparator = SPLIT_RE.test(t) && /[a-z]/i.test(t);
	const script = SCRIPT_FONTS.test(fontFamily(n.settings));
	const big = fontSizePx(n.settings) >= 40;
	const kicker = /^the wedding of$/i.test(t);
	return !!t && (hasSeparator || script || big) && !kicker;
}

/* -------------------------------------------------------------------------- */
/* Parser utama                                                               */
/* -------------------------------------------------------------------------- */

function emptyDraft(format: string, templateTitle: string, sourceVersion: string): ImportDraft {
	return {
		couple: {
			groom_name: '',
			groom_full: '',
			groom_photo: '',
			groom_parents: '',
			bride_name: '',
			bride_full: '',
			bride_photo: '',
			bride_parents: ''
		},
		events: [],
		gallery: [],
		settings: {
			quote: '',
			background_image: '',
			background_image_mobile: '',
			background_overlay: '',
			background_overlay_opacity: '',
			background_position: '',
			background_size: '',
			background_repeat: '',
			background_attachment: ''
		},
		images: [],
		report: {
			format,
			templateTitle,
			sourceVersion,
			sectionCount: 0,
			nodeCount: 0,
			entries: [],
			skipped: []
		}
	};
}

/**
 * Parse JSON Elementor/Landingstar menjadi `ImportDraft`.
 *
 * @param json Objek JSON yang sudah di-`JSON.parse`, atau string JSON.
 * @throws Error berbahasa Indonesia bila root bukan objek / `content` bukan array.
 */
export function parseElementor(json: unknown): ImportDraft {
	let root: unknown = json;
	if (typeof root === 'string') {
		try {
			root = JSON.parse(root);
		} catch {
			throw new Error('JSON tidak valid: gagal di-parse.');
		}
	}
	if (!isObj(root)) {
		throw new Error('Format tidak dikenali: akar JSON harus berupa objek.');
	}
	if (!Array.isArray(root.content)) {
		throw new Error('Format tidak dikenali: tidak ditemukan array "content" (bukan ekspor Elementor).');
	}

	const format = detectFormat(root);
	const templateTitle = typeof root.title === 'string' ? root.title : '';
	const sourceVersion = typeof root.version === 'string' ? root.version : '';

	const draft = emptyDraft(format, templateTitle, sourceVersion);
	const entries = draft.report.entries;
	const add = (field: string, status: FieldStatus, value?: string, note?: string) =>
		entries.push({ field, status, value, note } as ReportEntry);

	const { nodes, sections, nodeCount, truncated } = walk(root.content);
	draft.report.sectionCount = sections.length;
	draft.report.nodeCount = nodeCount;
	if (truncated) {
		draft.report.skipped.push({
			widgetType: '*',
			note: 'Struktur terlalu dalam/besar — sisa node diabaikan demi keamanan.'
		});
	}

	/* --- 1. Latar cover (section[0]) -------------------------------------- */
	const cover = sections[0]?.settings ?? {};
	const bg = imageUrl(cover.background_image);
	const bgMobile = imageUrl(cover.background_image_mobile);
	const overlay = typeof cover.background_overlay_color === 'string'
		? cover.background_overlay_color.trim()
		: '';
	const overlayOpacity = readOpacity(cover.background_overlay_opacity);

	if (bg) {
		draft.settings.background_image = clampText(bg, IMPORT_LIMITS.maxText);
		draft.images.push({ url: bg, source: imageSource(bg), usedFor: 'cover' });
		add('settings.background_image', 'ok', bg);
	}
	if (bgMobile) {
		draft.settings.background_image_mobile = clampText(bgMobile, IMPORT_LIMITS.maxText);
		draft.images.push({ url: bgMobile, source: imageSource(bgMobile), usedFor: 'cover_mobile' });
		add('settings.background_image_mobile', 'ok', bgMobile);
	}
	if (overlay) {
		draft.settings.background_overlay = clampText(overlay, 32);
		add('settings.background_overlay', 'ok', overlay);
	}
	if (overlayOpacity !== '') {
		draft.settings.background_overlay_opacity = overlayOpacity;
		add('settings.background_overlay_opacity', 'ok', overlayOpacity);
	}
	for (const key of ['background_position', 'background_size', 'background_repeat', 'background_attachment'] as const) {
		const v = cover[key];
		if (typeof v === 'string' && v.trim()) {
			draft.settings[key] = clampText(v, 32);
			add(`settings.${key}`, 'ok', v);
		}
	}

	/* --- 2. Profil mempelai (image-box) ----------------------------------- */
	// Diekstrak LEBIH DULU daripada judul: urutan kartu mempelai (image-box)
	// adalah sinyal otoritatif pria/wanita, dipakai untuk mengarahkan sisi
	// judul pasangan (lihat §3) bila urutan judul tidak lazim (mis. "Bride & Groom").
	const imageBoxes = nodes.filter((n) => n.widgetType === 'image-box');
	const profileBoxes = imageBoxes.slice(0, 2);
	const groomFull = profileBoxes[0] ? clean((profileBoxes[0].settings as Node).title_text) : '';
	const brideFull = profileBoxes[1] ? clean((profileBoxes[1].settings as Node).title_text) : '';

	/* --- 3. Judul pasangan ------------------------------------------------ */
	const titleNode =
		nodes.find((n) => isCoupleTitleHeading(n) && n.sectionIndex === 0) ??
		nodes.find((n) => isCoupleTitleHeading(n));
	if (titleNode) {
		const raw = textOfSetting(titleNode.settings, 'title');
		const { left, right } = splitCouple(raw);
		if (right) {
			// Tentukan sisi pria/wanita. Konvensi tampilan lazim: "Groom & Bride"
			// (kiri = pria). Namun sebagian tema menulis "Bride & Groom".
			// Bila salah satu nama judul cocok dengan nama lengkap profil, ikuti
			// peran dari profil (otoritatif) — ini mencegah bug penukaran groom/bride.
			const orientation = resolveTitleOrientation(left, right, groomFull, brideFull);
			draft.couple.groom_name = clampText(orientation.groom, 120);
			draft.couple.bride_name = clampText(orientation.bride, 120);
			add('couple.groom_name', 'ok', draft.couple.groom_name, orientation.note);
			add('couple.bride_name', 'ok', draft.couple.bride_name, orientation.note);
		} else {
			// Tanpa pemisah: pakai nama profil bila ada, jika tidak simpan apa adanya
			// di sisi wanita dengan status review (butuh koreksi manual).
			const single = left || groomFull || brideFull;
			draft.couple.bride_name = clampText(single, 120);
			add('couple.bride_name', 'review', draft.couple.bride_name,
				'Judul pasangan tanpa pemisah "&" — bagi nama pria/wanita manual.');
			add('couple.groom_name', 'review', '', 'Tidak dapat dipisah otomatis.');
		}
	} else {
		add('couple.groom_name', 'error', '', 'Judul pasangan tidak ditemukan.');
		add('couple.bride_name', 'error', '', 'Judul pasangan tidak ditemukan.');
	}

	/* --- 4. Profil mempelai: isi nama lengkap/foto/orangtua --------------- */
	if (profileBoxes.length >= 2) {
		const [groomBox, brideBox] = profileBoxes;
		applyProfile(draft, groomBox, 'groom', add, 'ok', imageBoxes.length);
		applyProfile(draft, brideBox, 'bride', add, 'ok', imageBoxes.length);
	} else if (profileBoxes.length === 1) {
		applyProfile(draft, profileBoxes[0], 'groom', add, 'review', 1);
		add('couple.bride_full', 'error', '', 'Hanya satu kartu mempelai ditemukan.');
	} else {
		add('couple.groom_full', 'error', '', 'Kartu mempelai (image-box) tidak ditemukan.');
	}

	/* --- 4. Acara: tanggal/waktu/venue (icon-box & heading) --------------- */
	buildEvents(draft, nodes, sections, add);

	/* --- 5. Galeri -------------------------------------------------------- */
	buildGallery(draft, nodes, add);

	/* --- 6. Kutipan / doa ------------------------------------------------- */
	const quoteText = findQuote(nodes);
	if (quoteText) {
		draft.settings.quote = clampText(quoteText, IMPORT_LIMITS.maxQuote);
		add('settings.quote', 'ok', draft.settings.quote.slice(0, 80) + (draft.settings.quote.length > 80 ? '…' : ''));
	} else {
		add('settings.quote', 'review', '', 'Kutipan/doa tidak terdeteksi.');
	}

	/* --- 7. Catat widget yang diabaikan ----------------------------------- */
	const HANDLED = new Set([
		'heading',
		'divider',
		'icon-box',
		'image-box',
		'image-carousel',
		'image',
		'google_maps',
		'button',
		'spacer',
		'icon'
	]);
	const ignored: Record<string, number> = {};
	for (const n of nodes) {
		if (!HANDLED.has(n.widgetType)) ignored[n.widgetType || '(tanpa tipe)'] = (ignored[n.widgetType || '(tanpa tipe)'] ?? 0) + 1;
		if (n.widgetType === 'button') {
			add('button', 'skipped', textOfSetting(n.settings, 'text'), 'Tombol CTA diabaikan (RSVP internal).');
		}
	}
	for (const [wt, cnt] of Object.entries(ignored)) {
		draft.report.skipped.push({ widgetType: wt, note: `Widget tidak dipetakan (${cnt}×).` });
	}

	return draft;
}

/* -------------------------------------------------------------------------- */
/* Sub-parser: profil mempelai                                                */
/* -------------------------------------------------------------------------- */

function applyProfile(
	draft: ImportDraft,
	box: FlatNode,
	who: 'groom' | 'bride',
	add: (f: string, s: FieldStatus, v?: string, n?: string) => void,
	status: FieldStatus,
	boxCount: number
): void {
	const s = box.settings as Node;
	const name = clean(s.title_text);
	const desc = clean(s.description_text);
	const photo = imageUrl(s.image);

	const prefix = who === 'groom' ? 'groom' : 'bride';
	if (name) {
		draft.couple[`${prefix}_full`] = clampText(name, 120);
		add(`couple.${prefix}_full`, status, draft.couple[`${prefix}_full`],
			boxCount > 2 ? 'Ada >2 kartu mempelai — verifikasi urutan pria/wanita.' : undefined);
	} else {
		add(`couple.${prefix}_full`, 'error', '', 'Nama mempelai kosong pada kartu.');
	}
	if (desc) {
		draft.couple[`${prefix}_parents`] = clampText(desc, 240);
		add(`couple.${prefix}_parents`, 'ok', draft.couple[`${prefix}_parents`]);
	}
	if (photo) {
		draft.couple[`${prefix}_photo`] = clampText(photo, IMPORT_LIMITS.maxText);
		draft.images.push({ url: photo, source: imageSource(photo), usedFor: `${prefix}_photo` });
		add(`couple.${prefix}_photo`, 'ok', photo);
	}
}

/* -------------------------------------------------------------------------- */
/* Sub-parser: acara                                                          */
/* -------------------------------------------------------------------------- */

function buildEvents(
	draft: ImportDraft,
	nodes: FlatNode[],
	sections: { label: string }[],
	add: (f: string, s: FieldStatus, v?: string, n?: string) => void
): void {
	// 4a. Jalur LW001: icon-box kalender/jam/pin.
	const iconBoxes = nodes.filter((n) => n.widgetType === 'icon-box');
	let calendar = '';
	let clock = '';
	let pin = '';
	for (const b of iconBoxes) {
		const icon = iconValue(b.settings as Node);
		const val = clean((b.settings as Node).title_text);
		if (!val) continue;
		if (!calendar && KEY_CALENDAR.test(icon)) calendar = val;
		else if (!clock && KEY_CLOCK.test(icon)) clock = val;
		else if (!pin && KEY_PIN.test(icon)) pin = val;
	}

	const maps = nodes.find((n) => n.widgetType === 'google_maps');
	const mapsAddress = maps ? clean((maps.settings as Node).address) : '';

	// Label acara: dari divider pada section acara (mis. "Detail Pernikahan").
	const eventSectionLabel = pickEventLabel(sections, nodes, iconBoxes.length > 0, !!maps);

	if (calendar || clock || pin || mapsAddress) {
		const dateIso = parseDateId(calendar);
		const timeText = clock;
		const ev: DraftEvent = {
			key: slugKey(eventSectionLabel) || 'acara',
			title: titleCase(eventSectionLabel) || 'Acara',
			date_iso: combineDate(dateIso, timeText),
			time_text: clampText(timeText, 120),
			venue: clampText(pin, 240),
			address: clampText(mapsAddress, 240),
			maps_url: mapsAddress ? buildMapsUrl(mapsAddress) : '',
			dateStatus: dateIso ? 'ok' : calendar ? 'review' : 'error'
		};
		draft.events.push(ev);
		reportEvent(add, ev, calendar);
	}

	// 4b. Jalur LW002: heading berurutan (tanggal → nama acara → waktu → venue).
	if (draft.events.length === 0) {
		buildEventsFromHeadings(draft, nodes, add);
	}
}

function pickEventLabel(
	sections: { label: string }[],
	nodes: FlatNode[],
	hasIconBox: boolean,
	hasMaps: boolean
): string {
	// Divider pada section yang mengandung icon-box/maps (paling relevan).
	const relevant = nodes.find(
		(n) => n.widgetType === 'divider' && /acara|detail|pernikahan|resepsi|akad/i.test(textOfSetting(n.settings, 'text'))
	);
	if (relevant) return textOfSetting(relevant.settings, 'text');
	for (const s of sections) {
		if (/acara|detail|pernikahan/i.test(s.label)) return s.label;
	}
	return hasIconBox || hasMaps ? 'Detail Pernikahan' : '';
}

function buildEventsFromHeadings(
	draft: ImportDraft,
	nodes: FlatNode[],
	add: (f: string, s: FieldStatus, v?: string, n?: string) => void
): void {
	const headings = nodes.filter((n) => n.widgetType === 'heading');
	// Cari heading tanggal "yang benar": diikuti oleh alur acara (nama/waktu),
	// BUKAN heading tanggal cover yang langsung disusul blok penutup.
	let dateIdx = -1;
	let dateIso = '';
	for (let i = 0; i < headings.length; i++) {
		const t = textOfSetting(headings[i].settings, 'title');
		const d = parseDateId(t);
		if (!d || SPLIT_RE.test(t)) continue;
		// Heading berikutnya yang BERMAKNA harus terlihat seperti nama acara
		// (mis. "Pemberkatan"/"Resepsi"/"Akad"), bukan blok penutup.
		// Ini menghindari memilih tanggal cover (mis. "13.05.2021") yang
		// langsung disusul "We Are Married!".
		const nextMeaningful = headings
			.slice(i + 1)
			.map((h) => textOfSetting(h.settings, 'title'))
			.find((x) => x && !isClosingHeading(x) && !parseDateId(x));
		if (nextMeaningful && isEventName(nextMeaningful)) {
			// Simpan kandidat TERAKHIR: tanggal acara biasanya muncul setelah
			// tanggal cover (mis. cover "13.05.2021" lalu acara "Thursday, 15 Mei 2021").
			dateIdx = i;
			dateIso = d;
		}
	}
	// Fallback: tanggal parseable pertama (meski tak ada alur acara jelas).
	if (dateIdx < 0) {
		for (let i = 0; i < headings.length; i++) {
			const d = parseDateId(textOfSetting(headings[i].settings, 'title'));
			if (d) {
				dateIdx = i;
				dateIso = d;
				break;
			}
		}
	}
	if (dateIdx < 0) {
		if (nodes.some((n) => n.widgetType === 'heading'))
			add('events', 'review', '', 'Acara tidak terdeteksi otomatis (heading tanpa pola tanggal).');
		return;
	}

	const after = headings.slice(dateIdx + 1);
	// Pola: [NamaAcara, Waktu, NamaAcara2, Waktu2, "Lokasi:", Venue]
	const events: DraftEvent[] = [];
	let pendingName = '';
	let pendingTime = '';
	let venue = '';

	const flush = () => {
		// Hanya anggap acara bila ada waktu (nama+"jam" adalah pola event nyata).
		// Nama menggantung tanpa waktu (mis. nama pasangan di footer) diabaikan.
		if (!pendingTime) {
			pendingName = '';
			return;
		}
		const ev: DraftEvent = {
			key: slugKey(pendingName) || `acara-${events.length + 1}`,
			title: titleCase(pendingName) || 'Acara',
			date_iso: combineDate(dateIso, pendingTime),
			time_text: clampText(pendingTime, 120),
			venue: '',
			address: '',
			maps_url: '',
			dateStatus: 'ok'
		};
		events.push(ev);
		pendingName = '';
		pendingTime = '';
	};

	for (const h of after) {
		const t = textOfSetting(h.settings, 'title');
		if (!t) continue;
		// Lompati heading naratif/penutup (mis. "We Are Married!", "With Love,").
		// Hentikan HANYA pada footer keras (©/copyright) — itu akhir dokumen.
		if (/^(©|&copy;)/i.test(t.trim()) || /wedding invitations?$/i.test(t)) break;
		if (isClosingHeading(t)) continue;
		// Lompati heading tanggal (bisa muncul lagi, mis. tanggal acara utama).
		if (parseDateId(t)) continue;
		// Lompati heading kutipan/paragraf panjang.
		if (t.length > 180) continue;
		if (/^lokasi\s*:?$/i.test(t)) {
			flush();
			continue;
		}
		const timeM = parseTimeId(t);
		const looksLikeTime = /wib|wita|wit|[0-9]/.test(t) && (timeM !== '' || /^\d{1,2}[.:]\d{2}/.test(t));
		const looksLikeVenue = /hotel|gedung|jalan|jl\.|kecamatan|kota|jakarta|bandung|surabaya|cipanas/i.test(t);

		if (looksLikeTime) {
			pendingTime = t;
			flush();
		} else if (looksLikeVenue && events.length > 0) {
			venue = t;
			events[events.length - 1].venue = clampText(venue, 240);
			events[events.length - 1].address = clampText(venue, 240);
			events[events.length - 1].maps_url = buildMapsUrl(venue);
		} else {
			pendingName = t;
		}
	}
	flush();

	for (const ev of events) {
		draft.events.push(ev);
		reportEvent(add, ev, '');
	}
}

function reportEvent(
	add: (f: string, s: FieldStatus, v?: string, n?: string) => void,
	ev: DraftEvent,
	rawDate: string
): void {
	const i = ev.key;
	if (ev.date_iso) {
		add(`events[${i}].date_iso`, ev.dateStatus, ev.date_iso,
			ev.dateStatus === 'review' ? `Tanggal asli tidak dikenali: "${rawDate}".` : undefined);
	} else {
		add(`events[${i}].date_iso`, 'review', '', `Tanggal tidak dapat di-parse: "${rawDate}".`);
	}
	if (ev.time_text) add(`events[${i}].time_text`, 'ok', ev.time_text);
	if (ev.venue) add(`events[${i}].venue`, 'ok', ev.venue);
	if (ev.address) add(`events[${i}].address`, 'ok', ev.address);
	if (ev.maps_url) add(`events[${i}].maps_url`, 'ok', ev.maps_url);
}

/* -------------------------------------------------------------------------- */
/* Sub-parser: galeri                                                         */
/* -------------------------------------------------------------------------- */

function buildGallery(
	draft: ImportDraft,
	nodes: FlatNode[],
	add: (f: string, s: FieldStatus, v?: string, n?: string) => void
): void {
	const seen = new Set<string>();
	const push = (url: string, caption: string, usedFor: string) => {
		if (!url || seen.has(url)) return;
		if (draft.gallery.length >= IMPORT_LIMITS.maxGallery) return;
		seen.add(url);
		draft.gallery.push({ url: clampText(url, IMPORT_LIMITS.maxText), caption: clampText(caption, 120) });
		draft.images.push({ url, source: imageSource(url), usedFor });
	};

	// Jalur A: image-carousel.carousel[] (LW001).
	for (const n of nodes) {
		if (n.widgetType !== 'image-carousel') continue;
		const arr = asArray((n.settings as Node).carousel);
		for (const item of arr) {
			const url = imageUrl(item);
			if (url) push(url, '', 'gallery');
		}
	}

	// Jalur B: widget `image` (LW002) — hanya di section galeri agar tak
	// mencampur background/lainnya.
	const gallerySectionIdx = nodes.find(
		(n) => n.widgetType === 'divider' && /galeri|gallery|momen/i.test(textOfSetting(n.settings, 'text'))
	)?.sectionIndex;
	for (const n of nodes) {
		if (n.widgetType !== 'image') continue;
		if (gallerySectionIdx != null && n.sectionIndex !== gallerySectionIdx) continue;
		const url = imageUrl((n.settings as Node).image);
		if (url) push(url, '', 'gallery');
	}

	// Jalur C (fallback): bila belum ada galeri sama sekali, pakai image-box
	// yang TIDAK dipakai sebagai foto profil (index ≥ 2).
	if (draft.gallery.length === 0) {
		const boxes = nodes.filter((n) => n.widgetType === 'image-box');
		for (const b of boxes.slice(2)) {
			const url = imageUrl((b.settings as Node).image);
			if (url) push(url, clean((b.settings as Node).title_text), 'gallery');
		}
	}

	if (draft.gallery.length) {
		add('gallery', 'ok', `${draft.gallery.length} foto`);
	} else {
		add('gallery', 'review', '', 'Galeri tidak ditemukan.');
	}
}

/* -------------------------------------------------------------------------- */
/* Sub-parser: kutipan                                                        */
/* -------------------------------------------------------------------------- */

function findQuote(nodes: FlatNode[]): string {
	// Prioritas: heading panjang (≥120 char) atau mengandung penanda ayat/doa.
	const candidates = nodes
		.filter((n) => n.widgetType === 'heading')
		.map((n) => ({ n, t: textOfSetting(n.settings, 'title') }))
		.filter(({ t }) => t.length >= 120 || /matius|qs\.|ar-rum|doa|ayat|:“|“/.test(t));
	if (!candidates.length) return '';
	// Ambil yang paling panjang sebagai doa/kutipan utama.
	candidates.sort((a, b) => b.t.length - a.t.length);
	return candidates[0].t;
}

/* -------------------------------------------------------------------------- */
/* Helpers kecil                                                              */
/* -------------------------------------------------------------------------- */

function clampText(v: unknown, max: number): string {
	return String(v ?? '').trim().slice(0, max);
}

function readOpacity(v: unknown): string {
	let size: unknown;
	if (isObj(v)) size = v.size;
	else size = v;
	const n = Number(size);
	if (!Number.isFinite(n)) return '';
	// Elementor menyimpan 0..1 (kadang 0..100).
	let val = n;
	if (val > 1) val = val / 100;
	val = Math.max(0, Math.min(1, val));
	return String(Number(val.toFixed(3)));
}

function slugKey(s: string): string {
	return clean(s)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40);
}

function titleCase(s: string): string {
	const t = clean(s);
	if (!t) return '';
	return t
		.split(/\s+/)
		.map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
		.join(' ');
}

function buildMapsUrl(address: string): string {
	const q = encodeURIComponent(address.trim());
	return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/**
 * Heading penanda blok penutup/footer (agar tidak dicomot sebagai nama acara
 * atau judul pasangan). Contoh nyata: "© Gilbert & Hana 2021 Wedding Invitations",
 * "With Love,", "We Are Married!".
 */
function isClosingHeading(t: string): boolean {
	const s = t.trim().toLowerCase();
	if (!s) return true;
	if (s.startsWith('©') || s.startsWith('&copy;')) return true;
	if (/wedding invitations?$/.test(s)) return true;
	if (/^(with love|kami menanti|we are married|the wedding of)/.test(s)) return true;
	return false;
}

/** Kandidat nama acara: pendek & bukan kalimat naratif. */
function isEventName(t: string): boolean {
	const s = t.trim();
	if (!s || s.length > 40) return false;
	if (parseTimeId(s)) return false;
	if (/^(lokasi|location)\s*:?$/i.test(s)) return false;
	const wordCount = s.split(/\s+/).length;
	return wordCount <= 4;
}
