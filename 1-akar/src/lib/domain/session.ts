import type { AppUser } from "./types";

/**
 * Tentukan team sesi aktif dari cookie.
 * - Admin: "all" (lalai) atau mana-mana team.
 * - Ahli: mesti salah satu team sendiri; jika cookie tidak sah, guna team pertama.
 */
export function resolveActiveTeam(
  user: Pick<AppUser, "role" | "teamIds">,
  cookieValue: string | undefined,
  existingTeamIds: string[],
): string | null {
  if (user.role === "admin") {
    if (!cookieValue || cookieValue === "all") return "all";
    return existingTeamIds.includes(cookieValue) ? cookieValue : "all";
  }
  if (cookieValue && user.teamIds.includes(cookieValue)) return cookieValue;
  return user.teamIds[0] ?? null;
}
