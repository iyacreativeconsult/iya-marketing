import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb, FieldValue, toIso } from "../../firebase/admin";
import {
  byChannel,
  canDeleteExpense,
  canEditExpense,
  canViewOwnerFinance,
  checkExpenseReview,
  checkTopUpReview,
  personTotal,
  suggestCarryForward,
  summarize,
  type BudgetSummary,
  type ChannelRow,
  type ReviewAction,
} from "../../domain/budget";
import { committedSen } from "../../domain/kol";
import { shiftMonth } from "../../domain/dates";
import { formatSen } from "../../domain/money";
import type { Campaign, Expense, PersonBudget, SessionUser, Team, TopUpRequest } from "../../domain/types";
import type { ExpenseInput } from "../../validation";
import { AppError } from "../errors";
import { diff, writeAudit } from "../audit";
import { getFileRefForTeam } from "./files";
import { getCampaign } from "./campaigns";
import { listTeams } from "./teams";
import { assertInList } from "./master";
import { listUsers } from "./users";

/*
 * Model bajet:
 *  - Bajet ditetapkan untuk setiap PERSON dalam setiap TEAM setiap BULAN
 *    (asas + carry forward + tambahan diluluskan).
 *  - Bajet team = jumlah bajet semua person dalam team itu.
 *  - Perbelanjaan ditolak dari bajet person pemiliknya (ownerId). Tiada rentas bajet.
 *  - Person hanya nampak bajet sendiri. Admin nampak semua.
 */

const personBudgets = () => adminDb().collection("person_budgets");
const teamSettings = () => adminDb().collection("budget_periods"); // pecahan saluran team
const expenses = () => adminDb().collection("expenses");
const requests = () => adminDb().collection("budget_requests");
const pbId = (teamId: string, userId: string, month: string) => `${teamId}_${userId}_${month}`;
const key = (teamId: string, userId: string) => `${teamId}|${userId}`;

export function toExpense(d: DocumentSnapshot): Expense {
  const g = (k: string) => d.get(k);
  return {
    id: d.id,
    teamId: String(g("teamId") ?? ""),
    month: String(g("month") ?? ""),
    date: String(g("date") ?? ""),
    campaignId: g("campaignId") ?? null,
    campaignName: String(g("campaignName") ?? ""),
    category: g("category"),
    description: String(g("description") ?? ""),
    amountSen: Number(g("amountSen") ?? 0),
    vendor: String(g("vendor") ?? ""),
    ownerId: String(g("ownerId") ?? g("createdBy") ?? ""),
    ownerName: String(g("ownerName") ?? g("createdByName") ?? ""),
    paymentMethod: String(g("paymentMethod") ?? ""),
    campaignKolId: g("campaignKolId") ?? null,
    receipt: g("receipt") ?? null,
    remark: String(g("remark") ?? ""),
    status: g("status"),
    statusNote: String(g("statusNote") ?? ""),
    kolPaymentId: g("kolPaymentId") ?? null,
    overBudget: g("overBudget") === true,
    version: Number(g("version") ?? 1),
    createdBy: String(g("createdBy") ?? ""),
    createdByName: String(g("createdByName") ?? ""),
    createdAt: toIso(g("createdAt")),
    updatedAt: toIso(g("updatedAt")),
    deleted: g("deleted") === true,
  };
}

function toPersonBudget(d: DocumentSnapshot | undefined, teamId: string, userId: string, month: string): PersonBudget {
  const b = {
    baseSen: Number(d?.get("baseSen") ?? 0),
    carryForwardSen: Number(d?.get("carryForwardSen") ?? 0),
    topUpSen: Number(d?.get("topUpSen") ?? 0),
  };
  return { teamId, userId, month, ...b, totalSen: personTotal(b), set: Boolean(d?.exists), version: Number(d?.get("version") ?? 0) };
}

function toRequest(d: DocumentSnapshot): TopUpRequest {
  const g = (k: string) => d.get(k);
  return {
    id: d.id,
    teamId: String(g("teamId") ?? ""),
    userId: String(g("userId") ?? ""),
    userName: String(g("userName") ?? ""),
    month: String(g("month") ?? ""),
    amountSen: Number(g("amountSen") ?? 0),
    reason: String(g("reason") ?? ""),
    status: g("status") ?? "Pending",
    approvedSen: Number(g("approvedSen") ?? 0),
    reviewNote: String(g("reviewNote") ?? ""),
    reviewedByName: String(g("reviewedByName") ?? ""),
    version: Number(g("version") ?? 1),
    createdAt: toIso(g("createdAt")),
  };
}

/* ------------------------------ Bacaan asas ------------------------------ */

async function budgetsForMonth(month: string): Promise<Map<string, PersonBudget>> {
  const snap = await personBudgets().where("month", "==", month).get();
  return new Map(snap.docs.map((d) => [key(String(d.get("teamId")), String(d.get("userId"))), toPersonBudget(d, String(d.get("teamId")), String(d.get("userId")), month)]));
}

