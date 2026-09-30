/**
 * types.ts — Tipe untuk impor konfigurasi JSON (Elementor / Landingstar) → draft undangan.
 *
 * Rujukan rancangan: `docs/import-json-rancangan.md` §6.1.
 *
 * Modul ini **murni**: hanya tipe + konstanta, tanpa I/O, tanpa `$env`, tanpa
 * dependensi ke server/db. Aman diimpor dari unit test maupun endpoint.
 */

/** Status pemetaan sebuah field hasil parsing. */
export type FieldStatus =
	/** Terpetakan dengan yakin. */
	| 'ok'
	/** Terpetakan tapi butuh konfirmasi manusia (heuristik ambigu). */
	| 'review'
	/** Sengaja tidak dipetakan (widget tak relevan / data runtime). */
	| 'skipped'
	/** Gagal dipetakan / nilai tidak valid. */
	| 'error';

/** Satu baris laporan pemetaan (per field atau per node). */
export interface ReportEntry {
	/** Peran/field logis, mis. `couple.groom_name`, `events[0].date_iso`. */
	field: string;
	status: FieldStatus;
	/** Nilai hasil (sudah disanitasi) atau potongan sumber, untuk pratinjau. */
	value?: string;
	/** Catatan manusiawi (alasan review/skip/error). */
	note?: string;
}

/** Laporan lengkap hasil parsing. */
export interface ImportReport {
	/** Format sumber terdeteksi, mis. `elementor` atau `unknown`. */
	format: string;
	/** Judul template dari file (`title`), mis. `LW001` (kode tema, bukan nama pasangan). */
	templateTitle: string;
	/** Versi skema sumber (`version`), mis. `0.4`. */
	sourceVersion: string;
	/** Jumlah section top-level. */
	sectionCount: number;
	/** Jumlah node (section+column+widget) yang ditelusuri. */
	nodeCount: number;
	/** Rincian per field. */
	entries: ReportEntry[];
	/** Widget/node yang diabaikan, beserta alasannya. */
	skipped: { widgetType: string; note: string }[];
	/** Pesan galat fatal bila parsing gagal seluruhnya. */
	fatal?: string;
}

/** Asal sebuah gambar yang dirujuk draft. */
export type ImageSource =
	/** URL http/https pihak ketiga (hotlink berisiko). */
	| 'remote'
	/** Sudah di `/uploads/...` (lokal aplikasi). */
	| 'local'
	/** Tidak diketahui / kosong. */
	| 'unknown';

/** Referensi gambar yang ditemukan parser, untuk pratinjau & mode unduh. */
export interface ImageRef {
	url: string;
	source: ImageSource;
	/** Peran gambar: `cover`, `cover_mobile`, `groom_photo`, `bride_photo`, `gallery`. */
	usedFor: string;
}

/** Field mempelai pada draft (subset `Couple`, semua opsional). */
export interface DraftCouple {
	groom_name: string;
	groom_full: string;
	groom_photo: string;
	groom_parents: string;
	bride_name: string;
	bride_full: string;
	bride_photo: string;
	bride_parents: string;
}

/** Field acara pada draft (subset `EventItem`). */
export interface DraftEvent {
	key: string;
	title: string;
	/** `YYYY-MM-DD` atau `YYYY-MM-DDTHH:mm`; kosong bila gagal di-parse. */
	date_iso: string;
	time_text: string;
	venue: string;
	address: string;
	maps_url: string;
	/** Status khusus untuk field tanggal (paling rapuh). */
	dateStatus: FieldStatus;
}

/** Field galeri pada draft. */
export interface DraftGalleryItem {
	url: string;
	caption: string;
}

/** Settings yang boleh diisi importer (hanya key yang SUDAH ada di whitelist admin). */
export interface DraftSettings {
	quote: string;
	background_image: string;
	background_image_mobile: string;
	background_overlay: string;
	background_overlay_opacity: string;
	background_position: string;
	background_size: string;
	background_repeat: string;
	background_attachment: string;
}

/**
 * Hasil parsing murni. Ini BUKAN payload tulis final — endpoint apply
 * (fase berikutnya) yang menyusun payload & memvalidasi ulang lewat
 * `applyContent()`. Semua nilai di sini sudah disanitasi dari HTML mentah.
 */
export interface ImportDraft {
	couple: DraftCouple;
	events: DraftEvent[];
	gallery: DraftGalleryItem[];
	settings: DraftSettings;
	/** Semua gambar yang ditemukan (cover, profil, galeri). */
	images: ImageRef[];
	report: ImportReport;
}

/** Batas keras parser (cegah DoS dari JSON raksasa / rekursif). */
export const IMPORT_LIMITS = {
	/** Kedalaman maksimum penelusuran `elements` (level). */
	maxDepth: 16,
	/** Jumlah node maksimum yang ditelusuri. */
	maxNodes: 5000,
	/** Panjang teks hasil sanitasi (char) untuk field pendek. */
	maxText: 500,
	/** Panjang kutipan/doa (char). */
	maxQuote: 500,
	/** Jumlah maksimum gambar galeri. */
	maxGallery: 60
} as const;
