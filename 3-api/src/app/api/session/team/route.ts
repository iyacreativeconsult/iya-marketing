import { NextResponse } from "next/server";
import { readJson, userRoute } from "@/lib/server/api";
import { AppError } from "@/lib/server/errors";
import { cookieBase, TEAM_COOKIE } from "@/lib/server/session";
import { listTeams } from "@/lib/server/services/teams";
import { activeTeamSchema } from "@/lib/validation";

/** Tukar "Sesi Aktif". Hanya menukar skop paparan; kebenaran tetap disemak setiap tindakan. */
export const POST = userRoute(async ({ req, user, requestId }) => {
  const { teamId } = await readJson(req, activeTeamSchema);

  if (teamId === "all") {
    if (user.role !== "admin") throw new AppError("FORBIDDEN", "Hanya Admin boleh lihat semua team.");
  } else if (user.role === "admin") {
    const teams = await listTeams();
    if (!teams.some((t) => t.id === teamId)) throw new AppError("NOT_FOUND", "Team tidak dijumpai.");
  } else if (!user.teamIds.includes(teamId)) {
    throw new AppError("FORBIDDEN", "Anda bukan ahli team ini.");
  }

  const res = NextResponse.json({ ok: true, data: { teamId }, requestId });
  res.cookies.set(TEAM_COOKIE, teamId, { ...cookieBase(), maxAge: 60 * 60 * 24 * 365 });
  return res;
});