async function expensesFor(month: string, teamId?: string): Promise<Expense[]> {
  let q = expenses().where("month", "==", month);
  if (teamId) q = q.where("teamId", "==", teamId);
  const snap = await q.get();
  return snap.docs
    .map(toExpense)
    .filter((e) => !e.deleted)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

/** Fee KOL belum dibayar dan nilai in-kind, ikut team|PIC. */
async function kolMonth(month: string): Promise<{ committed: Map<string, number>; inKind: Map<string, number> }> {
  const snap = await adminDb().collection("campaign_kols").where("month", "==", month).get();
  const committed = new Map<string, number>();
  const inKind = new Map<string, number>();
  for (const d of snap.docs) {
    if (d.get("deleted") === true || d.get("stage") === "Dropped") continue;
    const k = key(String(d.get("teamId")), String(d.get("picId") ?? ""));
    const sen = committedSen({ stage: d.get("stage"), deleted: false }, Number(d.get("feeSen") ?? 0), Number(d.get("paidSen") ?? 0));
    if (sen > 0) committed.set(k, (committed.get(k) ?? 0) + sen);
    const ik = Number(d.get("inKindSen") ?? 0);
    if (ik > 0) inKind.set(k, (inKind.get(k) ?? 0) + ik);
  }
  return { committed, inKind };
}

/** Ahli aktif sesuatu team (person yang boleh ada bajet). */
export async function teamMembers(teamId: string) {
  return (await listUsers()).filter((u) => u.active && u.teamIds.includes(teamId)).map((u) => ({ id: u.id, name: u.name }));
}

async function assertMember(teamId: string, userId: string) {
  const members = await teamMembers(teamId);
  const m = members.find((x) => x.id === userId);
  if (!m) throw new AppError("VALIDATION", undefined, { fields: { ownerId: "Person ini bukan ahli aktif team tersebut." } });
  return m;
}

/* ------------------------------ Paparan ------------------------------ */

export interface PersonRow {
  user: { id: string; name: string };
  budget: PersonBudget;
  summary: BudgetSummary;
  inKindSen: number;
  suggestedCarrySen: number;
}

function personSummary(b: PersonBudget, list: Expense[], committed: number): BudgetSummary {
  return summarize(b.totalSen, list, committed);
}

/** Bajet seorang person. Admin atau person itu sendiri sahaja. */
export async function getPersonBudgetView(viewer: SessionUser, teamId: string, userId: string, month: string) {
  if (!canViewOwnerFinance(viewer, userId)) throw new AppError("NOT_FOUND", "Rekod tidak dijumpai.");
  const teams = await listTeams();
  const team = teams.find((t) => t.id === teamId);
  if (!team) throw new AppError("NOT_FOUND", "Team tidak dijumpai.");
  const person = await assertMember(teamId, userId);
  const [snap, list, kol, reqs] = await Promise.all([
    personBudgets().doc(pbId(teamId, userId, month)).get(),
    expensesFor(month, teamId),
    kolMonth(month),
    requests().where("userId", "==", userId).get(),
  ]);
  const budget = toPersonBudget(snap, teamId, userId, month);
  const mine = list.filter((e) => e.ownerId === userId);
  return {
    team,
    person,
    budget,
    summary: personSummary(budget, mine, kol.committed.get(key(teamId, userId)) ?? 0),
    inKindSen: kol.inKind.get(key(teamId, userId)) ?? 0,
    expenses: mine,
    requests: reqs.docs.map(toRequest).filter((r) => r.teamId === teamId).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")),
  };
}

/** Admin: semua person dalam satu team + jumlah team. */
export async function getTeamBudgetView(admin: SessionUser, teamId: string, month: string) {
  if (admin.role !== "admin") throw new AppError("FORBIDDEN");
  const teams = await listTeams();
  const team = teams.find((t) => t.id === teamId);
  if (!team) throw new AppError("NOT_FOUND", "Team tidak dijumpai.");
  const prev = shiftMonth(month, -1);
  const [members, budgets, prevBudgets, list, prevList, kol, prevKol, channelSnap, reqSnap] = await Promise.all([
    teamMembers(teamId),
    budgetsForMonth(month),
    budgetsForMonth(prev),
    expensesFor(month, teamId),
    expensesFor(prev, teamId),
    kolMonth(month),
    kolMonth(prev),
    teamSettings().doc(`${teamId}_${month}`).get(),
    requests().where("month", "==", month).get(),
  ]);
  // Termasuk person yang ada bajet walaupun sudah keluar team
  const ids = new Set([...members.map((m) => m.id), ...[...budgets.values()].filter((b) => b.teamId === teamId).map((b) => b.userId)]);
  const names = new Map((await listUsers()).map((u) => [u.id, u.name]));
  const rows: PersonRow[] = [...ids].map((uid) => {
    const k = key(teamId, uid);
    const budget = budgets.get(k) ?? toPersonBudget(undefined, teamId, uid, month);
    const prevBudget = prevBudgets.get(k) ?? toPersonBudget(undefined, teamId, uid, prev);
    const prevSummary = personSummary(prevBudget, prevList.filter((e) => e.ownerId === uid), prevKol.committed.get(k) ?? 0);
    return {
      user: { id: uid, name: names.get(uid) ?? uid },
      budget,
      summary: personSummary(budget, list.filter((e) => e.ownerId === uid), kol.committed.get(k) ?? 0),
      inKindSen: kol.inKind.get(k) ?? 0,
      suggestedCarrySen: prevBudget.set ? suggestCarryForward(prevSummary.availableSen) : 0,
    };
  }).sort((a, b) => a.user.name.localeCompare(b.user.name));

  const teamCommitted = rows.reduce((a, r) => a + r.summary.kolCommittedSen, 0);
  const summary = summarize(rows.reduce((a, r) => a + r.budget.totalSen, 0), list, teamCommitted);
  const channels = (channelSnap.get("channels") ?? {}) as Record<string, number>;
  return {
    team,
    rows,
    summary,
    inKindSen: rows.reduce((a, r) => a + r.inKindSen, 0),
    channels,
    channelRows: byChannel(list, channels) as ChannelRow[],
    expenses: list,
    members,
    requests: reqSnap.docs.map(toRequest).filter((r) => r.teamId === teamId && r.status === "Pending"),
  };
}

/** Admin: ringkasan setiap team (jumlah semua person). */
export async function getAllTeamsBudget(admin: SessionUser, month: string) {
  if (admin.role !== "admin") throw new AppError("FORBIDDEN");
  const [teams, budgets, list, kol, reqSnap] = await Promise.all([listTeams(), budgetsForMonth(month), expensesFor(month), kolMonth(month), requests().where("status", "==", "Pending").get()]);
  const rows = teams.map((team: Team) => {
    const tb = [...budgets.values()].filter((b) => b.teamId === team.id);
    const committed = [...kol.committed.entries()].filter(([k]) => k.startsWith(`${team.id}|`)).reduce((a, [, v]) => a + v, 0);
    const inKindSen = [...kol.inKind.entries()].filter(([k]) => k.startsWith(`${team.id}|`)).reduce((a, [, v]) => a + v, 0);
    return {
      team,
      persons: tb.length,
      summary: summarize(tb.reduce((a, b) => a + b.totalSen, 0), list.filter((e) => e.teamId === team.id), committed),
      inKindSen,
    };
  });
  const total = summarize(
    rows.reduce((a, r) => a + r.summary.budgetSen, 0),
    list,
    rows.reduce((a, r) => a + r.summary.kolCommittedSen, 0),
  );
  return {
    rows,
    total,
    inKindSen: rows.reduce((a, r) => a + r.inKindSen, 0),
    byChannel: byChannel(list, {}),
    pendingReview: list.filter((e) => e.status === "Dalam Proses"),
    pendingRequests: reqSnap.docs.map(toRequest),
  };
}

/* ------------------------------ Admin: set bajet ------------------------------ */

export async function setPersonBudget(
  admin: SessionUser,
  input: { teamId: string; userId: string; month: string; base?: number; carryForward?: number },
  requestId: string,
) {
  if (admin.role !== "admin") throw new AppError("FORBIDDEN");
  await assertMember(input.teamId, input.userId).catch(async (e) => {
    // Benarkan jika person sudah ada bajet bulan ini (contoh baru keluar team)
    const snap = await personBudgets().doc(pbId(input.teamId, input.userId, input.month)).get();
    if (!snap.exists) throw e;
  });
  const ref = personBudgets().doc(pbId(input.teamId, input.userId, input.month));
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const before = toPersonBudget(snap, input.teamId, input.userId, input.month);
    const next = {
      baseSen: input.base ?? before.baseSen,
      carryForwardSen: input.carryForward ?? before.carryForwardSen,
    };
    const changes = diff({ baseSen: before.baseSen, carryForwardSen: before.carryForwardSen }, next);
    if (!changes && snap.exists) return;
    tx.set(ref, {
      teamId: input.teamId,
      userId: input.userId,
      month: input.month,
      ...next,
      topUpSen: before.topUpSen,
      version: before.version + 1,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.id,
    });
    writeAudit(tx, { actor: { kind: "user", user: admin }, action: "set_person_budget", entity: "budget", entityId: ref.id, teamId: input.teamId, changes, requestId });
  });
  return { id: ref.id };
}

