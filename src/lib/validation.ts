/**
 * Semua input dari browser disahkan di sini (server) sebelum menyentuh database.
 * Jangan percaya data dari client, walaupun borang sudah semak.
 */
import { z } from "zod";
import { BANK_STATUSES, COLLAB_TYPES, DELETE_REQUEST_ENTITIES, FUNNELS, ITEM_KINDS, ROLES, SHIP_STATUSES, USAGE_RIGHTS } from "./domain/types";
import { ASSET_ACTIONS, CONTENT_ACTIONS } from "./domain/content";
import { MASTER_KEYS } from "./domain/master";
import { CAMPAIGN_ACTIONS } from "./domain/campaign";
import { isValidYmd } from "./domain/dates";
import { parseRmToSen } from "./domain/money";
import { KOL_STATUSES, PAYMENT_KINDS } from "./domain/types";
import { KOL_ACTIONS, PAYMENT_ACTIONS } from "./domain/kol";

const text = (max: number) => z.string().trim().max(max, `Maksimum ${max} aksara.`);
const ymd = z.string().refine(isValidYmd, "Tarikh tidak sah (YYYY-MM-DD).");
const id = z.string().trim().min(1, "Wajib diisi.").max(64).regex(/^[A-Za-z0-9_-]+$/, "ID tidak sah.");

export const campaignInputSchema = z
  .object({
    name: text(120).min(3, "Nama campaign sekurang-kurangnya 3 aksara."),
    type: text(40).min(1, "Pilih jenis campaign."),
    teamId: id,
    startDate: ymd,
    endDate: ymd,
    platforms: z.array(text(40).min(1)).max(20).default([]),
    itemIds: z.array(id).max(30, "Maksimum 30 item.").default([]),
    outletIds: z.array(id).max(30, "Maksimum 30 outlet.").default([]),
    objective: text(1000).default(""),
    plannedBudget: z
      .string()
      .max(20)
      .default("0")
      .transform((v, ctx) => {
        const sen = parseRmToSen(v);
        if (sen === null) {
          ctx.addIssue({ code: "custom", message: "Jumlah tidak sah. Contoh: 1500 atau 1500.50" });
          return z.NEVER;
        }
        return sen;
      }),
    notes: text(2000).default(""),
  })
  .refine((v) => v.endDate >= v.startDate, { path: ["endDate"], message: "Tarikh tamat mesti sama atau selepas tarikh mula." })
  .transform((v) => ({
    ...v,
    platforms: [...new Set(v.platforms)],
    itemIds: [...new Set(v.itemIds)],
    outletIds: [...new Set(v.outletIds)],
  }));
export type CampaignInput = z.output<typeof campaignInputSchema>;

export const campaignUpdateSchema = z.object({
  version: z.number().int().positive(),
  data: campaignInputSchema,
});

export const campaignTransitionSchema = z.object({
  action: z.enum(CAMPAIGN_ACTIONS),
  note: text(1000).default(""),
  version: z.number().int().positive(),
});

export const campaignDeleteSchema = z.object({ version: z.number().int().positive() });

export const password = z
  .string()
  .min(10, "Kata laluan sekurang-kurangnya 10 aksara.")
  .max(128)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Kata laluan mesti ada huruf dan nombor.");

export const userCreateSchema = z.object({
  name: text(80).min(2, "Nama sekurang-kurangnya 2 aksara."),
  email: z.string().trim().toLowerCase().email("Email tidak sah.").max(254),
  password,
  role: z.enum(ROLES),
  teamIds: z.array(id).max(20).default([]),
});

