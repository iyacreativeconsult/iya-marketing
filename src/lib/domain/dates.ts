import { TIMEZONE } from "../config";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Tarikh hari ini dalam zon masa Malaysia, format YYYY-MM-DD. */
export function todayMYT(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isValidYmd(value: string): boolean {
  if (!YMD.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Bilangan hari dari a ke b (b - a). */
export function diffDays(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Dua julat tarikh (inklusif) bertindih? */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/** "2026-10" -> julat tarikh bulan itu. Input tidak sah -> bulan semasa. */
export function monthRange(ym?: string | null, now: Date = new Date()): { month: string; from: string; to: string } {
  const month = ym && /^\d{4}-(0[1-9]|1[0-2])$/.test(ym) ? ym : todayMYT(now).slice(0, 7);
  const from = `${month}-01`;
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { month, from, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

const MONTHS_MS = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
const DAYS_MS = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];

export function formatMonthMs(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return `${MONTHS_MS[m - 1]} ${y}`;
}

/** "2026-10-05" -> "5 Okt 2026" */
export function formatDateMs(ymd: string): string {
  if (!isValidYmd(ymd)) return ymd;
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const short = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
  return `${d} ${short[m - 1]} ${y}`;
}

export function formatLongDateMs(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  return `${DAYS_MS[d.getUTCDay()]}, ${formatDateMs(ymd)}`;
}

/** Hari dalam minggu, Isnin = 0 ... Ahad = 6 */
export function weekdayMondayFirst(ymd: string): number {
  return (new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function formatDateTimeMs(iso: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ms-MY", {
    timeZone: TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const MONTHS_SHORT = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
/** "2026-10" -> "Okt" */
export function monthShort(month: string): string {
  return MONTHS_SHORT[Number(month.slice(5, 7)) - 1] ?? month;
}

/** Tarikh, masa (HH:MM) dan jam semasa di Malaysia. */
export function nowMYT(now: Date = new Date()): { ymd: string; hm: string; hour: number } {
  const hm = new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  return { ymd: todayMYT(now), hm, hour: Number(hm.slice(0, 2)) };
}