export async function setTeamChannels(admin: SessionUser, teamId: string, month: string, channels: Record<string, number>, requestId: string) {
  if (admin.role !== "admin") throw new AppError("FORBIDDEN");
  await assertInList("expenseCategories", Object.keys(channels), "channels");
  const ref = teamSettings().doc(`${teamId}_${month}`);
  const next = Object.fromEntries(Object.entries(channels).filter(([, v]) => v > 0));
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const before = (snap.get("channels") ?? {}) as Record<string, number>;
    if (JSON.stringify(before) === JSON.stringify(next)) return;
    tx.set(ref, { teamId, month, channels: next, updatedAt: FieldValue.serverTimestamp(), updatedBy: admin.id });
    writeAudit(tx, { actor: { kind: "user", user: admin }, action: "set_channels", entity: "budget", entityId: ref.id, teamId, changes: { channels: { from: before, to: next } }, requestId });
  });
  return { id: ref.id };
}

/* ------------------------------ Tambahan bajet ------------------------------ */

export async function createTopUpRequest(user: SessionUser, input: { teamId: string; month: string; amount: number; reason: string }, requestId: string) {
  await assertMember(input.teamId, user.id).catch(() => {
    throw new AppError("FORBIDDEN", "Anda bukan ahli team ini.");
  });
  const ref = requests().doc();
  const batch = adminDb().batch();
  batch.set(ref, {
    teamId: input.teamId,
    userId: user.id,
    userName: user.name,
    month: input.month,
    amountSen: input.amount,
    reason: input.reason,
    status: "Pending",
    approvedSen: 0,
    reviewNote: "",
    reviewedByName: "",
    version: 1,
    createdAt: FieldValue.serverTimestamp(),
  });
  writeAudit(batch, { actor: { kind: "user", user }, action: "topup_request", entity: "budget", entityId: pbId(input.teamId, user.id, input.month), teamId: input.teamId, to: "Pending", note: `${formatSen(input.amount)}: ${input.reason}`, requestId });
  await batch.commit();
  return { id: ref.id };
}

