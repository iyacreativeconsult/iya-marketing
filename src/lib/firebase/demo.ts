import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { addDays, todayMYT } from "../domain/dates";
import { EMPTY_CK_DETAILS } from "../domain/types";

/**
 * Firestore palsu dalam memori untuk Mod Demo. Menyokong operasi yang
 * digunakan oleh services sahaja: doc/get/set/update/add, where (==, >=, <=, in),
 * orderBy, limit, batch dan runTransaction.
 */

type Data = Record<string, unknown>;
type Store = Map<string, Map<string, Data>>;

const SERVER_TS = FieldValue.serverTimestamp();

function resolve(data: Data): Data {
  const out: Data = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    out[k] = v instanceof FieldValue && v.isEqual(SERVER_TS) ? Timestamp.now() : Array.isArray(v) ? [...v] : v;
  }
  return out;
}

function cmp(a: unknown, b: unknown): number {
  const va = a instanceof Timestamp ? a.toMillis() : a;
  const vb = b instanceof Timestamp ? b.toMillis() : b;
  if (va === vb) return 0;
  if (va === undefined || va === null) return -1;
  if (vb === undefined || vb === null) return 1;
  return (va as number) < (vb as number) ? -1 : 1;
}

let counter = 0;
const newId = () => `demo${Date.now().toString(36)}${(counter++).toString(36)}`;

class Snap {
  constructor(public id: string, private d: Data | undefined) {}
  get exists() {
    return this.d !== undefined;
  }
  get(field: string) {
    return this.d?.[field];
  }
  data() {
    return this.d ? { ...this.d } : undefined;
  }
}

class DocRef {
  constructor(private store: Store, public col: string, public id: string) {}
  private table() {
    if (!this.store.has(this.col)) this.store.set(this.col, new Map());
    return this.store.get(this.col)!;
  }
  async get() {
    return new Snap(this.id, this.table().get(this.id));
  }
  _set(data: Data) {
    this.table().set(this.id, resolve(data));
  }
  _update(data: Data) {
    const cur = this.table().get(this.id);
    if (!cur) throw new Error(`[demo] dokumen ${this.col}/${this.id} tidak wujud`);
    this.table().set(this.id, { ...cur, ...resolve(data) });
  }
  async set(data: Data) {
    this._set(data);
  }
  async update(data: Data) {
    this._update(data);
  }
}

type Filter = { field: string; op: string; value: unknown };

class Query {
  constructor(
    protected store: Store,
    protected name: string,
    private filters: Filter[] = [],
    private order: { field: string; dir: "asc" | "desc" }[] = [],
    private max?: number,
  ) {}
  where(field: string, op: string, value: unknown) {
    return new Query(this.store, this.name, [...this.filters, { field, op, value }], this.order, this.max);
  }
  orderBy(field: string, dir: "asc" | "desc" = "asc") {
    return new Query(this.store, this.name, this.filters, [...this.order, { field, dir }], this.max);
  }
  limit(n: number) {
    return new Query(this.store, this.name, this.filters, this.order, n);
  }
  async get() {
    let rows = [...(this.store.get(this.name) ?? new Map()).entries()];
    for (const f of this.filters) {
      rows = rows.filter(([, d]) => {
        const v = d[f.field];
        if (f.op === "==") return v === f.value;
        if (f.op === ">=") return v !== undefined && cmp(v, f.value) >= 0;
        if (f.op === "<=") return v !== undefined && cmp(v, f.value) <= 0;
        if (f.op === "in") return (f.value as unknown[]).includes(v);
        if (f.op === "array-contains") return Array.isArray(v) && v.includes(f.value);
        throw new Error(`[demo] operator ${f.op} belum disokong`);
      });
    }
    for (const o of [...this.order].reverse()) {
      rows.sort(([, a], [, b]) => cmp(a[o.field], b[o.field]) * (o.dir === "desc" ? -1 : 1));
    }
    if (this.max !== undefined) rows = rows.slice(0, this.max);
    const docs = rows.map(([id, d]) => new Snap(id, d));
    return { docs, empty: docs.length === 0, size: docs.length };
  }
}

class Collection extends Query {
  doc(id?: string) {
    return new DocRef(this.store, this.name, id ?? newId());
  }
  async add(data: Data) {
    const ref = this.doc();
    ref._set(data);
    return ref;
  }
}

class Batch {
  private ops: (() => void)[] = [];
  set(ref: DocRef, data: Data) {
    this.ops.push(() => ref._set(data));
    return this;
  }
  update(ref: DocRef, data: Data) {
    this.ops.push(() => ref._update(data));
    return this;
  }
  async commit() {
    this.ops.forEach((op) => op());
  }
}

