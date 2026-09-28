import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb, FieldValue, toIso } from "../../firebase/admin";
import { canViewOwnerFinance, canViewTeamFinance } from "../../domain/budget";
import { teamMembers } from "./budget";
import {
  canEditCkDetails,
  canEditCkFee,
  canEditPayment,
  checkKolAction,
  checkPaymentAction,
  isOwnerOrAdmin,
  stageAfterPayment,
  type KolAction,
  type PaymentAction,
} from "../../domain/kol";
import { EMPTY_CK_DETAILS, type CampaignKol, type CkDetails, type InKindLine, type KolPayment, type PaymentKind, type SessionUser } from "../../domain/types";
import type { CkAssignInput, CkUpdateInput } from "../../validation";
import { formatSen } from "../../domain/money";
import { AppError } from "../errors";
import { diff, writeAudit } from "../audit";
import { getCampaign } from "./campaigns";
import { getKol } from "./kols";
import { getFileRefForTeam } from "./files";
import { assertInList } from "./master";
import { assertItemsValid, assertOutletsValid } from "./catalog";

/** Snapshot nama & nilai kos item dari Katalog supaya perubahan harga kemudian tidak ubah rekod lama. */
async function buildInKind(lines: { itemId: string; qty: number }[], existing: InKindLine[] = []): Promise<{ inKind: InKindLine[]; inKindSen: number }> {
  const all = await assertItemsValid(lines.map((l) => l.itemId), existing.map((l) => l.itemId), "inKind");
  const inKind = lines.map((l) => {
    const item = all.get(l.itemId);
    const old = existing.find((e) => e.itemId === l.itemId);
    return { itemId: l.itemId, name: item?.name ?? old?.name ?? l.itemId, qty: l.qty, unitCostSen: item?.costSen ?? old?.unitCostSen ?? 0 };
  });
  return { inKind, inKindSen: inKind.reduce((a, l) => a + l.qty * l.unitCostSen, 0) };
}

async function assertCkLists(platform: string, details: CkDetails, before?: { platform: string; details: CkDetails }) {
  await Promise.all([
    assertInList("platforms", [platform], "platform", before ? [before.platform] : []),
    assertOutletsValid([details.outletId], before ? [before.details.outletId] : [], "details.outletId"),
  ]);
}

const cks = () => adminDb().collection("campaign_kols");
const pays = () => adminDb().collection("kol_payments");

/** Bentuk mentah dari database (fee sentiasa ada). */
function rawCk(d: DocumentSnapshot): CampaignKol & { feeSen: number; paidSen: number; requestedSen: number; inKindSen: number } {
  const g = (k: string) => d.get(k);
  return {
    id: d.id,
    campaignId: String(g("campaignId") ?? ""),
    campaignName: String(g("campaignName") ?? ""),
    kolId: String(g("kolId") ?? ""),
    kolName: String(g("kolName") ?? ""),
    kolHandle: String(g("kolHandle") ?? ""),
    platform: g("platform"),
    teamId: String(g("teamId") ?? ""),
    picId: String(g("picId") ?? ""),
    picName: String(g("picName") ?? ""),
    collabType: g("collabType") ?? "Paid post",
    details: { ...EMPTY_CK_DETAILS, ...(g("details") ?? {}) },
    inKind: Array.isArray(g("inKind")) ? g("inKind") : [],
    inKindSen: Number(g("inKindSen") ?? 0),
    feeSen: Number(g("feeSen") ?? 0),
    paidSen: Number(g("paidSen") ?? 0),
    requestedSen: Number(g("requestedSen") ?? 0),
    deliverables: String(g("deliverables") ?? ""),
    postingDueDate: String(g("postingDueDate") ?? ""),
    month: String(g("month") ?? ""),
    stage: g("stage"),
    stageNote: String(g("stageNote") ?? ""),
    checklist: { briefSent: false, productSent: false, contentReceived: false, contentApproved: false, posted: false, ...(g("checklist") ?? {}) },
    postUrl: String(g("postUrl") ?? ""),
    postedDate: String(g("postedDate") ?? ""),
    notes: String(g("notes") ?? ""),
    version: Number(g("version") ?? 1),
    createdAt: toIso(g("createdAt")),
    updatedAt: toIso(g("updatedAt")),
    deleted: g("deleted") === true,
  };
}

