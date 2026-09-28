import "server-only";

/**
 * Log berstruktur (JSON satu baris). Dalam Vercel: Project > Logs, cari ikut
 * requestId. Di localhost: terus nampak dalam terminal `npm run dev`.
 */
type Level = "info" | "warn" | "error";

export function log(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/**
 * Simpan ralat server dalam Firestore (koleksi error_logs) supaya Admin boleh
 * lihat di halaman Log Sistem tanpa buka Vercel. Tidak pernah melempar ralat.
 */
export async function persistError(entry: {
  requestId: string;
  code: string;
  message: string;
  route: string;
  method: string;
  userId: string | null;
  stack?: string;
}): Promise<void> {
  try {
    const { adminDb, FieldValue } = await import("../firebase/admin");
    await adminDb()
      .collection("error_logs")
      .add({ ...entry, stack: (entry.stack ?? "").slice(0, 4000), at: FieldValue.serverTimestamp() });
  } catch (e) {
    log("warn", "persistError gagal", { requestId: entry.requestId, err: String(e) });
  }
}