export async function reviewTopUp(admin: SessionUser, id: string, action: "approve" | "reject", amountSen: number, note: string, version: number, requestId: string) {
  const ref = requests().doc(id);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError("NOT_FOUND", "Permohonan tidak dijumpai.");
    const r = toRequest(snap);
    if (r.version !== version) throw new AppError("CONFLICT");
    const approved = action === "approve" ? amountSen || r.amountSen : 0;
    const check = checkTopUpReview(admin, r, action, approved, note);
    if (!check.ok) throw new AppError(check.code, check.message, check.code === "VALIDATION" ? { fields: { _: check.message } } : {});

    const pbRef = personBudgets().doc(pbId(r.teamId, r.userId, r.month));
    const pbSnap = await tx.get(pbRef);
    tx.update(ref, {
      status: action === "approve" ? "Approved" : "Rejected",
      approvedSen: approved,
      reviewNote: note.trim(),
      reviewedBy: admin.id,
      reviewedByName: admin.name,
      version: r.version + 1,
    });
    if (action === "approve") {
      const pb = toPersonBudget(pbSnap, r.teamId, r.userId, r.month);
      tx.set(pbRef, {
        teamId: r.teamId,
        userId: r.userId,
        month: r.month,
        baseSen: pb.baseSen,
        carryForwardSen: pb.carryForwardSen,
        topUpSen: pb.topUpSen + approved,
        version: pb.version + 1,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: admin.id,
      });
    }
    writeAudit(tx, {
      actor: { kind: "user", user: admin },
      action: action === "approve" ? "topup_approve" : "topup_reject",
      entity: "budget",
      entityId: pbRef.id,
      teamId: r.teamId,
      from: "Pending",
      to: action === "approve" ? "Approved" : "Rejected",
      note: `${r.userName}: ${action === "approve" ? `${formatSen(approved)} diluluskan` : "ditolak"}${note.trim() ? `. ${note.trim()}` : ""}`,
      requestId,
    });
    return { id, status: action };
  });
}

/* ------------------------------ Perbelanjaan ------------------------------ */

async function campaignNameFor(campaignId: string | null, teamId: string): Promise<string> {
  if (!campaignId) return "";
  const c = await getCampaign(campaignId);
  if (!c) throw new AppError("VALIDATION", undefined, { fields: { campaignId: "Campaign tidak dijumpai." } });
  if (c.teamId !== teamId) throw new AppError("VALIDATION", undefined, { fields: { campaignId: "Campaign ini milik team lain." } });
  return c.name;
}

/** KOL berkaitan mesti milik person & team yang sama, dan campaign yang sama jika dipilih. */
async function assertCkLink(ckId: string | null, teamId: string, ownerId: string, campaignId: string | null) {
  if (!ckId) return;
  const snap = await adminDb().collection("campaign_kols").doc(ckId).get();
  if (!snap.exists || snap.get("deleted") === true || snap.get("teamId") !== teamId || snap.get("picId") !== ownerId || (campaignId && snap.get("campaignId") !== campaignId)) {
    throw new AppError("VALIDATION", undefined, { fields: { campaignKolId: "KOL ini bukan di bawah anda / campaign yang dipilih." } });
  }
}