/** Sorok fee, bayaran, alamat dan in-kind kecuali Admin dan PIC. Status posting kekal kelihatan. */
export function maskCk(user: SessionUser, ck: CampaignKol): CampaignKol {
  if (canViewOwnerFinance(user, ck.picId)) return ck;
  // Alamat rumah KOL, nilai barang dan kos hanya untuk team yang menguruskan
  return { ...ck, feeSen: null, paidSen: null, requestedSen: null, inKindSen: null, inKind: [], details: { ...EMPTY_CK_DETAILS }, notes: "", stageNote: "" };
}

function toPayment(d: DocumentSnapshot): KolPayment {
  const g = (k: string) => d.get(k);
  return {
    id: d.id,
    campaignKolId: String(g("campaignKolId") ?? ""),
    teamId: String(g("teamId") ?? ""),
    picId: String(g("picId") ?? ""),
    kolId: String(g("kolId") ?? ""),
    kolName: String(g("kolName") ?? ""),
    campaignId: String(g("campaignId") ?? ""),
    campaignName: String(g("campaignName") ?? ""),
    amountSen: Number(g("amountSen") ?? 0),
    kind: g("kind"),
    status: g("status"),
    invoice: g("invoice") ?? null,
    proof: g("proof") ?? null,
    paidDate: String(g("paidDate") ?? ""),
    expenseId: g("expenseId") ?? null,
    notes: String(g("notes") ?? ""),
    version: Number(g("version") ?? 1),
    createdAt: toIso(g("createdAt")),
    deleted: g("deleted") === true,
  };
}

/* ------------------------------ Senarai ------------------------------ */

export async function listCksForCampaign(user: SessionUser, campaignId: string): Promise<CampaignKol[]> {
  const snap = await cks().where("campaignId", "==", campaignId).get();
  return snap.docs.map(rawCk).filter((c) => !c.deleted).map((c) => maskCk(user, c));
}

export async function listCksForKol(user: SessionUser, kolId: string): Promise<CampaignKol[]> {
  const snap = await cks().where("kolId", "==", kolId).get();
  return snap.docs
    .map(rawCk)
    .filter((c) => !c.deleted)
    .map((c) => maskCk(user, c))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

/** Tracker KOL untuk satu team, atau semua (Admin sahaja). */
export async function listCksForScope(user: SessionUser, scope: string): Promise<CampaignKol[]> {
  let docs;
  if (scope === "all") {
    if (user.role !== "admin") throw new AppError("FORBIDDEN");
    docs = (await cks().where("deleted", "==", false).get()).docs;
  } else {
    if (!canViewTeamFinance(user, scope)) throw new AppError("FORBIDDEN");
    docs = (await cks().where("teamId", "==", scope).get()).docs;
  }
  return docs
    .map(rawCk)
    .filter((c) => !c.deleted)
    .map((c) => maskCk(user, c))
    .sort((a, b) => (a.postingDueDate || "9999").localeCompare(b.postingDueDate || "9999"));
}

export async function getCk(user: SessionUser, id: string): Promise<CampaignKol | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const snap = await cks().doc(id).get();
  if (!snap.exists) return null;
  const c = rawCk(snap);
  return c.deleted ? null : maskCk(user, c);
}

export async function listPaymentsForCk(user: SessionUser, ckId: string, picId: string): Promise<KolPayment[]> {
  if (!canViewOwnerFinance(user, picId)) return [];
  const snap = await pays().where("campaignKolId", "==", ckId).get();
  return snap.docs
    .map(toPayment)
    .filter((p) => !p.deleted)
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
}

/** Semua bayaran (termasuk Paid) dalam skop. Admin: semua / satu team. Ahli: hanya bayaran di mana dia PIC. */
export async function listPayments(user: SessionUser, scope: string): Promise<KolPayment[]> {
  let docs;
  if (scope === "all") {
    if (user.role !== "admin") throw new AppError("FORBIDDEN");
    docs = (await pays().where("deleted", "==", false).get()).docs;
  } else {
    if (!canViewTeamFinance(user, scope)) throw new AppError("FORBIDDEN");
    docs = (await pays().where("teamId", "==", scope).get()).docs;
  }
  return docs
    .map(toPayment)
    .filter((p) => !p.deleted && canViewOwnerFinance(user, p.picId))
    .sort((a, b) => (b.paidDate || b.createdAt || "").localeCompare(a.paidDate || a.createdAt || ""));
}

