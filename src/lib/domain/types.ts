export const ROLES = ["admin", "member"] as const;
export type Role = (typeof ROLES)[number];

export const CAMPAIGN_TYPES = ["KOL", "Launch", "Live", "Affiliate", "Event", "Promotion"] as const;
/** Senarai sebenar diurus Admin di Tetapan (lihat domain/master.ts). */
export type CampaignType = string;

export const CAMPAIGN_STATUSES = [
  "Idea",
  "Planning",
  "Approved",
  "Scheduled",
  "Ongoing",
  "Completed",
  "Cancelled",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const PLATFORMS = ["TikTok", "Instagram", "Facebook", "YouTube", "X", "Shopee", "Lazada", "Lain-lain"] as const;
export type Platform = string;

export interface Team {
  id: string;
  name: string;
  color: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  teamIds: string[];
  active: boolean;
}

/** Pengguna yang sedang log masuk, dengan team sesi aktif. */
export interface SessionUser extends AppUser {
  /** "all" hanya untuk Admin. null jika ahli belum ada team. */
  activeTeamId: string | null;
}

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  teamId: string;
  startDate: string; // YYYY-MM-DD (Asia/Kuala_Lumpur)
  endDate: string; // YYYY-MM-DD
  platforms: Platform[];
  itemIds: string[];
  outletIds: string[];
  objective: string;
  plannedBudgetSen: number; // simpan dalam sen untuk elak ralat perpuluhan
  notes: string;
  status: CampaignStatus;
  statusNote: string;
  version: number;
  createdBy: string;
  createdByName: string;
  createdAt: string | null; // ISO
  updatedAt: string | null; // ISO
  deleted: boolean;
}

/** Siapa yang melakukan tindakan: pengguna atau sistem (cron). */
export type Actor =
  | { kind: "user"; user: Pick<AppUser, "id" | "name" | "role" | "teamIds"> }
  | { kind: "system" };

export interface AuditEntry {
  id: string;
  at: string | null;
  actorId: string;
  actorName: string;
  action: string;
  entity: string;
  entityId: string;
  teamId: string | null;
  from: string | null;
  to: string | null;
  note: string;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  requestId: string;
}

export interface ErrorLogEntry {
  id: string;
  at: string | null;
  requestId: string;
  code: string;
  message: string;
  route: string;
  method: string;
  userId: string | null;
  stack: string;
}

/* ------------------------------ Fail ------------------------------ */

export const FILE_PURPOSES = ["receipt", "invoice", "payment_proof", "idea_image", "asset"] as const;
/** Fail yang boleh dilihat SEMUA pengguna (bukan kewangan). */
export const SHARED_FILE_PURPOSES: FilePurpose[] = ["idea_image", "asset"];
export type FilePurpose = (typeof FILE_PURPOSES)[number];

export interface FileRef {
  id: string;
  name: string;
  type: string;
  size: number;
}

/* ----------------------------- Budget ----------------------------- */

export const EXPENSE_CATEGORIES = ["KOL", "Digital Ads", "Content Production", "Event", "Product & Sampling", "Affiliate", "Lain-lain"] as const;
export type ExpenseCategory = string;