async function assertExpenseLists(input: ExpenseInput, ownerId: string, before?: Expense) {
  await Promise.all([
    assertInList("expenseCategories", [input.category], "category", before ? [before.category] : []),
    assertInList("paymentMethods", [input.paymentMethod], "paymentMethod", before ? [before.paymentMethod] : []),
    assertCkLink(input.campaignKolId, before?.teamId ?? input.teamId, ownerId, input.campaignId),
  ]);
}

export async function createExpense(user: SessionUser, input: ExpenseInput, requestId: string) {
  // Ahli sentiasa rekod atas bajet sendiri. Admin boleh rekod bagi pihak person.
  const ownerId = user.role === "admin" ? input.ownerId ?? "" : user.id;
  if (user.role !== "admin" && input.ownerId && input.ownerId !== user.id) throw new AppError("FORBIDDEN", "Anda hanya boleh guna bajet sendiri.");
  if (!ownerId) throw new AppError("VALIDATION", undefined, { fields: { ownerId: "Pilih person yang menanggung perbelanjaan ini." } });
  const owner = await assertMember(input.teamId, ownerId).catch(() => {
    throw new AppError(user.role === "admin" ? "VALIDATION" : "FORBIDDEN", "Person ini bukan ahli team tersebut.", { fields: { ownerId: "Bukan ahli team." } });
  });
  await assertExpenseLists(input, ownerId);
  const month = input.date.slice(0, 7);
  const [receipt, campaignName, view] = await Promise.all([
    getFileRefForTeam(input.receiptFileId, input.teamId, ownerId),
    campaignNameFor(input.campaignId, input.teamId),
    getPersonBudgetView({ ...user, role: "admin" }, input.teamId, ownerId, month),
  ]);
  const overBudget = input.amount > view.summary.availableSen;

  const ref = expenses().doc();
  const batch = adminDb().batch();
  batch.set(ref, {
    teamId: input.teamId,
    month,
    date: input.date,
    campaignId: input.campaignId,
    campaignName,
    category: input.category,
    description: input.description,
    amountSen: input.amount,
    vendor: input.vendor,
    ownerId,
    ownerName: owner.name,
    paymentMethod: input.paymentMethod,
    campaignKolId: input.campaignKolId,
    receipt,
    remark: input.remark,
    status: "Dalam Proses",
    statusNote: overBudget ? "Melebihi baki bajet person. Perlu kelulusan Admin atau mohon tambahan bajet." : "",
    kolPaymentId: null,
    overBudget,
    version: 1,
    deleted: false,
    createdBy: user.id,
    createdByName: user.name,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  writeAudit(batch, {
    actor: { kind: "user", user },
    action: "create",
    entity: "expense",
    entityId: ref.id,
    teamId: input.teamId,
    to: "Dalam Proses",
    note: `${owner.name}: ${input.description}, ${formatSen(input.amount)}${overBudget ? " (melebihi baki)" : ""}`,
    requestId,
  });
  await batch.commit();
  return { id: ref.id, overBudget };
}

export async function updateExpense(user: SessionUser, id: string, version: number, input: ExpenseInput, requestId: string) {
  const ref = expenses().doc(id);
  const pre = await ref.get();
  if (!pre.exists) throw new AppError("NOT_FOUND", "Perbelanjaan tidak dijumpai.");
  const current = toExpense(pre);
  if (!canViewOwnerFinance(user, current.ownerId)) throw new AppError("NOT_FOUND", "Perbelanjaan tidak dijumpai.");
  await assertExpenseLists(input, current.ownerId, current);
  // Team dan person pemilik tidak boleh ditukar
  const [receipt, campaignName] = await Promise.all([
    getFileRefForTeam(input.receiptFileId, current.teamId, current.ownerId),
    campaignNameFor(input.campaignId, current.teamId),
  ]);

  return adminDb().runTransaction(async (tx) => {
    const before = toExpense(await tx.get(ref));
    if (before.version !== version) throw new AppError("CONFLICT");
    if (!canEditExpense(user, before)) throw new AppError("FORBIDDEN", "Perbelanjaan ini tidak boleh diubah lagi.");
    const next = {
      month: input.date.slice(0, 7),
      date: input.date,
      campaignId: input.campaignId,
      campaignName,
      category: input.category,
      description: input.description,
      amountSen: input.amount,
      vendor: input.vendor,
      paymentMethod: input.paymentMethod,
      campaignKolId: input.campaignKolId,
      receipt,
      remark: input.remark,
    };
    const changes = diff(before as unknown as Record<string, unknown>, next);
    if (!changes) return { id };
    const resubmit = before.status === "Ditolak";
    tx.update(ref, { ...next, ...(resubmit ? { status: "Dalam Proses", statusNote: "" } : {}), version: before.version + 1, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, {
      actor: { kind: "user", user },
      action: resubmit ? "resubmit" : "update",
      entity: "expense",
      entityId: id,
      teamId: before.teamId,
      from: resubmit ? "Ditolak" : null,
      to: resubmit ? "Dalam Proses" : null,
      changes,
      requestId,
    });
    return { id };
  });
}

export async function reviewExpense(user: SessionUser, id: string, action: ReviewAction, note: string, version: number, requestId: string) {
  const ref = expenses().doc(id);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError("NOT_FOUND", "Perbelanjaan tidak dijumpai.");
    const e = toExpense(snap);
    if (e.version !== version) throw new AppError("CONFLICT");
    const r = checkExpenseReview(user, e, action, note);
    if (!r.ok) throw new AppError(r.code, r.message, r.code === "VALIDATION" ? { fields: { note: r.message } } : {});
    tx.update(ref, { status: r.to, statusNote: note.trim(), version: e.version + 1, reviewedBy: user.id, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, { actor: { kind: "user", user }, action, entity: "expense", entityId: id, teamId: e.teamId, from: e.status, to: r.to, note: note.trim(), requestId });
    return { id, status: r.to };
  });
}

export async function deleteExpense(user: SessionUser, id: string, version: number | null, requestId: string, note = "") {
  const ref = expenses().doc(id);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError("NOT_FOUND", "Perbelanjaan tidak dijumpai.");
    const e = toExpense(snap);
    if (!canViewOwnerFinance(user, e.ownerId)) throw new AppError("NOT_FOUND", "Perbelanjaan tidak dijumpai.");
    if (version !== null && e.version !== version) throw new AppError("CONFLICT");
    if (!canDeleteExpense(user, e)) throw new AppError("FORBIDDEN", e.kolPaymentId ? "Perbelanjaan dari bayaran KOL dibatalkan melalui Bayaran KOL." : "Hanya Admin boleh padam. Ahli boleh mohon padam.");
    tx.update(ref, { deleted: true, deletedAt: FieldValue.serverTimestamp(), deletedBy: user.id, version: e.version + 1 });
    writeAudit(tx, { actor: { kind: "user", user }, action: "delete", entity: "expense", entityId: id, teamId: e.teamId, from: e.status, note: [e.description, note].filter(Boolean).join(". "), requestId });
  });
  return { id };
}