class Tx extends Batch {
  async get(ref: DocRef) {
    return ref.get();
  }
}

export class DemoDb {
  store: Store = new Map();
  collection(name: string) {
    return new Collection(this.store, name);
  }
  batch() {
    return new Batch();
  }
  async runTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const tx = new Tx();
    const result = await fn(tx);
    await tx.commit();
    return result;
  }
  settings() {}
}

/** Auth palsu: semua operasi berjaya tanpa buat apa-apa. */
export const demoAuth = {
  async createUser() {
    return { uid: newId() };
  },
  async updateUser() {},
  async deleteUser() {},
  async revokeRefreshTokens() {},
  async verifySessionCookie(): Promise<never> {
    throw new Error("[demo] tiada sesi Firebase dalam Mod Demo");
  },
  async verifyIdToken(): Promise<never> {
    throw new Error("[demo] log masuk Firebase tidak digunakan dalam Mod Demo");
  },
};

function seed(db: DemoDb) {
  const now = Timestamp.now();
  const teams = [
    { id: "team-a", name: "Team A", color: "#EC5A7E" },
    { id: "team-b", name: "Team B", color: "#8B5CF6" },
    { id: "team-c", name: "Team C", color: "#10B981" },
    { id: "team-d", name: "Team D", color: "#F59E0B" },
  ];
  for (const t of teams) db.collection("teams").doc(t.id)._set({ name: t.name, color: t.color, createdAt: now });

  const users = [
    { id: "demo-admin", name: "Aisyah (Admin)", email: "admin@demo.local", role: "admin", teamIds: [] as string[] },
    { id: "demo-ali", name: "Ali (Team A)", email: "ali@demo.local", role: "member", teamIds: ["team-a"] },
    { id: "demo-hakim", name: "Hakim (Team A)", email: "hakim@demo.local", role: "member", teamIds: ["team-a"] },
    { id: "demo-siti", name: "Siti (Team B dan C)", email: "siti@demo.local", role: "member", teamIds: ["team-b", "team-c"] },
    { id: "demo-farah", name: "Farah (Team D)", email: "farah@demo.local", role: "member", teamIds: ["team-d"] },
  ];
  for (const u of users) {
    const { id, ...rest } = u;
    db.collection("users").doc(id)._set({ ...rest, active: true, createdAt: now });
  }

  const items = [
    { id: "item-soup", name: "Chicken Soup", kind: "Produk", category: "Makanan", sku: "ATD-CS", unit: "botol", priceSen: 2590, costSen: 1100 },
    { id: "item-nlpek", name: "Nasi Lemak Pek", kind: "Produk", category: "Makanan", sku: "ATD-NL", unit: "pek", priceSen: 1290, costSen: 550 },
    { id: "item-oat", name: "Oatmeal Kurma", kind: "Produk", category: "Makanan", sku: "ATD-OK", unit: "balang", priceSen: 3490, costSen: 1400 },
    { id: "item-bundle", name: "Bundle Set", kind: "Produk", category: "Set / Bundle", sku: "ATD-BS", unit: "set", priceSen: 6990, costSen: 3000 },
    { id: "menu-nlayam", name: "Set Nasi Lemak Ayam", kind: "Menu F&B", category: "Makanan", sku: "", unit: "pinggan", priceSen: 1500, costSen: 700 },
    { id: "menu-teh", name: "Teh Tarik", kind: "Menu F&B", category: "Minuman", sku: "", unit: "gelas", priceSen: 350, costSen: 120 },
    { id: "svc-katering", name: "Katering Majlis", kind: "Servis", category: "Servis", sku: "", unit: "pax", priceSen: 2500, costSen: 1500 },
  ];
  for (const { id, ...rest } of items) db.collection("items").doc(id)._set({ ...rest, active: true, version: 1, createdAt: now });
  const outlets = [
    { id: "outlet-s2", name: "Outlet Seremban 2", kind: "Restoran", address: "Jalan S2 B4, Seremban 2", city: "Seremban", pic: "Kak Mah", phone: "012-111 2222" },
    { id: "outlet-nilai", name: "Outlet Nilai", kind: "Cawangan", address: "Nilai Square", city: "Nilai", pic: "Abang Din", phone: "012-333 4444" },
    { id: "outlet-klcc", name: "Pop-up KLCC", kind: "Pop-up", address: "Suria KLCC, Concourse", city: "Kuala Lumpur", pic: "Ain", phone: "012-555 6666" },
  ];
  for (const { id, ...rest } of outlets) db.collection("outlets").doc(id)._set({ ...rest, active: true, version: 1, createdAt: now });

  const t = todayMYT();
  const d = (n: number) => addDays(t, n);
  const campaigns = [
    { name: "Nasi Lemak Campaign", type: "Food Review", teamId: "team-a", startDate: d(-2), endDate: d(3), itemIds: ["item-nlpek", "menu-nlayam"], outletIds: ["outlet-s2"], platforms: ["TikTok"], status: "Ongoing", budget: 1000000 },
    { name: "Product Launch Chicken Soup", type: "Launch", teamId: "team-b", startDate: d(4), endDate: d(4), itemIds: ["item-soup"], outletIds: [], platforms: ["TikTok", "Instagram"], status: "Approved", budget: 800000 },
    { name: "KOL Chicken Soup", type: "KOL", teamId: "team-b", startDate: d(3), endDate: d(8), itemIds: ["item-soup"], outletIds: [], platforms: ["TikTok"], status: "Idea", budget: 350000 },
    { name: "TikTok Live Mingguan", type: "Live", teamId: "team-c", startDate: d(6), endDate: d(6), itemIds: ["item-nlpek"], outletIds: [], platforms: ["TikTok"], status: "Scheduled", budget: 150000 },
    { name: "Affiliate Oatmeal", type: "Affiliate", teamId: "team-d", startDate: d(9), endDate: d(15), itemIds: ["item-oat"], outletIds: [], platforms: ["Shopee"], status: "Planning", budget: 500000 },
    { name: "Roadshow KLCC", type: "Event", teamId: "team-a", startDate: d(12), endDate: d(13), itemIds: [], outletIds: ["outlet-klcc"], platforms: [], status: "Idea", budget: 1200000 },
    { name: "Promo Bundle Set Hujung Bulan", type: "Promotion", teamId: "team-b", startDate: d(18), endDate: d(21), itemIds: ["item-bundle"], outletIds: [], platforms: ["Shopee", "Lazada"], status: "Planning", budget: 300000 },
    { name: "Live + Promo Nasi Lemak", type: "Live", teamId: "team-d", startDate: d(-10), endDate: d(-8), itemIds: ["item-nlpek"], outletIds: [], platforms: ["TikTok"], status: "Completed", budget: 200000 },
  ];
  const campaignIds = new Map<string, string>();
  for (const c of campaigns) {
    const { budget, ...rest } = c;
    const ref = db.collection("campaigns").doc();
    campaignIds.set(c.name, ref.id);
    ref._set({
      ...rest,
      objective: "",
      notes: "",
      plannedBudgetSen: budget,
      statusNote: "",
      version: 1,
      deleted: false,
      createdBy: "demo-admin",
      createdByName: "Aisyah (Admin)",
      createdAt: now,
      updatedAt: now,
    });
    db.collection("audit_logs").doc()._set({
      actorId: "demo-admin", actorName: "Aisyah (Admin)", action: "create", entity: "campaign", entityId: ref.id,
      teamId: c.teamId, from: null, to: c.status, note: "Data contoh Mod Demo", changes: null, requestId: "demo-seed", at: now,
    });
  }
  seedFinance(db, campaignIds);
  seedIdeas(db, now);
  seedContent(db, now, campaignIds);
  seedPerformance(db, now);
}

