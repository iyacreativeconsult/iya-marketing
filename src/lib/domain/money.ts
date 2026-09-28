/**
 * Wang disimpan sebagai integer sen (RM 1.50 = 150) supaya tiada ralat
 * perpuluhan bila menjumlahkan perbelanjaan.
 */

export const MAX_SEN = 1_000_000_000; // RM 10,000,000

/** "1,500.50" / "1500" / "RM 1500.5" -> sen. Pulangkan null jika tidak sah. */
export function parseRmToSen(input: string): number | null {
  const cleaned = input.replace(/rm/i, "").replace(/[\s,]/g, "");
  if (cleaned === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".") as [string, string?];
  const sen = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(sen) || sen > MAX_SEN) return null;
  return sen;
}

export function formatSen(sen: number): string {
  const rm = sen / 100;
  const decimals = sen % 100 === 0 ? 0 : 2;
  return `RM ${rm.toLocaleString("en-MY", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/** Untuk isi semula borang: 150050 -> "1500.50" */
export function senToInput(sen: number): string {
  if (sen % 100 === 0) return String(sen / 100);
  return (sen / 100).toFixed(2);
}

/** Ringkas untuk jadual padat: 320000 sen -> "3.2k", 50000 -> "500" */
export function compactRm(sen: number): string {
  const rm = sen / 100;
  const sign = rm < 0 ? "-" : "";
  const a = Math.abs(rm);
  if (a >= 1000) return `${sign}${(a / 1000).toFixed(a % 1000 === 0 ? 0 : 1)}k`;
  return `${sign}${Math.round(a)}`;
}