/* ------------------------------ Kos campaign ------------------------------ */

export interface CampaignCost {
  scope: "all" | "mine";
  plannedSen: number;
  usedSen: number;
  pendingSen: number;
  kolUnpaidSen: number;
  inKindSen: number;
  totalSen: number;
  byCategory: ChannelRow[];
}

/** Admin: kos penuh campaign. Ahli team: kos yang ditanggung oleh dirinya sahaja. */
export async function getCampaignCost(user: SessionUser, c: Campaign): Promise<CampaignCost | null> {
  const all = user.role === "admin";
  if (!all && !user.teamIds.includes(c.teamId)) return null;
  const [exp, cks] = await Promise.all([
    expenses().where("campaignId", "==", c.id).get(),
    adminDb().collection("campaign_kols").where("campaignId", "==", c.id).get(),
  ]);
  const list = exp.docs.map(toExpense).filter((e) => !e.deleted && e.status !== "Ditolak" && (all || e.ownerId === user.id));
  let kolUnpaidSen = 0;
  let inKindSen = 0;
  for (const d of cks.docs) {
    if (d.get("deleted") === true || d.get("stage") === "Dropped") continue;
    if (!all && d.get("picId") !== user.id) continue;
    kolUnpaidSen += committedSen({ stage: d.get("stage"), deleted: false }, Number(d.get("feeSen") ?? 0), Number(d.get("paidSen") ?? 0));
    inKindSen += Number(d.get("inKindSen") ?? 0);
  }
  const usedSen = list.filter((e) => e.status === "Selesai").reduce((a, e) => a + e.amountSen, 0);
  const pendingSen = list.filter((e) => e.status === "Dalam Proses").reduce((a, e) => a + e.amountSen, 0);
  return {
    scope: all ? "all" : "mine",
    plannedSen: c.plannedBudgetSen,
    usedSen,
    pendingSen,
    kolUnpaidSen,
    inKindSen,
    totalSen: usedSen + pendingSen + kolUnpaidSen + inKindSen,
    byCategory: byChannel(list, {}),
  };
}

/** Perbelanjaan yang dipautkan kepada satu KOL. Admin atau PIC sahaja. */
export async function listExpensesForCk(user: SessionUser, ckId: string, picId: string): Promise<Expense[]> {
  if (!canViewOwnerFinance(user, picId)) return [];
  const snap = await expenses().where("campaignKolId", "==", ckId).get();
  return snap.docs.map(toExpense).filter((e) => !e.deleted && e.status !== "Ditolak");
}

