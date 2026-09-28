import { publicRoute } from "@/lib/server/api";
import { adminDb } from "@/lib/firebase/admin";
import { missingEnv } from "@/lib/server/env";
import { todayMYT } from "@/lib/domain/dates";

/**
 * Semakan kesihatan sistem.
 * Awam: { ok }. Admin (sudah log masuk): butiran env, sambungan Firestore dan versi deploy.
 */
export const GET = publicRoute(async ({ user }) => {
  if (!user || user.role !== "admin") return { ok: true };

  const missing = missingEnv();
  let firestore: { ok: boolean; ms?: number; error?: string } = { ok: false };
  const t0 = Date.now();
  try {
    await adminDb().collection("teams").limit(1).get();
    firestore = { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    firestore = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  return {
    ok: missing.length === 0 && firestore.ok,
    env: { missing },
    firestore,
    todayMYT: todayMYT(),
    serverTime: new Date().toISOString(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    region: process.env.VERCEL_REGION ?? "local",
    node: process.version,
  };
});
