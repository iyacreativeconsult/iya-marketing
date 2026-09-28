import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { publicRoute, readJson } from "@/lib/server/api";
import { AppError } from "@/lib/server/errors";
import { cookieBase, SESSION_COOKIE, TEAM_COOKIE } from "@/lib/server/session";
import { getUserById, markLogin } from "@/lib/server/services/users";
import { writeAudit } from "@/lib/server/audit";
import { sessionLoginSchema } from "@/lib/validation";
import { SESSION_DAYS } from "@/lib/config";

/** Log masuk: tukar Firebase ID token kepada cookie sesi httpOnly. */
export const POST = publicRoute(async ({ req, requestId }) => {
  const { idToken } = await readJson(req, sessionLoginSchema);

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(idToken, true);
  } catch {
    throw new AppError("UNAUTHENTICATED", "Log masuk gagal. Sila cuba lagi.");
  }
  // Hanya terima token yang baru dikeluarkan (elak token lama dicuri diguna semula)
  if (Date.now() / 1000 - decoded.auth_time > 5 * 60) {
    throw new AppError("UNAUTHENTICATED", "Sila log masuk semula.");
  }

  const user = await getUserById(decoded.uid);
  if (!user) throw new AppError("FORBIDDEN", "Akaun ini belum didaftarkan dalam sistem. Hubungi Admin.");
  if (!user.active) throw new AppError("FORBIDDEN", "Akaun ini tidak aktif. Hubungi Admin.");

  const expiresIn = SESSION_DAYS * 24 * 60 * 60 * 1000;
  const sessionCookie = await adminAuth().createSessionCookie(idToken, { expiresIn });

  await markLogin(user.id);
  const batch = adminDb().batch();
  writeAudit(batch, { actor: { kind: "user", user }, action: "login", entity: "user", entityId: user.id, requestId });
  await batch.commit();

  const res = NextResponse.json({ ok: true, data: { name: user.name }, requestId });
  res.cookies.set(SESSION_COOKIE, sessionCookie, { ...cookieBase(), maxAge: expiresIn / 1000 });
  return res;
});

/** Log keluar: batalkan semua sesi pengguna ini dan padam cookie. */
export const DELETE = publicRoute(async ({ user, requestId }) => {
  if (user) {
    await adminAuth().revokeRefreshTokens(user.id);
    const batch = adminDb().batch();
    writeAudit(batch, { actor: { kind: "user", user }, action: "logout", entity: "user", entityId: user.id, requestId });
    await batch.commit();
  }
  const res = NextResponse.json({ ok: true, data: null, requestId });
  res.cookies.set(SESSION_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  res.cookies.set(TEAM_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  return res;
});
