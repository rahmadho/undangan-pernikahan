/** Tipe data undangan (dipakai frontend & API). */

export interface Couple {
	groom_name: string;
	groom_full?: string;
	groom_ig?: string;
	groom_photo?: string;
	groom_parents?: string;
	bride_name: string;
	bride_full?: string;
	bride_ig?: string;
	bride_photo?: string;
	bride_parents?: string;
	love_story?: string;
}

export interface EventItem {
	id: number;
	key: string;
	title: string;
	date_iso: string;
	time_text?: string;
	venue?: string;
	address?: string;
	maps_url?: string;
}

export interface GalleryItem {
	id: number;
	url: string;
	caption?: string;
}

export interface GiftItem {
	id: number;
	type: string;
	bank_name?: string;
	account_no?: string;
	account_name?: string;
}

export interface WishItem {
	id: number;
	name: string;
	message: string;
	attending?: string;
	created_at?: string;
}

export interface Settings {
	music_url: string;
	quote: string;
	theme: string;
	video_url: string;
	live_url: string;
	live_text: string;
	qris_image: string;
	gift_address: string;
	gift_enabled: string;
	watermark_text: string;
	watermark_enabled: string;
	background_image: string;
	background_image_mobile: string;
	background_overlay: string;
	background_overlay_opacity: string;
	background_position: string;
	background_size: string;
	background_repeat: string;
	background_attachment: string;
	background_position_mobile: string;
	background_size_mobile: string;
	background_repeat_mobile: string;
}

export interface CustomTheme {
	id: number;
	slug: string;
	name: string;
	base: string;
	tokens: Record<string, string>;
}

export interface InvitationData {
	account: { id: number; slug: string; title?: string; theme: string };
	couple: Couple | null;
	events: EventItem[];
	gallery: GalleryItem[];
	gifts: GiftItem[];
	wishes: WishItem[];
	settings: Settings;
	themes: CustomTheme[];
}
