import { describe, expect, it } from "vitest";
import { formatSen, parseRmToSen, senToInput } from "@/lib/domain/money";
import { addDays, isValidYmd, monthRange, rangesOverlap, todayMYT, weekdayMondayFirst } from "@/lib/domain/dates";
import { resolveActiveTeam } from "@/lib/domain/session";

describe("wang", () => {
  it("tukar RM ke sen tanpa ralat perpuluhan", () => {
    expect(parseRmToSen("1500")).toBe(150000);
    expect(parseRmToSen("1,500.5")).toBe(150050);
    expect(parseRmToSen("RM 0.10")).toBe(10);
    expect(parseRmToSen("")).toBe(0);
    expect(parseRmToSen("-5")).toBeNull();
    expect(parseRmToSen("1.234")).toBeNull();
    expect(parseRmToSen("abc")).toBeNull();
  });
  it("format", () => {
    expect(formatSen(150000)).toBe("RM 1,500");
    expect(formatSen(150050)).toBe("RM 1,500.50");
    expect(senToInput(150050)).toBe("1500.50");
  });
});

describe("tarikh", () => {
  it("zon masa Malaysia", () => {
    // 2026-10-04 17:00 UTC = 2026-10-05 01:00 MYT
    expect(todayMYT(new Date("2026-10-04T17:00:00Z"))).toBe("2026-10-05");
  });
  it("sah dan kira", () => {
    expect(isValidYmd("2026-02-29")).toBe(false);
    expect(isValidYmd("2028-02-29")).toBe(true);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(monthRange("2026-02").to).toBe("2026-02-28");
    expect(rangesOverlap("2026-10-01", "2026-10-05", "2026-10-05", "2026-10-09")).toBe(true);
    expect(weekdayMondayFirst("2026-10-05")).toBe(0); // Isnin
  });
});

describe("sesi aktif", () => {
  it("admin lalai semua team", () => {
    expect(resolveActiveTeam({ role: "admin", teamIds: [] }, undefined, ["team-a"])).toBe("all");
    expect(resolveActiveTeam({ role: "admin", teamIds: [] }, "team-a", ["team-a"])).toBe("team-a");
    expect(resolveActiveTeam({ role: "admin", teamIds: [] }, "hilang", ["team-a"])).toBe("all");
  });
  it("ahli tidak boleh pilih team orang lain", () => {
    expect(resolveActiveTeam({ role: "member", teamIds: ["team-a", "team-b"] }, "team-b", [])).toBe("team-b");
    expect(resolveActiveTeam({ role: "member", teamIds: ["team-a"] }, "team-c", [])).toBe("team-a");
    expect(resolveActiveTeam({ role: "member", teamIds: [] }, "all", [])).toBeNull();
  });
});
