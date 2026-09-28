/** Kenal pasti platform dari pautan, untuk label kad rujukan. */
const RULES: [RegExp, string][] = [
  [/(^|\.)tiktok\.com$/i, "TikTok"],
  [/(^|\.)instagram\.com$/i, "Instagram"],
  [/(^|\.)(youtube\.com|youtu\.be)$/i, "YouTube"],
  [/(^|\.)(facebook\.com|fb\.watch|fb\.com)$/i, "Facebook"],
  [/(^|\.)(x\.com|twitter\.com)$/i, "X"],
  [/(^|\.)threads\.(net|com)$/i, "Threads"],
  [/(^|\.)lemon8-app\.com$/i, "Lemon8"],
  [/(^|\.)shopee\.com\.my$/i, "Shopee"],
  [/(^|\.)lazada\.com\.my$/i, "Lazada"],
  [/(^|\.)(drive|docs)\.google\.com$/i, "Google Drive"],
  [/(^|\.)canva\.com$/i, "Canva"],
];

export function detectPlatform(url: string): string {
  try {
    const host = new URL(url).hostname;
    return RULES.find(([re]) => re.test(host))?.[1] ?? host.replace(/^www\./, "");
  } catch {
    return "Pautan";
  }
}

/** Data lama (senarai URL) atau baru ({ url, note }) -> bentuk baru. */
export function normalizeRefs(v: unknown): { url: string; note: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((r) => (typeof r === "string" ? { url: r, note: "" } : r && typeof r === "object" ? { url: String((r as { url?: unknown }).url ?? ""), note: String((r as { note?: unknown }).note ?? "") } : null))
    .filter((r): r is { url: string; note: string } => Boolean(r && r.url));
}