/* ------------------------------ Paparan tahunan ------------------------------ */

export interface MonthCell {
  month: string;
  budgetSen: number;
  usedSen: number;
  pendingSen: number;
  committedSen: number;
  availableSen: number;
  pctUsed: number;
  set: boolean;
}

export interface YearRow {
  key: string;
  label: string;
  teamId: string;
  userId: string | null;
  cells: MonthCell[];
  total: MonthCell;
}

function emptyCell(month: string): MonthCell {
  return { month, budgetSen: 0, usedSen: 0, pendingSen: 0, committedSen: 0, availableSen: 0, pctUsed: 0, set: false };
}

function finish(c: MonthCell): MonthCell {
  const availableSen = c.budgetSen - c.usedSen - c.pendingSen - c.committedSen;
  const pctUsed = c.budgetSen > 0 ? Math.round((c.usedSen / c.budgetSen) * 100) : c.usedSen > 0 ? 100 : 0;
  return { ...c, availableSen, pctUsed };
}

function sumCells(month: string, cells: MonthCell[]): MonthCell {
  return finish(
    cells.reduce(
      (a, c) => ({ ...a, budgetSen: a.budgetSen + c.budgetSen, usedSen: a.usedSen + c.usedSen, pendingSen: a.pendingSen + c.pendingSen, committedSen: a.committedSen + c.committedSen, set: a.set || c.set }),
      emptyCell(month),
    ),
  );
}

/**
 * Ringkasan setahun (12 bulan).
 *  - Ahli: satu baris untuk setiap team miliknya (bajet sendiri sahaja).
 *  - Admin + "all": satu baris setiap team.  Admin + team: satu baris setiap person.
 */
export async function getBudgetYear(viewer: SessionUser, year: number, teamId: string) {
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const from = months[0]!;
  const to = months[11]!;
  const [pbSnap, exSnap, ckSnap, teams, users] = await Promise.all([
    personBudgets().where("month", ">=", from).where("month", "<=", to).get(),
    expenses().where("month", ">=", from).where("month", "<=", to).get(),
    adminDb().collection("campaign_kols").where("month", ">=", from).where("month", "<=", to).get(),
    listTeams(),
    listUsers(),
  ]);

  // Agregat ikut team|person|bulan
  const agg = new Map<string, MonthCell>();
  const cell = (t: string, u: string, m: string) => {
    const k = `${t}|${u}|${m}`;
    if (!agg.has(k)) agg.set(k, emptyCell(m));
    return agg.get(k)!;
  };
  for (const d of pbSnap.docs) {
    const c = cell(String(d.get("teamId")), String(d.get("userId")), String(d.get("month")));
    c.budgetSen += personTotal({ baseSen: Number(d.get("baseSen") ?? 0), carryForwardSen: Number(d.get("carryForwardSen") ?? 0), topUpSen: Number(d.get("topUpSen") ?? 0) });
    c.set = true;
  }
  for (const d of exSnap.docs) {
    const e = toExpense(d);
    if (e.deleted || e.status === "Ditolak") continue;
    const c = cell(e.teamId, e.ownerId, e.month);
    if (e.status === "Selesai") c.usedSen += e.amountSen;
    else c.pendingSen += e.amountSen;
  }
  for (const d of ckSnap.docs) {
    if (d.get("deleted") === true || d.get("stage") === "Dropped") continue;
    const sen = committedSen({ stage: d.get("stage"), deleted: false }, Number(d.get("feeSen") ?? 0), Number(d.get("paidSen") ?? 0));
    if (sen > 0) cell(String(d.get("teamId")), String(d.get("picId") ?? ""), String(d.get("month"))).committedSen += sen;
  }

  const pick = (fn: (t: string, u: string) => boolean) => months.map((m) => sumCells(m, [...agg.entries()].filter(([k]) => { const [t, u, mm] = k.split("|"); return mm === m && fn(t!, u!); }).map(([, c]) => c)));
  const mkRow = (key: string, label: string, t: string, u: string | null, cells: MonthCell[]): YearRow => ({ key, label, teamId: t, userId: u, cells, total: sumCells("year", cells) });
  const name = new Map(users.map((u) => [u.id, u.name]));

  let rows: YearRow[];
  let mode: "self" | "teams" | "persons";
  if (viewer.role !== "admin") {
    mode = "self";
    const myTeams = teams.filter((t) => viewer.teamIds.includes(t.id));
    rows = myTeams.map((t) => mkRow(t.id, t.name, t.id, viewer.id, pick((tt, u) => tt === t.id && u === viewer.id)));
  } else if (teamId === "all" || !teamId) {
    mode = "teams";
    rows = teams.map((t) => mkRow(t.id, t.name, t.id, null, pick((tt) => tt === t.id)));
  } else {
    mode = "persons";
    const ids = new Set([
      ...users.filter((u) => u.active && u.teamIds.includes(teamId)).map((u) => u.id),
      ...[...agg.keys()].filter((k) => k.startsWith(`${teamId}|`)).map((k) => k.split("|")[1]!).filter(Boolean),
    ]);
    rows = [...ids].map((u) => mkRow(u, name.get(u) ?? u, teamId, u, pick((tt, uu) => tt === teamId && uu === u))).sort((a, b) => a.label.localeCompare(b.label));
  }
  const totals = months.map((m, i) => sumCells(m, rows.map((r) => r.cells[i]!)));
  return { year, months, mode, rows, totals, yearTotal: sumCells("year", totals) };
}

