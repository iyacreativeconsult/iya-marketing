import { NextResponse } from "next/server";
import { z } from "zod";
import { publicRoute, readJson } from "@/lib/server/api";
import { AppError } from "@/lib/server/errors";
import { cookieBase, TEAM_COOKIE } from "@/lib/server/session";
import { getUserById } from "@/lib/server/services/users";
import { DEMO_USER_COOKIE, isDemo } from "@/lib/demo-mode";

/** Mod Demo sahaja: tukar pengguna aktif. Di luar Mod Demo, endpoint ini tidak wujud. */
export const POST = publicRoute(async ({ req, requestId }) => {
  if (!isDemo()) throw new AppError("NOT_FOUND");
  const { userId } = await readJson(req, z.object({ userId: z.string().min(1).max(64) }));
  if (!(await getUserById(userId))) throw new AppError("NOT_FOUND", "Pengguna demo tidak dijumpai.");
  const res = NextResponse.json({ ok: true, data: { userId }, requestId });
  res.cookies.set(DEMO_USER_COOKIE, userId, { ...cookieBase(), maxAge: 60 * 60 * 24 });
  res.cookies.set(TEAM_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  return res;
});