export const userUpdateSchema = z
  .object({
    name: text(80).min(2).optional(),
    role: z.enum(ROLES).optional(),
    teamIds: z.array(id).max(20).optional(),
    active: z.boolean().optional(),
    password: password.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Tiada perubahan dihantar.");

export const teamInputSchema = z.object({
  name: text(40).min(2, "Nama team sekurang-kurangnya 2 aksara."),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Warna mesti format #RRGGBB.").default("#EC5A7E"),
});

export const activeTeamSchema = z.object({ teamId: z.string().min(1).max(64) });

export const sessionLoginSchema = z.object({ idToken: z.string().min(20).max(5000) });

/* ----------------------- Budget, KOL, Bayaran ----------------------- */

/** Jumlah RM dari borang -> sen. positive=true: mesti lebih dari 0. */
const money = (positive = false) =>
  z
    .string()
    .max(20)
    .transform((v, ctx) => {
      const sen = parseRmToSen(v);
      if (sen === null) {
        ctx.addIssue({ code: "custom", message: "Jumlah tidak sah. Contoh: 1500 atau 1500.50" });
        return z.NEVER;
      }
      if (positive && sen <= 0) {
        ctx.addIssue({ code: "custom", message: "Jumlah mesti lebih dari 0." });
        return z.NEVER;
      }
      return sen;
    });

const optionalId = z.union([id, z.null()]).optional().transform((v) => v ?? null);
const optionalYmd = z.union([z.literal(""), ymd]).default("");
/** Hanya http/https: elak pautan javascript: atau data: disimpan. */
const httpUrl = z.string().trim().max(500).regex(/^https?:\/\/[^\s]+$/i, "Pautan mesti bermula dengan https://");

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Bulan tidak sah (YYYY-MM).");

/** Pecahan ikut saluran untuk team: { "Meta Ads": "5000", ... } */
export const budgetSetSchema = z.object({
  teamId: id,
  month: monthSchema,
  channels: z.record(text(40).min(1), money()),
});

export const personBudgetSchema = z.object({
  teamId: id,
  userId: id,
  month: monthSchema,
  base: money().optional(),
  carryForward: money().optional(),
});

export const topUpRequestSchema = z.object({
  teamId: id,
  month: monthSchema,
  amount: money(true),
  reason: text(500).min(5, "Terangkan sebab (sekurang-kurangnya 5 aksara)."),
});

export const topUpReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  amount: money().prefault("0"),
  note: text(500).default(""),
  version: z.number().int().positive(),
});

export const expenseInputSchema = z.object({
  teamId: id,
  date: ymd,
  campaignId: optionalId,
  category: text(40).min(1, "Pilih kategori."),
  description: text(300).min(2, "Keterangan sekurang-kurangnya 2 aksara."),
  amount: money(true),
  vendor: text(120).default(""),
  /** Admin sahaja boleh pilih person lain. Ahli: sentiasa diri sendiri. */
  ownerId: optionalId,
  paymentMethod: text(40).default(""),
  campaignKolId: optionalId,
  receiptFileId: optionalId,
  remark: text(1000).default(""),
});
export type ExpenseInput = z.output<typeof expenseInputSchema>;
export const expenseUpdateSchema = z.object({ version: z.number().int().positive(), data: expenseInputSchema });
export const expenseReviewSchema = z.object({ action: z.enum(["verify", "reject"]), note: text(1000).default(""), version: z.number().int().positive() });
export const versionSchema = z.object({ version: z.number().int().positive() });

const kolAccountSchema = z.object({
  platform: text(40).min(1),
  username: text(60)
    .min(1, "Username wajib diisi.")
    .transform((v) => v.replace(/^@+/, "")),
  url: httpUrl,
  followers: z.number().int().min(0).max(10_000_000_000).default(0),
});

export const kolInputSchema = z.object({
  name: text(80).min(2, "Nama KOL sekurang-kurangnya 2 aksara."),
  realName: text(80).default(""),
  accounts: z.array(kolAccountSchema).min(1, "Tambah sekurang-kurangnya satu akaun media sosial.").max(6),
  niches: z.array(text(40).min(1)).max(10).default([]),
  location: text(80).default(""),
  contact: text(120).default(""),
  rate: money(),
  status: z.enum(KOL_STATUSES).default("Aktif"),
  remark: text(1000).default(""),
  ownerTeamId: id,
});
export type KolInput = z.output<typeof kolInputSchema>;
export const kolUpdateSchema = z.object({ version: z.number().int().positive(), data: kolInputSchema });

export const kolPrivateSchema = z.object({
  bankName: text(60).default(""),
  accountNo: z.string().trim().regex(/^[0-9 -]{0,30}$/, "No. akaun hanya nombor.").default(""),
  accountName: text(80).default(""),
});

const ckDetailsSchema = z
  .object({
    outletId: z.union([z.literal(""), id]).default(""),
    visitDate: optionalYmd,
    visitTime: z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d)?$/, "Masa tidak sah (HH:MM).").default(""),
    pax: z.number().int().min(0).max(100).default(0),
    shipAddress: text(300).default(""),
    courier: text(60).default(""),
    trackingNo: text(60).default(""),
    shipStatus: z.enum(SHIP_STATUSES).default("Belum dihantar"),
    shippedDate: optionalYmd,
    receivedDate: optionalYmd,
    commissionPct: z.number().min(0).max(100).default(0),
    affiliateCode: text(60).default(""),
    eventDate: optionalYmd,
    eventLocation: text(120).default(""),
    contractStart: optionalYmd,
    contractEnd: optionalYmd,
    adCode: text(200).default(""),
    rightsUntil: optionalYmd,
  })
  .prefault({});

const inKindSchema = z
  .array(z.object({ itemId: id, qty: z.number().int().min(1, "Kuantiti minimum 1.").max(10_000) }))
  .max(30)
  .default([]);

