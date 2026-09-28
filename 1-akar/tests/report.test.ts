import { describe, expect, it } from "vitest";
import { compactNum, dueCheckpoints, engagementOf, kpi, latestSnapshot, periodRange, sumMetrics, ZERO } from "@/lib/domain/report";
import { perfInputSchema } from "@/lib/validation";

const m = { ...ZERO, views: 10_000, likes: 800, comments: 50, shares: 100, saves: 50, orders: 20, salesSen: 200_000 };

describe("KPI", () => {
  it("engagement, ER, CPM, CPE, ROAS", () => {
    expect(engagementOf(m)).toBe(1000);
    const k = kpi(m, 50_000); // kos RM500
    expect(k.er).toBe(10);
    expect(k.cpmSen).toBe(5000); // RM50 per 1,000 views
    expect(k.cpeSen).toBe(50); // RM0.50 per engagement
    expect(k.roas).toBe(4);
  });
  it("tiada kos / tiada views -> null, bukan Infinity", () => {
    const k = kpi({ ...ZERO }, null);
    expect(k.er).toBeNull();
    expect(k.cpmSen).toBeNull();
    expect(k.roas).toBeNull();
    expect(kpi(m, 0).cpmSen).toBeNull();
  });
  it("snapshot terkini dan jumlah", () => {
    expect(latestSnapshot([{ day: 1 }, { day: 30 }, { day: 7 }])?.day).toBe(30);
    expect(latestSnapshot([])).toBeNull();
    expect(sumMetrics([m, m]).views).toBe(20_000);
  });
});

describe("titik semakan dan tempoh", () => {
  it("hanya yang sudah tiba dan belum diisi", () => {
    expect(dueCheckpoints("2026-09-01", [], "2026-09-05")).toEqual([1]);
    expect(dueCheckpoints("2026-09-01", [1], "2026-09-10")).toEqual([7]);
    expect(dueCheckpoints("2026-09-01", [1, 7, 30], "2026-12-01")).toEqual([]);
    expect(dueCheckpoints("", [], "2026-12-01")).toEqual([]);
  });
  it("julat bulan / suku / tahun", () => {
    expect(periodRange("month", "2026-02")).toMatchObject({ from: "2026-02-01", to: "2026-02-28", prev: "2026-01", next: "2026-03" });
    expect(periodRange("quarter", "2026-08")).toMatchObject({ from: "2026-07-01", to: "2026-09-30", label: "S3 2026", next: "2026-10" });
    expect(periodRange("year", "2026-08")).toMatchObject({ from: "2026-01-01", to: "2026-12-31", label: "2026" });
  });
  it("format ringkas dan input", () => {
    expect(compactNum(45_200)).toBe("45.2K");
    expect(compactNum(1_250_000)).toBe("1.3M");
    expect(perfInputSchema.safeParse({ targetType: "content", targetId: "a", day: 7, views: -1 }).success).toBe(false);
    expect(perfInputSchema.safeParse({ targetType: "content", targetId: "a", day: 14 }).success).toBe(false);
    expect(perfInputSchema.parse({ targetType: "kol", targetId: "a", day: 30, sales: "1,200.50" }).sales).toBe(120050);
  });
});
