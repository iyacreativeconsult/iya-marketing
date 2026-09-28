/**
 * Mod Demo: cuba sistem tanpa Firebase dan tanpa log masuk.
 * Data disimpan dalam memori dan hilang bila server dihentikan.
 *
 * Hanya aktif dengan `npm run demo`. Tidak boleh aktif di production atau Vercel.
 */
export function isDemo(): boolean {
  return process.env.DEMO_MODE === "1" && process.env.NODE_ENV !== "production" && !process.env.VERCEL;
}

export const DEMO_USER_COOKIE = "demo_user";
export const DEMO_DEFAULT_USER = "demo-admin";
