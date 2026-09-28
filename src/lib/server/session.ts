import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "../firebase/admin";
import { resolveActiveTeam } from "../domain/session";
import type { SessionUser } from "../domain/types";
import { AppError, isAppError } from "./errors";
import { getUserById } from "./services/users";
import { listTeams } from "./services/teams";
import { log } from "./logger";
import { DEMO_DEFAULT_USER, DEMO_USER_COOKIE, isDemo } from "../demo-mode";

export const SESSION_COOKIE = "__session";
export const TEAM_COOKIE = "active_team";

export function cookieBase() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
  };
}

/**
 * Pengguna semasa dari cookie sesi. Disahkan dengan Firebase setiap permintaan
 * (termasuk semak token yang telah dibatalkan) dan profil dibaca terus dari
 * Firestore, jadi bila Admin nyahaktif akaun, kesannya serta-merta.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();

  if (isDemo()) {
    // Mod Demo: tiada log masuk, pengguna dipilih dari bar Demo
    const uid = jar.get(DEMO_USER_COOKIE)?.value ?? DEMO_DEFAULT_USER;
    const user = (await getUserById(uid)) ?? (await getUserById(DEMO_DEFAULT_USER));
    if (!user) return null;
    const teams = await listTeams();
    return { ...user, activeTeamId: resolveActiveTeam(user, jar.get(TEAM_COOKIE)?.value, teams.map((t) => t.id)) };
  }

  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let uid: string;
  try {
    uid = (await adminAuth().verifySessionCookie(token, true)).uid;
  } catch (e) {
    if (isAppError(e)) throw e; // env tidak lengkap: biar ia kelihatan
    log("info", "sesi tidak sah", { reason: (e as { code?: string }).code ?? String(e) });
    return null;
  }

  const user = await getUserById(uid);
  if (!user || !user.active) return null;

  const teams = await listTeams();
  const activeTeamId = resolveActiveTeam(user, jar.get(TEAM_COOKIE)?.value, teams.map((t) => t.id));
  return { ...user, activeTeamId };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AppError("UNAUTHENTICATED");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new AppError("FORBIDDEN");
  return user;
}

/** Untuk halaman (server component): hantar ke /login jika tiada sesi. */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePageAdmin(): Promise<SessionUser> {
  const user = await requirePageUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