const ckFields = {
  /** PIC: Admin boleh pilih; ahli sentiasa diri sendiri. */
  picId: optionalId,
  platform: text(40).min(1),
  collabType: z.enum(COLLAB_TYPES).default("Paid post"),
  details: ckDetailsSchema,
  inKind: inKindSchema,
  fee: money(),
  deliverables: text(120).default(""),
  postingDueDate: optionalYmd,
  notes: text(1000).default(""),
};
export const ckAssignSchema = z.object({ campaignId: id, kolId: id, ...ckFields });
export type CkAssignInput = z.output<typeof ckAssignSchema>;
export const ckUpdateSchema = z.object({ version: z.number().int().positive(), data: z.object(ckFields) });
export type CkUpdateInput = z.output<typeof ckUpdateSchema>["data"];
export const ckActionSchema = z.object({
  action: z.enum(KOL_ACTIONS),
  note: text(1000).default(""),
  postUrl: z.union([z.literal(""), httpUrl]).default(""),
  postedDate: optionalYmd,
  version: z.number().int().positive(),
});

const paymentFields = {
  amount: money(true),
  kind: z.enum(PAYMENT_KINDS),
  invoiceFileId: optionalId,
  notes: text(1000).default(""),
};
export const paymentCreateSchema = z.object({ campaignKolId: id, ...paymentFields });
export const paymentUpdateSchema = z.object({ version: z.number().int().positive(), data: z.object(paymentFields) });
export const paymentActionSchema = z.object({
  action: z.enum(PAYMENT_ACTIONS),
  proofFileId: optionalId,
  paidDate: optionalYmd,
  note: text(1000).default(""),
  version: z.number().int().positive(),
});

/* --------------------------- Tetapan Master --------------------------- */

export const masterListSchema = z.object({
  key: z.enum(MASTER_KEYS),
  items: z
    .array(text(40).min(1, "Nama tidak boleh kosong."))
    .min(1, "Sekurang-kurangnya satu pilihan.")
    .max(80)
    .transform((v) => [...new Set(v)]),
});

export const itemInputSchema = z.object({
  name: text(80).min(2, "Nama item sekurang-kurangnya 2 aksara."),
  kind: z.enum(ITEM_KINDS),
  category: text(40).default(""),
  sku: text(40).default(""),
  unit: text(20).default("unit"),
  price: money(),
  cost: money(),
  active: z.boolean().default(true),
});
export type ItemInput = z.output<typeof itemInputSchema>;

export const outletInputSchema = z.object({
  name: text(80).min(2, "Nama outlet sekurang-kurangnya 2 aksara."),
  kind: text(40).default(""),
  address: text(300).default(""),
  city: text(60).default(""),
  pic: text(80).default(""),
  phone: text(30).default(""),
  active: z.boolean().default(true),
});
export type OutletInput = z.output<typeof outletInputSchema>;

export const withVersion = <T extends z.ZodType>(data: T) => z.object({ version: z.number().int().positive(), data });

/** Admin: isi bajet asas beberapa person untuk beberapa bulan sekali gus. */
export const bulkBudgetSchema = z.object({
  teamId: id,
  userIds: z.array(id).min(1, "Pilih sekurang-kurangnya seorang.").max(50),
  months: z.array(monthSchema).min(1, "Pilih sekurang-kurangnya satu bulan.").max(24),
  base: money(),
});

/* ------------------------------ Padam ------------------------------ */

export const deleteRequestSchema = z.object({
  entity: z.enum(DELETE_REQUEST_ENTITIES),
  entityId: id,
  reason: text(500).min(5, "Terangkan sebab (sekurang-kurangnya 5 aksara)."),
});
export const deleteReviewSchema = z.object({ action: z.enum(["approve", "reject"]), note: text(500).default(""), version: z.number().int().positive() });
export const restoreSchema = z.object({ entity: z.enum(["campaign", "expense", "kol", "idea", "bank", "content", "asset", "team", "item", "outlet", "user"]), id });

/* ------------------------------ Idea Hub & Content Bank ------------------------------ */

const refs = z.array(httpUrl).max(10, "Maksimum 10 pautan.").default([]);

