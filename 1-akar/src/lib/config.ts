// Tetapan yang mudah diubah tanpa sentuh logik sistem.

export const APP_NAME = "iya Creative";
export const APP_SUBTITLE = "Marketing Management System";

/** Zon masa rasmi sistem. Semua tarikh (YYYY-MM-DD) dikira dalam zon ini. */
export const TIMEZONE = "Asia/Kuala_Lumpur";

/* Produk, outlet, jenis campaign, platform, kategori dan niche kini diurus di
   halaman Tetapan (Admin), bukan di sini. Nilai awal: src/lib/domain/master.ts */

/** Tempoh sesi log masuk (hari). Selepas ini pengguna perlu log masuk semula. */
export const SESSION_DAYS = 5;

/** Campaign dianggap "akan datang" jika bermula dalam tempoh ini (hari). */
export const COMING_SOON_DAYS = 7;