export const EXPENSE_STATUSES = ["Dalam Proses", "Selesai", "Ditolak"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export interface Expense {
  id: string;
  teamId: string;
  month: string; // YYYY-MM, dari tarikh perbelanjaan
  date: string;
  campaignId: string | null;
  campaignName: string;
  category: ExpenseCategory;
  description: string;
  amountSen: number;
  vendor: string;
  /** Person yang bajetnya ditolak. */
  ownerId: string;
  ownerName: string;
  paymentMethod: string;
  /** Pilihan: kos berkaitan satu KOL (contoh penghantaran, makanan review). */
  campaignKolId: string | null;
  receipt: FileRef | null;
  remark: string;
  status: ExpenseStatus;
  statusNote: string;
  /** Diisi jika perbelanjaan dijana automatik dari bayaran KOL. */
  kolPaymentId: string | null;
  overBudget: boolean;
  version: number;
  createdBy: string;
  createdByName: string;
  createdAt: string | null;
  updatedAt: string | null;
  deleted: boolean;
}

/* ------------------------------- KOL ------------------------------ */

export const SOCIAL_PLATFORMS = ["TikTok", "Instagram", "Facebook", "YouTube", "X", "Lain-lain"] as const;
export type SocialPlatform = string;

export const KOL_STATUSES = ["Aktif", "Tidak Aktif", "Blacklist"] as const;
export type KolStatus = (typeof KOL_STATUSES)[number];

export interface KolAccount {
  platform: SocialPlatform;
  username: string;
  url: string;
  followers: number;
}

export interface Kol {
  id: string;
  name: string;
  realName: string;
  accounts: KolAccount[];
  niches: string[];
  location: string;
  contact: string;
  /** No. WhatsApp dalam bentuk 60123456789 ("" jika tiada). */
  whatsapp: string;
  rateSen: number;
  status: KolStatus;
  remark: string;
  ownerTeamId: string;
  createdBy: string;
  createdByName: string;
  createdAt: string | null;
  updatedAt: string | null;
  version: number;
  deleted: boolean;
}

export interface KolPrivate {
  bankName: string;
  accountNo: string;
  accountName: string;
  updatedAt: string | null;
}

export const KOL_STAGES = [
  "Selected",
  "Contacted",
  "Negotiation",
  "Confirmed",
  "Content Brief Sent",
  "Content Submitted",
  "Approved",
  "Payment Pending",
  "Paid",
  "Completed",
  "Dropped",
] as const;
export type KolStage = (typeof KOL_STAGES)[number];

export interface KolChecklist {
  briefSent: boolean;
  productSent: boolean;
  contentReceived: boolean;
  contentApproved: boolean;
  posted: boolean;
}

/** KOL yang ditugaskan dalam satu campaign. */
export interface CampaignKol {
  id: string;
  campaignId: string;
  campaignName: string;
  kolId: string;
  kolName: string;
  kolHandle: string;
  platform: SocialPlatform;
  teamId: string;
  /** PIC: person yang bajetnya menanggung fee KOL ini. */
  picId: string;
  picName: string;
  collabType: CollabType;
  /** Maklumat ikut jenis kerjasama. Kosong untuk team lain (mungkin ada alamat rumah KOL). */
  details: CkDetails;
  /** Barang/makanan yang diberi (nilai kos). */
  inKind: InKindLine[];
  /** null = disorok untuk team lain */
  inKindSen: number | null;
  /** null = pengguna tiada akses kewangan team ini (disorok oleh server) */
  feeSen: number | null;
  paidSen: number | null;
  requestedSen: number | null;
  deliverables: string;
  postingDueDate: string; // "" jika belum ditetapkan
  month: string;
  stage: KolStage;
  stageNote: string;
  checklist: KolChecklist;
  postUrl: string;
  postedDate: string;
  notes: string;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
  deleted: boolean;
}

export const PAYMENT_KINDS = ["Penuh", "Deposit", "Baki"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_STATUSES = ["Pending", "Processing", "Paid"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface KolPayment {
  id: string;
  campaignKolId: string;
  teamId: string;
  picId: string;
  kolId: string;
  kolName: string;
  campaignId: string;
  campaignName: string;
  amountSen: number;
  kind: PaymentKind;
  status: PaymentStatus;
  invoice: FileRef | null;
  proof: FileRef | null;
  paidDate: string;
  expenseId: string | null;
  notes: string;
  version: number;
  createdAt: string | null;
  deleted: boolean;
}

/* ------------------------- Katalog & Outlet ------------------------ */

export const ITEM_KINDS = ["Produk", "Menu F&B", "Servis"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export interface Item {
  id: string;
  name: string;
  kind: ItemKind;
  category: string;
  sku: string;
  unit: string;
  priceSen: number;
  /** Nilai kos seunit: digunakan untuk kira nilai barang yang diberi kepada KOL. */
  costSen: number;
  active: boolean;
  deleted: boolean;
  version: number;
}

export interface Outlet {
  id: string;
  name: string;
  kind: string;
  address: string;
  city: string;
  pic: string;
  phone: string;
  active: boolean;
  deleted: boolean;
  version: number;
}

/* ------------------------- Jenis kerjasama KOL ------------------------- */

export const COLLAB_TYPES = [
  "Paid post",
  "Review kedai (dine-in)",
  "Hantar produk (seeding)",
  "Barter",
  "Affiliate",
  "Live / event",
  "Ambassador",
  "Whitelisting / Spark Ads",
] as const;
export type CollabType = (typeof COLLAB_TYPES)[number];

export const SHIP_STATUSES = ["Belum dihantar", "Dihantar", "Diterima"] as const;
export type ShipStatus = (typeof SHIP_STATUSES)[number];

export interface CkDetails {
  outletId: string;
  visitDate: string;
  visitTime: string;
  pax: number;
  shipAddress: string;
  courier: string;
  trackingNo: string;
  shipStatus: ShipStatus;
  shippedDate: string;
  receivedDate: string;
  commissionPct: number;
  affiliateCode: string;
  eventDate: string;
  eventLocation: string;
  contractStart: string;
  contractEnd: string;
  adCode: string;
  rightsUntil: string;
}

export const EMPTY_CK_DETAILS: CkDetails = {
  outletId: "",
  visitDate: "",
  visitTime: "",
  pax: 0,
  shipAddress: "",
  courier: "",
  trackingNo: "",
  shipStatus: "Belum dihantar",
  shippedDate: "",
  receivedDate: "",
  commissionPct: 0,
  affiliateCode: "",
  eventDate: "",
  eventLocation: "",
  contractStart: "",
  contractEnd: "",
  adCode: "",
  rightsUntil: "",
};

export interface InKindLine {
  itemId: string;
  name: string;
  qty: number;
  unitCostSen: number;
}

/* ------------------------- Bajet ikut person ------------------------- */

export interface PersonBudget {
  teamId: string;
  userId: string;
  month: string;
  baseSen: number; // bajet asas bulan ini (Admin)
  carryForwardSen: number; // baki dibawa dari bulan lepas (Admin)
  topUpSen: number; // tambahan yang diluluskan
  totalSen: number;
  set: boolean;
  version: number;
}

export const TOPUP_STATUSES = ["Pending", "Approved", "Rejected", "Cancelled"] as const;
export type TopUpStatus = (typeof TOPUP_STATUSES)[number];

export interface TopUpRequest {
  id: string;
  teamId: string;
  userId: string;
  userName: string;
  month: string;
  amountSen: number;
  reason: string;
  status: TopUpStatus;
  approvedSen: number;
  reviewNote: string;
  reviewedByName: string;
  version: number;
  createdAt: string | null;
}

/* ------------------------- Padam (dengan kelulusan) ------------------------- */

/** Rekod yang ahli boleh MOHON padam. Team, pengguna, item dan outlet: Admin sahaja. */
export const DELETE_REQUEST_ENTITIES = ["campaign", "expense", "kol", "idea", "bank", "content", "asset"] as const;
export type DeleteRequestEntity = (typeof DELETE_REQUEST_ENTITIES)[number];

export interface DeleteRequest {
  id: string;
  entity: DeleteRequestEntity;
  entityId: string;
  entityName: string;
  teamId: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  requestedBy: string;
  requestedByName: string;
  reviewNote: string;
  reviewedByName: string;
  version: number;
  createdAt: string | null;
}

/* ------------------------------ Idea Hub ------------------------------ */

export const IDEA_STATUSES = ["New", "Discussing", "Approved", "In Production", "Published", "Rejected"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export interface Idea {
  id: string;
  title: string;
  description: string;
  type: string;
  teamId: string;
  itemIds: string[];
  platforms: string[];
  /** Pautan posting / video rujukan, dengan nota ringkas. */
  references: RefLink[];
  /** Gambar rujukan (screenshot, poster, contoh). */
  images: FileRef[];
  status: IdeaStatus;
  statusNote: string;
  votes: string[]; // id pengguna yang vote
  commentCount: number;
  linkedBankId: string | null;
  linkedCampaignId: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string | null;
  updatedAt: string | null;
  version: number;
  deleted: boolean;
}

export interface IdeaComment {
  id: string;
  ideaId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string | null;
}

/* ---------------------------- Content Bank ---------------------------- */

export const FUNNELS = ["Awareness", "Consideration", "Conversion"] as const;
export type Funnel = (typeof FUNNELS)[number];

export const BANK_STATUSES = ["Draft", "Ready to Produce", "Archived"] as const;
export type BankStatus = (typeof BANK_STATUSES)[number];

export interface BankEntry {
  id: string;
  hook: string;
  description: string;
  itemIds: string[];
  platforms: string[];
  contentType: string;
  audience: string;
  funnel: Funnel;
  campaignId: string | null;
  references: string[];
  images: FileRef[];
  status: BankStatus;
  useCount: number;
  ideaId: string | null;
  teamId: string;
  createdBy: string;
  createdByName: string;
  createdAt: string | null;
  updatedAt: string | null;
  version: number;
  deleted: boolean;
}

export interface RefLink {
  url: string;
  note: string;
}

/* --------------------------- Produksi content --------------------------- */

export const CONTENT_STATUSES = ["Idea", "Script", "Production", "Editing", "Review", "Approved", "Scheduled", "Published", "Archived"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export interface ContentItem {
  id: string;
  title: string;
  teamId: string;
  ownerId: string;
  ownerName: string;
  campaignId: string | null;
  bankId: string | null;
  platform: string;
  contentType: string;
  itemIds: string[];
  publishDate: string; // "" jika belum ditetapkan
  postUrl: string;
  script: string;
  notes: string;
  status: ContentStatus;
  statusNote: string;
  createdBy: string;
  createdByName: string;
  createdAt: string | null;
  updatedAt: string | null;
  version: number;
  deleted: boolean;
}

/* ---------------------------- Content Library ---------------------------- */

export const ASSET_STATUSES = ["Draft", "Review", "Approved", "Archived"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const USAGE_RIGHTS = ["Milik sendiri", "KOL - organik sahaja", "KOL - boleh iklan", "Berlesen / stok"] as const;
export type UsageRights = (typeof USAGE_RIGHTS)[number];

export interface Asset {
  id: string;
  name: string;
  kind: string;
  file: FileRef | null;
  url: string;
  contentItemId: string | null;
  campaignId: string | null;
  teamId: string;
  itemIds: string[];
  platform: string;
  contentType: string;
  creator: string;
  usageRights: UsageRights;
  rightsUntil: string;
  status: AssetStatus;
  statusNote: string;
  remark: string;
  createdBy: string;
  createdByName: string;
  createdAt: string | null;
  updatedAt: string | null;
  version: number;
  deleted: boolean;
}

/* ------------------------------ Prestasi & laporan ------------------------------ */

/** Titik semakan prestasi selepas posting: hari ke-1, ke-7 dan ke-30. */
export const PERF_DAYS = [1, 7, 30] as const;
export type PerfDay = (typeof PERF_DAYS)[number];
export type PerfTarget = "content" | "kol";

export interface PerfMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  orders: number;
  salesSen: number;
}

export interface PerfSnapshot extends PerfMetrics {
  id: string;
  targetType: PerfTarget;
  targetId: string;
  teamId: string;
  day: PerfDay;
  note: string;
  recordedAt: string | null;
  recordedByName: string;
}