export const ideaInputSchema = z.object({
  title: text(120).min(3, "Tajuk sekurang-kurangnya 3 aksara."),
  description: text(3000).default(""),
  type: text(40).min(1, "Pilih jenis idea."),
  itemIds: z.array(id).max(20).default([]),
  platforms: z.array(text(40).min(1)).max(20).default([]),
  /** Pautan posting / video rujukan + nota ringkas */
  references: z.array(z.object({ url: httpUrl, note: text(200).default("") })).max(10, "Maksimum 10 pautan.").default([]),
  /** Gambar rujukan yang sudah dimuat naik (purpose idea_image) */
  imageIds: z.array(z.string().regex(/^[a-f0-9]{24}$/, "Gambar tidak sah.")).max(6, "Maksimum 6 gambar.").default([]),
});
export type IdeaInput = z.output<typeof ideaInputSchema>;
export const ideaUpdateSchema = z.object({ version: z.number().int().positive(), data: ideaInputSchema });
export const ideaCommentSchema = z.object({ text: text(1000).min(1, "Komen kosong.") });
export const ideaReviewSchema = z.object({ action: z.enum(["approve", "reject", "reopen"]), note: text(500).default(""), version: z.number().int().positive() });
export const ideaToBankSchema = z.object({
  contentType: text(40).min(1, "Pilih jenis content."),
  funnel: z.enum(FUNNELS).default("Awareness"),
  audience: text(120).default(""),
});
export const ideaToCampaignSchema = z
  .object({ teamId: id, name: text(120).min(3), type: text(40).min(1), startDate: ymd, endDate: ymd })
  .refine((v) => v.endDate >= v.startDate, { path: ["endDate"], message: "Tarikh tamat mesti sama atau selepas tarikh mula." });

export const bankInputSchema = z.object({
  hook: text(200).min(3, "Hook sekurang-kurangnya 3 aksara."),
  description: text(3000).default(""),
  itemIds: z.array(id).max(20).default([]),
  platforms: z.array(text(40).min(1)).max(20).default([]),
  contentType: text(40).min(1, "Pilih jenis content."),
  audience: text(120).default(""),
  funnel: z.enum(FUNNELS).default("Awareness"),
  campaignId: optionalId,
  references: refs,
  status: z.enum(BANK_STATUSES).default("Ready to Produce"),
  teamId: id,
});
export type BankInput = z.output<typeof bankInputSchema>;
export const bankUpdateSchema = z.object({ version: z.number().int().positive(), data: bankInputSchema });

/* ------------------------------ Produksi content & Library ------------------------------ */

const fileId = z.union([z.string().regex(/^[a-f0-9]{24}$/, "Fail tidak sah."), z.null()]).optional().transform((v) => v ?? null);

const contentFields = {
  title: text(160).min(3, "Tajuk sekurang-kurangnya 3 aksara."),
  teamId: id,
  ownerId: optionalId,
  campaignId: optionalId,
  platform: text(40).default(""),
  contentType: text(40).default(""),
  itemIds: z.array(id).max(20).default([]),
  publishDate: optionalYmd,
  script: text(10000).default(""),
  notes: text(2000).default(""),
};
export const contentInputSchema = z.object({ ...contentFields, bankId: optionalId });
export type ContentInput = z.output<typeof contentInputSchema>;
export const contentUpdateSchema = z.object({ version: z.number().int().positive(), data: z.object(contentFields) });
export const contentActionSchema = z.object({
  action: z.enum(CONTENT_ACTIONS),
  note: text(1000).default(""),
  postUrl: z.union([z.literal(""), httpUrl]).default(""),
  version: z.number().int().positive(),
});

export const assetInputSchema = z
  .object({
    name: text(160).min(2, "Nama asset sekurang-kurangnya 2 aksara."),
    kind: text(40).min(1, "Pilih jenis asset."),
    fileId,
    url: z.union([z.literal(""), httpUrl]).default(""),
    contentItemId: optionalId,
    campaignId: optionalId,
    teamId: id,
    itemIds: z.array(id).max(20).default([]),
    platform: text(40).default(""),
    contentType: text(40).default(""),
    creator: text(120).default(""),
    usageRights: z.enum(USAGE_RIGHTS).default("Milik sendiri"),
    rightsUntil: optionalYmd,
    remark: text(1000).default(""),
  })
  .refine((v) => v.fileId || v.url, { path: ["url"], message: "Muat naik fail atau tampal pautan (Google Drive, TikTok...)." });
export type AssetInput = z.output<typeof assetInputSchema>;
export const assetUpdateSchema = z.object({ version: z.number().int().positive(), data: assetInputSchema });
export const assetActionSchema = z.object({ action: z.enum(ASSET_ACTIONS), note: text(1000).default(""), version: z.number().int().positive() });

/* ------------------------------ Prestasi ------------------------------ */
const count = z.number().int().min(0).max(1_000_000_000_000).default(0);
export const perfInputSchema = z.object({
  targetType: z.enum(["content", "kol"]),
  targetId: id,
  day: z.union([z.literal(1), z.literal(7), z.literal(30)]),
  views: count,
  likes: count,
  comments: count,
  shares: count,
  saves: count,
  clicks: count,
  orders: count,
  sales: money().prefault("0"),
  note: text(500).default(""),
});
export type PerfInput = z.output<typeof perfInputSchema>;