/** Admin: isi bajet asas beberapa person x beberapa bulan. Carry forward & tambahan tidak diubah. */
export async function bulkSetPersonBudgets(admin: SessionUser, teamId: string, userIds: string[], months: string[], baseSen: number, requestId: string) {
  if (admin.role !== "admin") throw new AppError("FORBIDDEN");
  const members = await teamMembers(teamId);
  const bad = userIds.filter((u) => !members.some((m) => m.id === u));
  if (bad.length) throw new AppError("VALIDATION", undefined, { fields: { userIds: "Ada person yang bukan ahli team ini." } });
  const refs = userIds.flatMap((u) => months.map((m) => ({ u, m, ref: personBudgets().doc(pbId(teamId, u, m)) })));
  const snaps = await Promise.all(refs.map((r) => r.ref.get()));
  const batch = adminDb().batch();
  refs.forEach(({ u, m, ref }, i) => {
    const before = toPersonBudget(snaps[i], teamId, u, m);
    batch.set(ref, { teamId, userId: u, month: m, baseSen, carryForwardSen: before.carryForwardSen, topUpSen: before.topUpSen, version: before.version + 1, updatedAt: FieldValue.serverTimestamp(), updatedBy: admin.id });
  });
  writeAudit(batch, {
    actor: { kind: "user", user: admin },
    action: "set_person_budget_bulk",
    entity: "budget",
    entityId: `${teamId}_bulk`,
    teamId,
    note: `${formatSen(baseSen)} untuk ${userIds.length} person x ${months.length} bulan (${months[0]} hingga ${months[months.length - 1]})`,
    requestId,
  });
  await batch.commit();
  return { count: refs.length };
}

/* ------------------------------ Senarai perbelanjaan & permohonan ------------------------------ */

/** Ahli: sentiasa miliknya sahaja. Admin: ikut penapis. */
export async function listExpenses(viewer: SessionUser, f: { month: string; teamId?: string; ownerId?: string; status?: string }) {
  let list = await expensesFor(f.month, f.teamId && f.teamId !== "all" ? f.teamId : undefined);
  if (viewer.role !== "admin") list = list.filter((e) => e.ownerId === viewer.id);
  else if (f.ownerId) list = list.filter((e) => e.ownerId === f.ownerId);
  if (f.status && f.status !== "all") list = list.filter((e) => e.status === f.status);
  return list;
}

export async function listTopUpRequests(viewer: SessionUser): Promise<TopUpRequest[]> {
  const snap = viewer.role === "admin" ? await requests().get() : await requests().where("userId", "==", viewer.id).get();
  return snap.docs.map(toRequest).sort((a, b) => (a.status === "Pending" ? 0 : 1) - (b.status === "Pending" ? 0 : 1) || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

/** Person tarik balik permohonan tambahan sendiri yang masih Pending. */
export async function cancelTopUp(user: SessionUser, id: string, version: number, requestId: string) {
  const ref = requests().doc(id);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError("NOT_FOUND", "Permohonan tidak dijumpai.");
    const r = toRequest(snap);
    if (r.userId !== user.id) throw new AppError("NOT_FOUND", "Permohonan tidak dijumpai.");
    if (r.version !== version) throw new AppError("CONFLICT");
    if (r.status !== "Pending") throw new AppError("INVALID_TRANSITION", "Permohonan ini sudah disemak Admin.");
    tx.update(ref, { status: "Cancelled", version: r.version + 1 });
    writeAudit(tx, { actor: { kind: "user", user }, action: "topup_cancel", entity: "budget", entityId: pbId(r.teamId, r.userId, r.month), teamId: r.teamId, from: "Pending", to: "Cancelled", requestId });
    return { id };
  });
}

/** Admin: perbelanjaan (bukan ditolak) dalam julat bulan, untuk laporan. */
export async function expensesInRange(fromMonth: string, toMonth: string, teamId?: string): Promise<Expense[]> {
  const snap = await expenses().where("month", ">=", fromMonth).where("month", "<=", toMonth).get();
  return snap.docs.map(toExpense).filter((e) => !e.deleted && e.status !== "Ditolak" && (!teamId || teamId === "all" || e.teamId === teamId));
}