/** Prestasi contoh untuk content published dan KOL yang sudah posting. */
function seedPerformance(db: DemoDb, now: Timestamp) {
  const put = (targetType: string, targetId: string, teamId: string, day: number, m: [number, number, number, number, number, number, number, number]) => {
    const [views, likes, comments, shares, saves, clicks, orders, salesSen] = m;
    db.collection("performance").doc(`${targetType}_${targetId}_d${day}`)._set({
      targetType, targetId, teamId, day, views, likes, comments, shares, saves, clicks, orders, salesSen, note: "", recordedAt: now, recordedBy: "demo-ali", recordedByName: "Ali (Team A)",
    });
  };
  for (const [id, c] of db.store.get("content_items") ?? []) {
    if (c.status === "Published") {
      put("content", id, String(c.teamId), 1, [8200, 610, 44, 38, 90, 120, 6, 15540]);
    }
  }
  for (const [id, k] of db.store.get("campaign_kols") ?? []) {
    if ((k.checklist as { posted?: boolean })?.posted) {
      put("kol", id, String(k.teamId), 1, [45200, 3900, 210, 480, 760, 900, 38, 98420]);
    }
  }
}

function seedContent(db: DemoDb, now: Timestamp, campaignIds: Map<string, string>) {
  const t = todayMYT();
  const d = (n: number) => addDays(t, n);
  const bank = [...(db.store.get("content_bank")?.entries() ?? [])][0];
  const items = [
    { title: "Reaksi pertama Chicken Soup (UGC)", team: "team-a", owner: ["demo-ali", "Ali (Team A)"], status: "Editing", date: d(3), platform: "TikTok", type: "UGC", items: ["item-soup"], camp: "Nasi Lemak Campaign", bankId: bank?.[0] ?? null },
    { title: "Resipi 5 minit Nasi Lemak Pek", team: "team-a", owner: ["demo-hakim", "Hakim (Team A)"], status: "Review", date: d(5), platform: "Instagram", type: "Educational", items: ["item-nlpek"], camp: "", bankId: null },
    { title: "Teaser pelancaran Chicken Soup", team: "team-b", owner: ["demo-siti", "Siti (Team B dan C)"], status: "Scheduled", date: d(4), platform: "TikTok", type: "Promotional", items: ["item-soup"], camp: "Product Launch Chicken Soup", bankId: null },
    { title: "Testimoni pelanggan Oatmeal", team: "team-d", owner: ["demo-farah", "Farah (Team D)"], status: "Script", date: d(9), platform: "Facebook", type: "Testimonial", items: ["item-oat"], camp: "", bankId: null },
    { title: "Behind the scene dapur", team: "team-a", owner: ["demo-ali", "Ali (Team A)"], status: "Published", date: d(-4), platform: "TikTok", type: "Storytelling", items: [], camp: "", bankId: null },
    { title: "Carousel menu baru outlet S2", team: "team-a", owner: ["demo-hakim", "Hakim (Team A)"], status: "Idea", date: "", platform: "Instagram", type: "Product Demo", items: ["menu-nlayam"], camp: "", bankId: null },
  ];
  const ids: string[] = [];
  for (const c of items) {
    const ref = db.collection("content_items").doc();
    ids.push(ref.id);
    ref._set({
      title: c.title, teamId: c.team, ownerId: c.owner[0], ownerName: c.owner[1], campaignId: campaignIds.get(c.camp) ?? null, bankId: c.bankId,
      platform: c.platform, contentType: c.type, itemIds: c.items, publishDate: c.date, postUrl: c.status === "Published" ? "https://www.tiktok.com/@iya/video/7401111111111111111" : "",
      script: "Hook: Aku ingat benda ni biasa je...\nBabak 1: buka tudung, wap naik\nCTA: Dapatkan di Shopee", notes: "", status: c.status, statusNote: "",
      createdBy: c.owner[0], createdByName: c.owner[1], createdAt: now, updatedAt: now, version: 1, deleted: false,
    });
  }
  const assets = [
    { name: "Raw footage reaksi Chicken Soup", kind: "Raw footage", url: "https://drive.google.com/drive/folders/contoh-raw", team: "team-a", content: ids[0], rights: "Milik sendiri", until: "", status: "Approved", creator: "Ali" },
    { name: "Video TikTok Sarah Hanis (review outlet)", kind: "KOL content", url: "https://www.tiktok.com/@sarahhhh/video/7412345678901234567", team: "team-a", content: null, rights: "KOL - organik sahaja", until: d(10), status: "Approved", creator: "Sarah Hanis" },
    { name: "Spark Ads Miss Linaa", kind: "KOL content", url: "https://www.instagram.com/reel/contoh/", team: "team-b", content: null, rights: "KOL - boleh iklan", until: d(-2), status: "Approved", creator: "Miss Linaa" },
    { name: "Poster pelancaran Chicken Soup", kind: "Poster", url: "https://www.canva.com/design/contoh/view", team: "team-b", content: ids[2], rights: "Milik sendiri", until: "", status: "Review", creator: "Studio Lensa" },
  ];
  for (const a of assets) {
    db.collection("assets").doc()._set({
      name: a.name, kind: a.kind, file: null, url: a.url, contentItemId: a.content, campaignId: null, teamId: a.team, itemIds: [], platform: "", contentType: "",
      creator: a.creator, usageRights: a.rights, rightsUntil: a.until, status: a.status, statusNote: "", remark: "",
      createdBy: "demo-admin", createdByName: "Aisyah (Admin)", createdAt: now, updatedAt: now, version: 1, deleted: false,
    });
  }
}