/** Bayaran belum selesai: Admin semua, person hanya miliknya. */
export async function listOpenPayments(user: SessionUser, scope: string): Promise<KolPayment[]> {
  const snap = await pays().where("status", "in", ["Pending", "Processing"]).get();
  return snap.docs
    .map(toPayment)
    .filter((p) => !p.deleted && canViewOwnerFinance(user, p.picId) && (scope === "all" || p.teamId === scope));
}

/* ----------------------------- Tugaskan KOL ----------------------------- */

export async function assignKol(user: SessionUser, input: CkAssignInput, requestId: string) {
  const [campaign, kol] = await Promise.all([getCampaign(input.campaignId), getKol(input.kolId)]);
  if (!campaign) throw new AppError("NOT_FOUND", "Campaign tidak dijumpai.");
  if (!kol) throw new AppError("VALIDATION", undefined, { fields: { kolId: "KOL tidak dijumpai." } });
  if (!isOwnerOrAdmin(user, campaign.teamId)) throw new AppError("FORBIDDEN", "Hanya team pemilik campaign boleh tambah KOL.");
  if (campaign.status === "Completed" || campaign.status === "Cancelled") throw new AppError("INVALID_TRANSITION", `Campaign sudah ${campaign.status}.`);
  if (kol.status === "Blacklist") throw new AppError("VALIDATION", undefined, { fields: { kolId: "KOL ini disenarai hitam." } });

  const existing = await cks().where("campaignId", "==", campaign.id).get();
  if (existing.docs.some((d) => d.get("kolId") === kol.id && d.get("deleted") !== true && d.get("stage") !== "Dropped")) {
    throw new AppError("VALIDATION", undefined, { fields: { kolId: "KOL ini sudah ada dalam campaign ini." } });
  }

  await assertCkLists(input.platform, input.details);
  // PIC: ahli sentiasa diri sendiri; Admin mesti pilih ahli team campaign
  const picId = user.role === "admin" ? input.picId ?? "" : user.id;
  const pic = (await teamMembers(campaign.teamId)).find((m) => m.id === picId);
  if (!pic) throw new AppError("VALIDATION", undefined, { fields: { picId: "Pilih PIC dari ahli team campaign ini." } });
  const { inKind, inKindSen } = await buildInKind(input.inKind);
  const acc = kol.accounts.find((a) => a.platform === input.platform) ?? kol.accounts[0];
  const ref = cks().doc();
  const batch = adminDb().batch();
  batch.set(ref, {
    campaignId: campaign.id,
    campaignName: campaign.name,
    kolId: kol.id,
    kolName: kol.name,
    kolHandle: acc ? `@${acc.username}` : "",
    platform: input.platform,
    teamId: campaign.teamId,
    picId: pic.id,
    picName: pic.name,
    collabType: input.collabType,
    details: input.details,
    inKind,
    inKindSen,
    feeSen: input.fee,
    paidSen: 0,
    requestedSen: 0,
    deliverables: input.deliverables,
    postingDueDate: input.postingDueDate,
    month: (input.postingDueDate || campaign.startDate).slice(0, 7),
    stage: "Selected",
    stageNote: "",
    checklist: { briefSent: false, productSent: false, contentReceived: false, contentApproved: false, posted: false },
    postUrl: "",
    postedDate: "",
    notes: input.notes,
    version: 1,
    deleted: false,
    createdBy: user.id,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  writeAudit(batch, {
    actor: { kind: "user", user },
    action: "assign",
    entity: "campaign_kol",
    entityId: ref.id,
    teamId: campaign.teamId,
    to: "Selected",
    note: `${kol.name} ditambah ke ${campaign.name} (${input.collabType}), fee ${formatSen(input.fee)}${inKindSen ? `, in-kind ${formatSen(inKindSen)}` : ""}`,
    requestId,
  });
  await batch.commit();
  return { id: ref.id };
}

export async function updateCk(user: SessionUser, id: string, version: number, input: CkUpdateInput, requestId: string) {
  const ref = cks().doc(id);
  const pre = await ref.get();
  if (!pre.exists) throw new AppError("NOT_FOUND", "Rekod KOL tidak dijumpai.");
  const current = rawCk(pre);
  await assertCkLists(input.platform, input.details, current);
  // Hanya Admin boleh tukar PIC, dan hanya sebelum ada permintaan bayaran
  let pic = { id: current.picId, name: current.picName };
  if (input.picId && input.picId !== current.picId) {
    if (user.role !== "admin") throw new AppError("FORBIDDEN", "Hanya Admin boleh tukar PIC.");
    if (current.requestedSen > 0) throw new AppError("VALIDATION", undefined, { fields: { picId: "PIC tidak boleh ditukar selepas ada permintaan bayaran." } });
    const m = (await teamMembers(current.teamId)).find((x) => x.id === input.picId);
    if (!m) throw new AppError("VALIDATION", undefined, { fields: { picId: "PIC mesti ahli team." } });
    pic = m;
  }
  const { inKind, inKindSen } = await buildInKind(input.inKind, current.inKind);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError("NOT_FOUND", "Rekod KOL tidak dijumpai.");
    const before = rawCk(snap);
    if (before.version !== version) throw new AppError("CONFLICT");
    if (!canEditCkDetails(user, before)) throw new AppError("FORBIDDEN", "Butiran tidak boleh diubah pada status ini.");
    if (input.fee !== before.feeSen) {
      if (!canEditCkFee(user, before)) throw new AppError("FORBIDDEN", "Fee dikunci selepas Confirmed. Minta Admin ubah.");
      if (input.fee < before.requestedSen) throw new AppError("VALIDATION", undefined, { fields: { fee: `Fee tidak boleh kurang dari bayaran yang sudah diminta (${formatSen(before.requestedSen)}).` } });
    }
    const next = {
      picId: pic.id,
      picName: pic.name,
      platform: input.platform,
      collabType: input.collabType,
      details: input.details,
      inKind,
      inKindSen,
      feeSen: input.fee,
      deliverables: input.deliverables,
      postingDueDate: input.postingDueDate,
      month: input.postingDueDate ? input.postingDueDate.slice(0, 7) : before.month,
      notes: input.notes,
    };
    const changes = diff(before as unknown as Record<string, unknown>, next);
    if (!changes) return { id };
    tx.update(ref, { ...next, version: before.version + 1, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, { actor: { kind: "user", user }, action: "update", entity: "campaign_kol", entityId: id, teamId: before.teamId, changes, requestId });
    return { id };
  });
}

export async function ckAction(
  user: SessionUser,
  id: string,
  action: KolAction,
  extra: { note: string; postUrl: string; postedDate: string },
  version: number,
  requestId: string,
) {
  const ref = cks().doc(id);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError("NOT_FOUND", "Rekod KOL tidak dijumpai.");
    const ck = rawCk(snap);
    if (ck.version !== version) throw new AppError("CONFLICT");
    const r = checkKolAction(user, ck, action, extra);
    if (!r.ok) throw new AppError(r.code, r.message, r.code === "VALIDATION" ? { fields: { _: r.message } } : {});

    const update: Record<string, unknown> = {
      checklist: { ...ck.checklist, ...r.checklist },
      version: ck.version + 1,
      updatedAt: FieldValue.serverTimestamp(),
      stageNote: extra.note.trim(),
    };
    let to = r.to ?? ck.stage;

    if (action === "posted") {
      update.postUrl = extra.postUrl;
      update.postedDate = extra.postedDate;
      // Auto cipta permintaan bayaran untuk baki fee
      const remaining = ck.feeSen - ck.requestedSen;
      if (remaining > 0) {
        const payRef = pays().doc();
        tx.set(payRef, {
          campaignKolId: id,
          teamId: ck.teamId,
          picId: ck.picId,
          kolId: ck.kolId,
          kolName: ck.kolName,
          campaignId: ck.campaignId,
          campaignName: ck.campaignName,
          amountSen: remaining,
          kind: ck.requestedSen === 0 ? "Penuh" : "Baki",
          status: "Pending",
          invoice: null,
          proof: null,
          paidDate: "",
          expenseId: null,
          notes: "Dicipta automatik selepas posting.",
          version: 1,
          deleted: false,
          createdBy: user.id,
          createdAt: FieldValue.serverTimestamp(),
        });
        update.requestedSen = ck.requestedSen + remaining;
        writeAudit(tx, {
          actor: { kind: "system" },
          action: "payment_create",
          entity: "kol_payment",
          entityId: id,
          teamId: ck.teamId,
          to: "Pending",
          note: `Bayaran ${formatSen(remaining)} dicipta automatik (${payRef.id})`,
          requestId,
        });
      }
      to = stageAfterPayment(ck.feeSen, ck.paidSen);
    }
    update.stage = to;
    tx.update(ref, update);
    writeAudit(tx, {
      actor: { kind: "user", user },
      action,
      entity: "campaign_kol",
      entityId: id,
      teamId: ck.teamId,
      from: ck.stage,
      to,
      note: [extra.note.trim(), action === "posted" ? extra.postUrl : ""].filter(Boolean).join(" "),
      requestId,
    });
    return { id, stage: to };
  });
}

