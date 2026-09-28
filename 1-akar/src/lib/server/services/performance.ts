import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb, FieldValue, toIso } from "../../firebase/admin";
import type { PerfDay, PerfSnapshot, PerfTarget, SessionUser } from "../../domain/types";
import type { PerfInput } from "../../validation";
import { AppError } from "../errors";
import { diff, writeAudit } from "../audit";
import { getContent } from "./content";

/** Prestasi posting (content & KOL) pada hari ke-1, ke-7 dan ke-30. Satu dokumen setiap titik semakan. */

const col = () => adminDb().collection("performance");
const docId = (t: PerfTarget, id: string, day: PerfDay) => `${t}_${id}_d${day}`;

function toSnap(d: DocumentSnapshot): PerfSnapshot {
  const n = (k: string) => Number(d.get(k) ?? 0);
  return {
    id: d.id,
    targetType: d.get("targetType"),
    targetId: String(d.get("targetId") ?? ""),
    teamId: String(d.get("teamId") ?? ""),
    day: n("day") as PerfDay,
    views: n("views"),
    likes: n("likes"),
    comments: n("comments"),
    shares: n("shares"),
    saves: n("saves"),
    clicks: n("clicks"),
    orders: n("orders"),
    salesSen: n("salesSen"),
    note: String(d.get("note") ?? ""),
    recordedAt: toIso(d.get("recordedAt")),
    recordedByName: String(d.get("recordedByName") ?? ""),
  };
}

export async function listPerformanceFor(targetType: PerfTarget, targetId: string): Promise<PerfSnapshot[]> {
  const snap = await col().where("targetId", "==", targetId).get();
  return snap.docs.map(toSnap).filter((s) => s.targetType === targetType).sort((a, b) => a.day - b.day);
}

/** Semua snapshot dalam skop ("all" = Admin, atau satu team). */
export async function listPerformance(scope: string): Promise<PerfSnapshot[]> {
  const snap = scope === "all" ? await col().get() : await col().where("teamId", "==", scope).get();
  return snap.docs.map(toSnap);
}

/** Sasaran mesti sudah published/posting, dan pengguna ahli team sasaran (atau Admin). */
async function resolveTarget(user: SessionUser, t: PerfTarget, id: string): Promise<{ teamId: string; baseDate: string; name: string }> {
  if (t === "content") {
    const c = await getContent(id);
    if (!c) throw new AppError("NOT_FOUND", "Content tidak dijumpai.");
    if (c.status !== "Published" && c.status !== "Archived") throw new AppError("INVALID_TRANSITION", "Prestasi hanya boleh diisi selepas content published.");
    if (user.role !== "admin" && !user.teamIds.includes(c.teamId)) throw new AppError("FORBIDDEN", "Anda bukan ahli team content ini.");
    return { teamId: c.teamId, baseDate: c.publishDate, name: c.title };
  }
  const snap = await adminDb().collection("campaign_kols").doc(id).get();
  if (!snap.exists || snap.get("deleted") === true) throw new AppError("NOT_FOUND", "Rekod KOL tidak dijumpai.");
  const teamId = String(snap.get("teamId"));
  if (!(snap.get("checklist")?.posted === true)) throw new AppError("INVALID_TRANSITION", "Prestasi hanya boleh diisi selepas KOL posting.");
  if (user.role !== "admin" && !user.teamIds.includes(teamId)) throw new AppError("FORBIDDEN", "Anda bukan ahli team KOL ini.");
  return { teamId, baseDate: String(snap.get("postedDate") ?? ""), name: `${snap.get("kolName")} (${snap.get("campaignName")})` };
}

export async function recordPerformance(user: SessionUser, input: PerfInput, requestId: string) {
  const target = await resolveTarget(user, input.targetType, input.targetId);
  const ref = col().doc(docId(input.targetType, input.targetId, input.day));
  const metrics = {
    views: input.views,
    likes: input.likes,
    comments: input.comments,
    shares: input.shares,
    saves: input.saves,
    clicks: input.clicks,
    orders: input.orders,
    salesSen: input.sales,
  };
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const before = snap.exists ? toSnap(snap) : null;
    const changes = before ? diff(before as unknown as Record<string, unknown>, { ...metrics, note: input.note }) : null;
    if (before && !changes) return;
    tx.set(ref, {
      targetType: input.targetType,
      targetId: input.targetId,
      teamId: target.teamId,
      day: input.day,
      ...metrics,
      note: input.note,
      recordedAt: FieldValue.serverTimestamp(),
      recordedBy: user.id,
      recordedByName: user.name,
    });
    writeAudit(tx, {
      actor: { kind: "user", user },
      action: "perf_record",
      entity: input.targetType === "content" ? "content" : "campaign_kol",
      entityId: input.targetId,
      teamId: target.teamId,
      note: `Prestasi hari ke-${input.day}: ${input.views.toLocaleString("en-MY")} views`,
      changes,
      requestId,
    });
  });
  return { id: ref.id };
}