function seedIdeas(db: DemoDb, now: Timestamp) {
  const ideas = [
    { id: "idea-beforeafter", title: 'Video "Before After" untuk Chicken Soup', type: "Content Idea", by: ["demo-hakim", "Hakim (Team A)"], team: "team-a", items: ["item-soup"], platforms: ["TikTok"], status: "Discussing", votes: ["demo-ali", "demo-siti", "demo-admin"], desc: "Tunjuk muka penat lepas kerja, kemudian lepas minum sup panas. Hook 3 saat pertama." },
    { id: "idea-livecook", title: "Live cooking bersama KOL chef", type: "Live Idea", by: ["demo-siti", "Siti (Team B dan C)"], team: "team-c", items: ["item-nlpek"], platforms: ["TikTok", "Instagram"], status: "Approved", votes: ["demo-ali", "demo-farah"], desc: "Chef masak resipi guna Nasi Lemak Pek secara live, dengan kod promo khas." },
    { id: "idea-story", title: "Storytelling: Dari Dapur ke Hati", type: "Content Idea", by: ["demo-farah", "Farah (Team D)"], team: "team-d", items: [], platforms: ["Facebook", "Instagram"], status: "New", votes: [], desc: "Siri cerita pendek tentang pengasas dan resipi keluarga." },
    { id: "idea-collab", title: "Collab dengan brand lokal", type: "Campaign Idea", by: ["demo-ali", "Ali (Team A)"], team: "team-a", items: ["item-bundle"], platforms: ["Shopee"], status: "Rejected", votes: ["demo-hakim"], desc: "Bundle bersama brand kopi tempatan untuk 11.11." },
  ];
  for (const i of ideas) {
    db.collection("ideas").doc(i.id)._set({
      title: i.title, description: i.desc, type: i.type, teamId: i.team, itemIds: i.items, platforms: i.platforms,
      references: i.id === "idea-beforeafter"
        ? [{ url: "https://www.tiktok.com/@contoh/video/7400000000000000000", note: "Hook 3 saat pertama sangat kuat" }, { url: "https://www.instagram.com/reel/C0ntoh123/", note: "Gaya suntingan before/after" }]
        : [],
      images: [],
      status: i.status, statusNote: i.status === "Rejected" ? "Tunggu Q1 tahun depan." : "", votes: i.votes, commentCount: 0,
      linkedBankId: null, linkedCampaignId: null, createdBy: i.by[0], createdByName: i.by[1], createdAt: now, updatedAt: now, version: 1, deleted: false,
    });
  }
  const comments: [string, string, string, string][] = [
    ["idea-beforeafter", "demo-ali", "Ali (Team A)", "Setuju, boleh guna KOL ibu bekerja."],
    ["idea-beforeafter", "demo-siti", "Siti (Team B dan C)", "Cuba juga versi pelajar asrama."],
    ["idea-livecook", "demo-admin", "Aisyah (Admin)", "Diluluskan. Sasarkan minggu kedua bulan depan."],
  ];
  for (const [ideaId, uid, name, text] of comments) {
    db.collection("idea_comments").doc()._set({ ideaId, userId: uid, userName: name, text, createdAt: now, deleted: false });
    const ref = db.collection("ideas").doc(ideaId);
    ref._update({ commentCount: FieldValueInc(db, "ideas", ideaId) });
  }
  const bank = [
    { hook: "Aku ingat benda ni biasa je...", desc: "Reaksi pertama cuba Chicken Soup, tunjuk tekstur dan wap panas.", items: ["item-soup"], platforms: ["TikTok"], type: "UGC", funnel: "Awareness", audience: "Pekerja pejabat", team: "team-a", uses: 3 },
    { hook: "RM10 vs RM100 lunch", desc: "Bandingkan lunch mahal dengan set Nasi Lemak Pek.", items: ["item-nlpek"], platforms: ["TikTok", "Instagram"], type: "Trend", funnel: "Consideration", audience: "Pelajar dan pekerja muda", team: "team-b", uses: 1 },
    { hook: "3 cara makan Oatmeal Kurma untuk sahur", desc: "Tips cepat dan sihat untuk bulan puasa.", items: ["item-oat"], platforms: ["Instagram", "Facebook"], type: "Educational", funnel: "Consideration", audience: "Ibu bapa", team: "team-d", uses: 0 },
  ];
  for (const b of bank) {
    db.collection("content_bank").doc()._set({
      hook: b.hook, description: b.desc, itemIds: b.items, platforms: b.platforms, contentType: b.type, audience: b.audience, funnel: b.funnel,
      campaignId: null, references: [], status: "Ready to Produce", useCount: b.uses, ideaId: null, teamId: b.team,
      createdBy: "demo-admin", createdByName: "Aisyah (Admin)", createdAt: now, updatedAt: now, version: 1, deleted: false,
    });
  }
}