/* ------------------------------- Bayaran ------------------------------- */

const PAYABLE_STAGES = ["Confirmed", "Content Brief Sent", "Content Submitted", "Approved", "Payment Pending"];

export async function createPayment(
  user: SessionUser,
  input: { campaignKolId: string; amount: number; kind: PaymentKind; invoiceFileId: string | null; notes: string },
  requestId: string,
) {
  const ckRef = cks().doc(input.campaignKolId);
  const pre = await ckRef.get();
  if (!pre.exists) throw new AppError("NOT_FOUND", "Rekod KOL tidak dijumpai.");
  const teamId = String(pre.get("teamId"));
  const picId = String(pre.get("picId") ?? "");
  if (!canViewOwnerFinance(user, picId)) throw new AppError("NOT_FOUND", "Rekod KOL tidak dijumpai.");
  const invoice = await getFileRefForTeam(input.invoiceFileId, teamId, picId);

  return adminDb().runTransaction(async (tx) => {
    const ck = rawCk(await tx.get(ckRef));
    if (!PAYABLE_STAGES.includes(ck.stage)) throw new AppError("INVALID_TRANSITION", "Bayaran hanya boleh diminta selepas KOL Confirmed.");
    if (ck.requestedSen + input.amount > ck.feeSen) {
      throw new AppError("VALIDATION", undefined, { fields: { amount: `Melebihi baki fee (${formatSen(ck.feeSen - ck.requestedSen)}).` } });
    }
    const ref = pays().doc();
    tx.set(ref, {
      campaignKolId: ck.id,
      teamId,
      picId,
      kolId: ck.kolId,
      kolName: ck.kolName,
      campaignId: ck.campaignId,
      campaignName: ck.campaignName,
      amountSen: input.amount,
      kind: input.kind,
      status: "Pending",
      invoice,
      proof: null,
      paidDate: "",
      expenseId: null,
      notes: input.notes,
      version: 1,
      deleted: false,
      createdBy: user.id,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(ckRef, { requestedSen: ck.requestedSen + input.amount, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, { actor: { kind: "user", user }, action: "payment_create", entity: "kol_payment", entityId: ck.id, teamId, to: "Pending", note: `${input.kind} ${formatSen(input.amount)} (${ref.id})`, requestId });
    return { id: ref.id };
  });
}

export async function updatePayment(
  user: SessionUser,
  id: string,
  version: number,
  input: { amount: number; kind: PaymentKind; invoiceFileId: string | null; notes: string },
  requestId: string,
) {
  const ref = pays().doc(id);
  const pre = await ref.get();
  if (!pre.exists) throw new AppError("NOT_FOUND", "Bayaran tidak dijumpai.");
  const teamId = String(pre.get("teamId"));
  const picId = String(pre.get("picId") ?? "");
  if (!canViewOwnerFinance(user, picId)) throw new AppError("NOT_FOUND", "Bayaran tidak dijumpai.");
  const invoice = await getFileRefForTeam(input.invoiceFileId, teamId, picId);

  return adminDb().runTransaction(async (tx) => {
    const p = toPayment(await tx.get(ref));
    if (p.version !== version) throw new AppError("CONFLICT");
    if (!canEditPayment(user, p)) throw new AppError("FORBIDDEN", "Bayaran hanya boleh diubah semasa Pending.");
    const ckRef = cks().doc(p.campaignKolId);
    const ck = rawCk(await tx.get(ckRef));
    const requested = ck.requestedSen - p.amountSen + input.amount;
    if (requested > ck.feeSen) throw new AppError("VALIDATION", undefined, { fields: { amount: `Melebihi baki fee (${formatSen(ck.feeSen - ck.requestedSen + p.amountSen)}).` } });
    const next = { amountSen: input.amount, kind: input.kind, invoice, notes: input.notes };
    const changes = diff(p as unknown as Record<string, unknown>, next);
    if (!changes) return { id };
    tx.update(ref, { ...next, version: p.version + 1 });
    tx.update(ckRef, { requestedSen: requested, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, { actor: { kind: "user", user }, action: "payment_update", entity: "kol_payment", entityId: p.campaignKolId, teamId, changes, note: id, requestId });
    return { id };
  });
}

export async function paymentAction(
  user: SessionUser,
  id: string,
  action: PaymentAction,
  extra: { proofFileId: string | null; paidDate: string; note: string },
  version: number,
  requestId: string,
) {
  const ref = pays().doc(id);
  const pre = await ref.get();
  if (!pre.exists) throw new AppError("NOT_FOUND", "Bayaran tidak dijumpai.");
  const teamId = String(pre.get("teamId"));
  const picId = String(pre.get("picId") ?? "");
  const proof = action === "pay" ? await getFileRefForTeam(extra.proofFileId, teamId, picId) : null;

  return adminDb().runTransaction(async (tx) => {
    const p = toPayment(await tx.get(ref));
    if (p.version !== version) throw new AppError("CONFLICT");
    const r = checkPaymentAction(user, p, action, extra);
    if (!r.ok) throw new AppError(r.code, r.message, r.code === "VALIDATION" ? { fields: { _: r.message } } : {});
    const ckRef = cks().doc(p.campaignKolId);
    const ck = rawCk(await tx.get(ckRef));

    if (r.to === "Processing") {
      tx.update(ref, { status: "Processing", version: p.version + 1 });
    } else if (r.to === "cancelled") {
      tx.update(ref, { deleted: true, cancelNote: extra.note.trim(), version: p.version + 1 });
      tx.update(ckRef, { requestedSen: Math.max(0, ck.requestedSen - p.amountSen), updatedAt: FieldValue.serverTimestamp() });
    } else {
      // Paid: cipta perbelanjaan Selesai dalam bajet team (tidak perlu rekod dua kali)
      const expRef = adminDb().collection("expenses").doc();
      tx.set(expRef, {
        teamId,
        month: extra.paidDate.slice(0, 7),
        date: extra.paidDate,
        campaignId: p.campaignId,
        campaignName: p.campaignName,
        category: "KOL",
        description: `Bayaran KOL ${p.kolName} (${p.kind})`,
        amountSen: p.amountSen,
        vendor: p.kolName,
        ownerId: picId,
        ownerName: ck.picName,
        paymentMethod: "Pindahan bank",
        campaignKolId: ck.id,
        receipt: proof,
        remark: "",
        status: "Selesai",
        statusNote: "Dijana automatik dari KOL Payment.",
        kolPaymentId: id,
        overBudget: false,
        version: 1,
        deleted: false,
        createdBy: user.id,
        createdByName: user.name,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(ref, { status: "Paid", proof, paidDate: extra.paidDate, expenseId: expRef.id, version: p.version + 1 });
      const paidSen = ck.paidSen + p.amountSen;
      const ckUpdate: Record<string, unknown> = { paidSen, updatedAt: FieldValue.serverTimestamp(), version: ck.version + 1 };
      if (ck.stage === "Payment Pending" && stageAfterPayment(ck.feeSen, paidSen) === "Paid") {
        ckUpdate.stage = "Paid";
        writeAudit(tx, { actor: { kind: "system" }, action: "paid", entity: "campaign_kol", entityId: ck.id, teamId, from: ck.stage, to: "Paid", note: "Semua bayaran selesai.", requestId });
      }
      tx.update(ckRef, ckUpdate);
      writeAudit(tx, { actor: { kind: "system" }, action: "create", entity: "expense", entityId: expRef.id, teamId, to: "Selesai", note: `Dari bayaran KOL ${id}`, requestId });
    }
    writeAudit(tx, {
      actor: { kind: "user", user },
      action: `payment_${action}`,
      entity: "kol_payment",
      entityId: p.campaignKolId,
      teamId,
      from: p.status,
      to: r.to,
      note: `${formatSen(p.amountSen)} (${id}) ${extra.note}`.trim(),
      requestId,
    });
    return { id, status: r.to };
  });
}