/** Kiraan komen demo (tambah 1 kepada nilai semasa). */
function FieldValueInc(db: DemoDb, col: string, id: string): number {
  return Number(db.store.get(col)?.get(id)?.commentCount ?? 0) + 1;
}

function seedFinance(db: DemoDb, campaignIds: Map<string, string>) {
  const now = Timestamp.now();
  const t = todayMYT();
  const month = t.slice(0, 7);
  const d = (n: number) => addDays(t, n);
  // Bajet ikut person: RM 5,000 seorang (Team A ada 2 orang = RM 10,000)
  const prevMonth = addDays(`${month}-01`, -1).slice(0, 7);
  const persons: [string, string][] = [["team-a", "demo-ali"], ["team-a", "demo-hakim"], ["team-b", "demo-siti"], ["team-c", "demo-siti"], ["team-d", "demo-farah"]];
  for (const m of [prevMonth, month]) {
    for (const [teamId, userId] of persons) {
      db.collection("person_budgets").doc(`${teamId}_${userId}_${m}`)._set({ teamId, userId, month: m, baseSen: 500000, carryForwardSen: 0, topUpSen: 0, version: 1, updatedAt: now });
    }
  }
  db.collection("budget_periods").doc(`team-a_${month}`)._set({ teamId: "team-a", month, channels: { "TikTok Ads": 300000, KOL: 400000, "Content Production": 150000 }, updatedAt: now });
  db.collection("budget_requests").doc("req-hakim")._set({
    teamId: "team-a", userId: "demo-hakim", userName: "Hakim (Team A)", month, amountSen: 150000,
    reason: "Tambah 2 KOL food review untuk outlet Nilai", status: "Pending", approvedSen: 0, reviewNote: "", reviewedByName: "", version: 1, createdAt: now,
  });

  const owners: Record<string, [string, string]> = {
    "Iklan TikTok Nasi Lemak minggu 1": ["demo-ali", "Ali (Team A)"],
    "Penggambaran produk": ["demo-ali", "Ali (Team A)"],
    "Sampel untuk KOL": ["demo-hakim", "Hakim (Team A)"],
    "Meta Ads pelancaran": ["demo-siti", "Siti (Team B dan C)"],
    "Sewa booth pelancaran": ["demo-siti", "Siti (Team B dan C)"],
    "Set lampu TikTok Live": ["demo-siti", "Siti (Team B dan C)"],
    "Komisen affiliate Oatmeal": ["demo-farah", "Farah (Team D)"],
  };
  const base = { createdAt: now, updatedAt: now, version: 1, deleted: false, createdBy: "demo-admin", remark: "", receipt: null, kolPaymentId: null, campaignKolId: null, paymentMethod: "Pindahan bank", overBudget: false, statusNote: "" };
  const expenses = [
    { teamId: "team-a", date: d(-6), category: "TikTok Ads", description: "Iklan TikTok Nasi Lemak minggu 1", amountSen: 180000, vendor: "TikTok Ads", status: "Selesai", campaign: "Nasi Lemak Campaign", createdByName: "Ali (Team A)" },
    { teamId: "team-a", date: d(-3), category: "Content Production", description: "Penggambaran produk", amountSen: 120000, vendor: "Studio Lensa", status: "Selesai", campaign: "Nasi Lemak Campaign", createdByName: "Ali (Team A)" },
    { teamId: "team-a", date: d(-1), category: "Product & Sampling", description: "Sampel untuk KOL", amountSen: 45000, vendor: "", status: "Dalam Proses", campaign: "", createdByName: "Ali (Team A)" },
    { teamId: "team-b", date: d(-4), category: "Meta Ads", description: "Meta Ads pelancaran", amountSen: 250000, vendor: "Meta", status: "Selesai", campaign: "Product Launch Chicken Soup", createdByName: "Siti (Team B dan C)" },
    { teamId: "team-b", date: d(-2), category: "Event", description: "Sewa booth pelancaran", amountSen: 380000, vendor: "Event Hub", status: "Dalam Proses", campaign: "Product Launch Chicken Soup", createdByName: "Siti (Team B dan C)" },
    { teamId: "team-c", date: d(-5), category: "Content Production", description: "Set lampu TikTok Live", amountSen: 95000, vendor: "Kedai Kamera", status: "Selesai", campaign: "", createdByName: "Siti (Team B dan C)" },
    { teamId: "team-d", date: d(-8), category: "Affiliate", description: "Komisen affiliate Oatmeal", amountSen: 210000, vendor: "Shopee Affiliate", status: "Selesai", campaign: "", createdByName: "Aisyah (Admin)" },
  ];
  for (const e of expenses) {
    const { campaign, ...rest } = e;
    const [ownerId, ownerName] = owners[e.description] ?? ["demo-admin", "Aisyah (Admin)"];
    db.collection("expenses").doc()._set({ ...base, ...rest, ownerId, ownerName, month: e.date.slice(0, 7), campaignId: campaignIds.get(campaign) ?? null, campaignName: campaign });
  }
  // Bulan lepas: Ali guna RM 3,200 daripada RM 5,000 -> cadangan carry forward RM 1,800
  db.collection("expenses").doc()._set({
    ...base, teamId: "team-a", date: `${prevMonth}-15`, month: prevMonth, category: "Meta Ads", description: "Meta Ads bulan lepas", amountSen: 320000,
    vendor: "Meta", status: "Selesai", ownerId: "demo-ali", ownerName: "Ali (Team A)", createdByName: "Ali (Team A)", campaignId: null, campaignName: "",
  });

  const kols = [
    { id: "kol-sarah", name: "Sarah Hanis", realName: "Nur Sarah Hanis", niches: ["F&B", "Food Review", "Lifestyle"], location: "Kuala Lumpur", rateSen: 80000, owner: "team-a", accounts: [{ platform: "TikTok", username: "sarahhhh", url: "https://www.tiktok.com/@sarahhhh", followers: 1200000 }, { platform: "Instagram", username: "sarahhanis", url: "https://www.instagram.com/sarahhanis", followers: 310000 }] },
    { id: "kol-lina", name: "Miss Linaa", realName: "Nurul Aina", niches: ["Beauty", "F&B"], location: "Selangor", rateSen: 60000, owner: "team-b", accounts: [{ platform: "Instagram", username: "misslinaaa", url: "https://www.instagram.com/misslinaaa", followers: 856000 }] },
    { id: "kol-foodie", name: "Foodie Kakak", realName: "Kak Ros", niches: ["Food Review", "F&B"], location: "Johor", rateSen: 100000, owner: "team-b", accounts: [{ platform: "TikTok", username: "foodie.kakak", url: "https://www.tiktok.com/@foodie.kakak", followers: 540000 }] },
    { id: "kol-nazrul", name: "Nazrul Fitri", realName: "Muhammad Nazrul", niches: ["F&B", "Lifestyle"], location: "Perak", rateSen: 75000, owner: "team-c", accounts: [{ platform: "YouTube", username: "nazrulfitri", url: "https://www.youtube.com/@nazrulfitri", followers: 320000 }] },
    { id: "kol-azlina", name: "Azlina", realName: "Azlina Razak", niches: ["Family & Parenting"], location: "Negeri Sembilan", rateSen: 50000, owner: "team-a", accounts: [{ platform: "Instagram", username: "azlinaaa", url: "https://www.instagram.com/azlinaaa", followers: 210000 }, { platform: "TikTok", username: "azlina.home", url: "https://www.tiktok.com/@azlina.home", followers: 98000 }] },
  ];
  for (const k of kols) {
    const { id, owner, ...rest } = k;
    db.collection("kols").doc(id)._set({ ...rest, contact: "012-345 6789", status: "Aktif", remark: "", ownerTeamId: owner, createdBy: "demo-admin", createdByName: "Aisyah (Admin)", createdAt: now, updatedAt: now, version: 1, deleted: false });
    db.collection("kol_private").doc(id)._set({ bankName: "Maybank", accountNo: "1234 5678 9012", accountName: rest.realName, updatedAt: now });
  }

  const cl = (n: number) => ({ briefSent: n > 0, productSent: n > 1, contentReceived: n > 2, contentApproved: n > 3, posted: n > 4 });
  const collab: Record<string, { collabType: string; details: Record<string, unknown>; inKind: { itemId: string; name: string; qty: number; unitCostSen: number }[] }> = {
    "kol-sarah": { collabType: "Review kedai (dine-in)", details: { outletId: "outlet-s2", visitDate: d(-3), visitTime: "13:00", pax: 3 }, inKind: [{ itemId: "menu-nlayam", name: "Set Nasi Lemak Ayam", qty: 3, unitCostSen: 700 }, { itemId: "menu-teh", name: "Teh Tarik", qty: 3, unitCostSen: 120 }] },
    "kol-azlina": { collabType: "Hantar produk (seeding)", details: { shipAddress: "No 12, Jalan Mawar, Taman Seri, 70450 Seremban", courier: "J&T", trackingNo: "JT0012345678", shipStatus: "Diterima", shippedDate: d(-6), receivedDate: d(-4) }, inKind: [{ itemId: "item-nlpek", name: "Nasi Lemak Pek", qty: 6, unitCostSen: 550 }] },
    "kol-lina": { collabType: "Paid post", details: {}, inKind: [{ itemId: "item-soup", name: "Chicken Soup", qty: 2, unitCostSen: 1100 }] },
    "kol-foodie": { collabType: "Paid post", details: {}, inKind: [] },
    "kol-nazrul": { collabType: "Live / event", details: { eventDate: d(6), eventLocation: "YouTube Live" }, inKind: [] },
  };
  const pics: Record<string, [string, string]> = {
    "kol-sarah": ["demo-ali", "Ali (Team A)"],
    "kol-azlina": ["demo-hakim", "Hakim (Team A)"],
    "kol-lina": ["demo-siti", "Siti (Team B dan C)"],
    "kol-foodie": ["demo-siti", "Siti (Team B dan C)"],
    "kol-nazrul": ["demo-siti", "Siti (Team B dan C)"],
  };
  const cks = [
    { kol: kols[0]!, campaign: "Nasi Lemak Campaign", teamId: "team-a", platform: "TikTok", feeSen: 80000, paidSen: 0, requestedSen: 80000, due: d(-1), stage: "Payment Pending", checklist: cl(5), postUrl: "https://www.tiktok.com/@sarahhhh/video/7412345678901234567", postedDate: d(-1) },
    { kol: kols[4]!, campaign: "Nasi Lemak Campaign", teamId: "team-a", platform: "Instagram", feeSen: 50000, paidSen: 0, requestedSen: 0, due: d(-1), stage: "Content Submitted", checklist: cl(3), postUrl: "", postedDate: "" },
    { kol: kols[1]!, campaign: "Product Launch Chicken Soup", teamId: "team-b", platform: "Instagram", feeSen: 60000, paidSen: 0, requestedSen: 0, due: d(4), stage: "Content Brief Sent", checklist: cl(1), postUrl: "", postedDate: "" },
    { kol: kols[2]!, campaign: "Product Launch Chicken Soup", teamId: "team-b", platform: "TikTok", feeSen: 120000, paidSen: 0, requestedSen: 0, due: d(5), stage: "Negotiation", checklist: cl(0), postUrl: "", postedDate: "" },
    { kol: kols[3]!, campaign: "TikTok Live Mingguan", teamId: "team-c", platform: "YouTube", feeSen: 75000, paidSen: 0, requestedSen: 0, due: d(6), stage: "Confirmed", checklist: cl(0), postUrl: "", postedDate: "" },
  ];
  for (const c of cks) {
    const ref = db.collection("campaign_kols").doc();
    const acc = c.kol.accounts.find((a) => a.platform === c.platform) ?? c.kol.accounts[0]!;
    ref._set({
      campaignId: campaignIds.get(c.campaign), campaignName: c.campaign, kolId: c.kol.id, kolName: c.kol.name, kolHandle: `@${acc.username}`,
      platform: c.platform, teamId: c.teamId, feeSen: c.feeSen,
      picId: pics[c.kol.id]![0], picName: pics[c.kol.id]![1],
      collabType: collab[c.kol.id]!.collabType,
      details: { ...EMPTY_CK_DETAILS, ...collab[c.kol.id]!.details },
      inKind: collab[c.kol.id]!.inKind,
      inKindSen: collab[c.kol.id]!.inKind.reduce((a, l) => a + l.qty * l.unitCostSen, 0), paidSen: c.paidSen, requestedSen: c.requestedSen, deliverables: "1 Video",
      postingDueDate: c.due, month: c.due.slice(0, 7), stage: c.stage, stageNote: "", checklist: c.checklist, postUrl: c.postUrl, postedDate: c.postedDate,
      notes: "", version: 1, deleted: false, createdBy: "demo-admin", createdAt: now, updatedAt: now,
    });
    if (c.stage === "Payment Pending") {
      db.collection("kol_payments").doc()._set({
        campaignKolId: ref.id, teamId: c.teamId, picId: pics[c.kol.id]![0], kolId: c.kol.id, kolName: c.kol.name, campaignId: campaignIds.get(c.campaign), campaignName: c.campaign,
        amountSen: c.feeSen, kind: "Penuh", status: "Pending", invoice: null, proof: null, paidDate: "", expenseId: null,
        notes: "Dicipta automatik selepas posting.", version: 1, deleted: false, createdBy: "demo-admin", createdAt: now,
      });
    }
  }
}

// Simpan pada globalThis supaya data kekal bila kod di-reload semasa `npm run demo`
const g = globalThis as unknown as { __iyaDemoDb?: DemoDb };
export function demoDb(): DemoDb {
  if (!g.__iyaDemoDb) {
    g.__iyaDemoDb = new DemoDb();
    seed(g.__iyaDemoDb);
  }
  return g.__iyaDemoDb;
}
